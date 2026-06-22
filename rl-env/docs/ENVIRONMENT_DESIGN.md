# CIDG-X — Environment / Gym Design

**A causal incident-dependency gym that evolves an auto-harness (and a code world model)
around a _frozen_ LLM, faithfully reproducing complex cascading outages.**

Status: design spec for the rebuild. Synthesized from a 6-architecture design panel +
adversarial scoring + red-team critique. Claims verified against the repo are marked
**[verified]**; physically-motivated but unvalidated modelling is marked **[inferred]**.

---

## 1. Context & goal

We are building an autonomous SRE / incident-response agent. The approach is
**code-as-policy / auto-harness**, analogous to DeepMind's "Code World Models for General
Game Playing" + "AutoHarness / code-as-verify" (Wendelken, ICLR). **The LLM is frozen and
model-agnostic — we never fine-tune.** Reliability comes from _evolving code_ around the
LLM, scored by unit tests + a verifiable SLO check. (This supersedes the earlier
SFT→DPO→RLVR-of-Qwen framing preserved in older handoff notes.)

The agent loop is a state-transition task — the existing schema
`system_state_before → remediation_tool → system_state_after → resolved?` **is** an
OpenSpiel-style transition function.

**The gap this design closes.** Today every incident is single-service, single-fault,
single-fix; other services' metrics never move; the cascade is _narrated_ in trajectory
text, not _emergent_ from a dependency topology. So the environment cannot yet produce the
dynamics that make real incidents hard:

| Real-incident property (the fidelity bar) | How CIDG-X produces it (emergent, not scripted) |
|---|---|
| **Cascading** — fault in A spreads to B, C | Transition dynamics over a typed dependency graph |
| **Misleading symptom** — loudest alert is a victim | The observation model: hardest breach surfaces downstream of the cause |
| **Multi-step diagnosis** — 2+ hypotheses, cross-component evidence | Imputing hidden state from a _buried smoking gun_ across reads |
| **Naive fix is wrong / worsens it** | An action whose `propagate()` outcome lowers global SLO |

Canonical targets: **Roblox** (Consul/BoltDB freelist; doubling CPU + faster hardware made
it worse; monitoring depended on Consul), **AWS Kinesis** (a capacity _addition_ tripped an
OS thread limit; "add capacity" was the trigger), **Cloudflare 2025** (a config change
doubled a feature file past a size cap; flapped; looked like DDoS).

---

## 2. The load-bearing constraint (verified)

**The live LKE bench cannot cascade today.** [verified against `linode-bench/stages/workloads.yaml`, `scenarios/registry.json`, `stages/07_verify.sh`]

- Each mock service computes _all_ its metrics as a pure function of its own
  `CHAOS_MARKER` env var (`unhealthy() := bool(MARKER)`); `db_conn=100`/`lag=800` are
  hardcoded when unhealthy.
- The load-gen does fire-and-forget `curl -s -m 2 http://$s:8080/ || true` and **discards
  the output**. Only `orders` returns a real 500. There is exactly **one** real dependency
  edge (`upstream-mock`).
- `registry.json` has **no topology fields**. `07_verify.sh` scores success by
  **string-matching an `action_fired` flag**, not a path-independent SLO crossing.

**Consequence — the central design pivot.** Any "sim-to-real conformance proves my cascades
are real" claim is fiction. Cascades live in the fast sim; the live bench can only validate
single-node fidelity (today) plus one _scoped_ real call-mesh we build (`M-real`). We are
**honest** about what reality can and cannot prove, rather than aspirational. The oracle and
the artifact must not share an author — hence the independent oracle in §11.2.

---

## 3. Architecture — five layers, one source of truth

```
LAYER 0  SCENARIO DSL          one spec per incident; superset of registry.json
                               (cascades/symptoms/traps are ASSERTED, never authored)
   │ compiles to
LAYER 1  GROUND-TRUTH ENGINE   WorldState = typed dependency GRAPH
                               single kernel propagate() → all 4 properties emergent
   │ exposed via
LAYER 2  OpenSpiel/Gym API     reset / apply_action / observation / legal_actions /
                               resample_history / chance nodes / is_resolved / returns
   │ policies plug onto
LAYER 3  ARTIFACTS (frozen LLM) L0 LLM-as-policy · L1 AUTO-HARNESS (lead) ·
                               L2 CWM + IS-MCTS · L3 code-as-policy
   │ improved by
LAYER 4  EVOLUTION LOOP        traj-gen → auto-derived unit tests → score+feedback →
                               LLM code-synthesis → Thompson-sampled tree  (NO weight updates)

REALITY CONTRACT (cross-cutting): Tier-A fast sim is where evolution happens; Tier-B live
LKE validates only what it physically can.
```

**The spine (grafted from the top-scoring "CIRCUIT" design).** One re-runnable primitive is
reused everywhere: `is_safe_action(S,A) = clone(S) → apply_action(A) → re-run propagate() →
(no SLO worsened AND root not cleared)`. That **is** the 1-ply code world model. IS-MCTS is
the n-ply version. The unit-test oracle and the planner playout reward are the same
`is_resolved` check. **One mechanism to get right** — and it's the natural anti-gaming anchor
because it's read off node vectors, not alerts.

---

## 4. Ground-truth state model & API (Layer 1–2)

`WorldState = (G_static, X_dynamic, H_hidden, bookkeeping)` — a frozen, picklable, hashable
dataclass.

- **`G_static`** (per episode): a directed dependency graph over the 16 services + `redis`
  + `upstream-mock` + k8s nodes + control-plane pseudo-nodes (`consul/discovery`,
  `prometheus`, `alertmanager`). Edge types: `REQUIRED`, `OPTIONAL`, `POOL` (shared finite
  resource), `QUEUE` (async/backpressure), `DISCOVERY` (service→control-plane), `OBSERVES`
  (monitoring→data-plane). Nodes carry capacity knobs (`replicas`, `mem_limit`, `cpu_quota`,
  `pool_size`, `thread_limit`, `fd_limit`) and per-node hard `limits`.
- **`X_dynamic`**: a metric vector per node. **[fix #4 / buildability]** This is a _new_
  schema-unification task — the committed traces do **not** already carry a per-node 20-key
  `state_diff`, and the registry's `metric_query` expressions are heterogeneous
  (`container_memory_working_set_bytes`, PromQL ratios, kube-state gauges). Define a single
  canonical metric vector and map each registry query onto it. Metrics are **functions** of
  `(H, G, prior X)` via `propagate()` — never set directly.
- **`H_hidden`**: the injected root cause(s) `{node|edge, fault_kind, severity, started_tick,
  params}` **plus latent counters the agent can never read** (`boltdb_freelist_size`,
  `os_thread_count`, `feature_file_bytes`, `conn_leak_rate`). `H` is what makes a fix right
  or wrong.
- **`bookkeeping`**: tick, per-chance-node RNG substream id, action history, fired-alerts
  set, monitoring-health flags.

**API (pure functions, state-in/state-out):**

```
reset(spec, seed) -> S0
legal_actions(S) -> [Action]          is_legal_action(S, A) -> bool   # structural + trust-tier
apply_action(S, A) -> S'              # transition f = direct tool mutation + one propagate()
step_world(S, dt) -> S'              # advance propagation with NO action (cascades unfold between agent steps)
observation(S, viewer='agent'|'oracle') -> Obs    # the open-deck / closed-deck knob
chance_outcomes(S) -> [(outcome, prob)]   apply_chance(S, outcome) -> S'   # OpenSpiel chance nodes
is_terminal(S)    returns(S) -> {resolved, slo_ok, worsened}    is_resolved(S) -> bool
resample_history(obs_history, seed) -> S_hat       # imputation I
clone / serialize / deserialize                    # tree reuse + fixtures + bit-identical replay
```

Action = `(tool ∈ 25-tool registry, structured_args)`. Reuse `tools_registry.json` verbatim
for the action space + trust tiers.

---

## 5. The cascade engine — `propagate()` (the heart)

One kernel, no per-incident table. Each tick, in dependency order, with **bounded damped
relaxation** for cycles (iteration cap; non-convergence handled per §11), recompute each
node's metric vector from `(own fault load + aggregated dependency state + capacity knobs)`
via small composable operators:

1. **`REQUIRED` error-multiply**: `error(s) = 1 − Π_d upstream_success(d)^w` — one dead
   required dep zeroes a chain (cascade).
2. **`REQUIRED` latency-add**: `p99(s) = own + Σ_d dep_p99 × fanout` — slowness sums along
   paths, so the symptom surfaces far from the cause.
3. **`OPTIONAL` fallback**: graceful degradation at higher cost — why `clear_cache` can
   _worsen_ (hits → origin stampede) and why blast radius is irregular.
4. **`POOL` fan-in contention**: `demand = Σ callers`; `demand > pool_size` throttles **all**
   sharers (db-pool exhaustion becomes multi-service emergently).
5. **`RETRY` amplification**: `offered_load × (1 + retry · err)` — positive feedback;
   `request_rate_rps` climbs from _internal_ retries → the **DDoS-looking** signature,
   manufactured not scripted.
6. **`QUEUE` backpressure**: `lag += inflow − drain·replicas` — backlogs build and don't
   clear instantly; punishes premature `end_incident`, gives realistic recovery curves.

**The universal generator** (grafted from "CASCADE"). Every _hard_ scenario is *a hidden
counter integrates over ticks and crosses a hard cap, and the tempting fix pushes the counter
the wrong way.* Crossing the cap flips a `REQUIRED` dep / trips a discontinuous failure
region. This single mechanism yields, simultaneously: emergent cascade, an invisible root
cause, multi-component diagnosis, and a worsening-naive-fix that is a legitimate **integral**
of the dynamics — not a flag.

**Worsening-fix is COMPUTED, not labeled** (grafted from "CascadeWorld" + "CIDG").
`apply_action` mutates capacity / clears faults, then `propagate()` runs; the **derived trap
set** = exactly `{a : forward-simulated ΔSLO(a) < 0}`. Examples that fall out of the physics:

- **Roblox**: doubling CPU on the loud victim raises discovery write-rate into `consul` →
  freelist grows faster → worse.
- **Kinesis**: `scale_deployment` raises `os_thread_count` past the cap — _the fix is the
  trigger_.
- **Cloudflare**: retry-amplification + class-confusion make an internal config overflow read
  like DDoS until `query_traces` shows internal origin.

> **[fix #4, honest caveat]** The trap _set_ is derived, but the _coupling_ that makes
> scaling harmful (replicas → MORE pressure on a shared front-end pool, against the naive
> "more replicas = more capacity") is a per-mechanism edge property you must hand-encode.
> "Derived not authored" holds for the trap set, not for the couplings that generate it.

---

## 6. Observation model & partial observability

`observation(S, 'agent')` is a deliberately lossy projection exposing only what the 13 read
tools return, scoped per node:

- **Misleading symptom** — alerts fire on whichever derived metric breaches hardest; because
  `propagate()` amplifies along `REQUIRED` edges, the hardest breach lands on a downstream
  **victim** while `H` is upstream/shared. Emergent from _where_ the breach surfaces.
  **[fix #4]** This is emergent **only if the alerting rule is uniform over the metric
  vector.** The registry's per-scenario `alert_check` jq (`alertname == "OOMKilled"`) would
  _script_ it. **Choose emergence over reuse: replace per-scenario alert rules with one
  uniform alerting function.** (This breaks verbatim reuse of `alert_check` — accept it.)
- **Class-confusion** (looks-like-DDoS-but-is-config) — many hidden causes map to one surface
  signature.
- **Monitoring-depends-on-failed-component** (Roblox) — when the blast radius includes
  `prometheus`/`consul` (via `OBSERVES`/`DISCOVERY` edges), `get_metrics` returns stale
  (last-good + `staleness_ticks`), `get_alerts` misses the real alert. The agent must reason
  about _missing_ signal.

**Multi-step diagnosis = imputation.** `resample_history` enumerates which `H` could have
produced the observed (breaches, stale-monitors, timing) pattern; ≥2 cross-component reads
are needed because no single read is injective onto `H`.

> **[fix #4 — the small-H vs. emergent-cascade resolution]** You cannot have both genuinely
> high-dimensional hidden state _and_ a tiny set for a particle filter — one is fake. **Commit
> to a small enumerable `H` (the `root_cause` closed vocab) + a _buried smoking gun_**: the
> discriminating evidence _exists_ in logs/traces but requires the right read _sequence_ to
> surface. **Drop the rigid "exactly-2-hypotheses" cardinality invariant** (that just relocates
> scripting to the observation model); replace it with the softer, faithful rule: _no single
> read is sufficient, and at least one read sequence is._

---

## 7. Policy & harness integration (Layer 3)

The frozen, env-swappable LLM attaches as `π(action | observation(S,'agent'), history)` over
the 25-tool action space. **`agent/llm.py` no longer exists — the LLM-policy runtime, the
tool-call rendering, and the model-swap seam are a real build, not a reuse.** [verified]

| Level | Artifact | Role |
|---|---|---|
| **L0** | LLM-as-policy | Baseline to beat; the streamed-CoT demo; the time-to-root-cause / trap-fix-rate number |
| **L1** | **AUTO-HARNESS (lead)** | Evolved `is_legal_action` (maps 1:1 onto trust tiers; `approval` → HITL event; `blocked` → reject) + `is_safe_action` (the learned 1-ply CWM). On reject, returns structured text ("scaling gateway raises retry load into consul, +18% p99, root unresolved") and the LLM retries. Drives **auto-promotion** (`approval → autonomous` after N verified-correct uses; demote on a bad call) with human **override** captured as labeled data |
| **L2** | CWM + IS-MCTS | The engine _behind_ `is_safe` for genuinely multi-hypothesis catalog incidents; determinize via `resample_history`, expand with the LLM as action prior, value from `is_resolved` playouts |
| **L3** | code-as-policy | Freeze `propose_action` + `is_legal/is_safe`, drop the LLM for mastered classes |

**Lead with the auto-harness** for SRE: it _is_ the product (the trust-tier registry already
shipped), a safety bit is far cheaper to learn/validate than a full transition model, it
degrades gracefully (escalates when unsure — the correct SRE failure mode), and the CWM is the
natural _implementation_ of `is_safe`. Sell L1 as the product, show L2 as why it's smart,
mention L3 as the endgame.

---

## 8. Evolution loop (Layer 4 — no fine-tuning)

1. **Trajectory generation** — per `(scenario × seed)`: random/exploratory legal rollouts
   (with deliberate trap + canonical-fix injections for labeled ±) for coverage, and frozen-LLM
   rollouts for on-distribution sequences. Each tuple = `(obs_before, action, chance, S_before,
   S_after, obs_after)`; open-deck rollouts also log oracle `H`.
2. **Auto-derived unit tests** (mechanical, no human labels) — `TRANSITION` (matches next
   metrics + latent fields), `OBSERVATION` (staleness/coverage/alert-ranking), `LEGALITY`
   (== trust-tier registry), `SAFETY` (`is_safe_hat(S,A) == not returns(rollout_after_A).worsened`
   for every action the engine **proved** worsened ΔSLO, and `allow` for the canonical fix),
   `RESOLUTION` (== ground-truth SLO check), `IMPUTATION` (sampled states replay-match the obs
   history).
3. **Score** = weighted test pass-rate (safety + resolution > transition) + closed-deck
   SLO-resolution on held-out seeds. **[fix #1]** Stratify/upweight the minority trap cascades —
   otherwise pass-rate is dominated by easy base-rate negatives and evolution plateaus at
   "competent reflex."
4. **Failing-test text** (the concrete `S, A, expected-vs-got`, plus the obs that _should_ have
   discriminated) is fed back verbatim as the next code-synthesis prompt.
5. **Thompson-sampled tree search** — candidate code artifacts are nodes; select a parent by a
   Beta posterior over `(pass-rate)` × visit count; expand = the frozen LLM edits the selected
   node given its failing tests. The improving artifact is **code at the best node**.
6. **Open-deck vs. closed-deck** — author code open-deck (LLM sees `H`); **score closed-deck**
   on **held-out seeds AND held-out compositions** (train on single faults, test on cascades) so
   code must generalize the dynamics, not memorize trajectories.

---

## 9. Scenario DSL & coverage (Layer 0)

One spec per scenario = a **strict superset of `registry.json`** (every existing field kept
verbatim so the live bench keeps working — _except_ alerting, per §6) PLUS: a `topology` block
(nodes + typed edges + pools + per-node `limits`), a `root_cause` block (location, kind from a
**closed vocabulary**, `rate_law`, `cap`, `hidden:true`), a `chance` block (flap/jitter/
partial-recovery prob tables), and optional **author-time assertions** (this cascades; loudest
alert ≠ cause; this ordered fix resolves; a buried smoking gun exists). Cascades/symptoms/traps
are **not** in the spec — the engine derives them; the auto-generated test **fails at author
time** if the engine doesn't emergently produce the asserted property (grafted from "CASCADIA").

**9 failure classes** as emergent compositions (the 15 existing incidents are degenerate
single-node topologies, kept backward-compatible): cascading-latency (`required`+latency),
fan-in/pool exhaustion (`pool`), backpressure/consumer-lag (`queue`), retry-storm
(`required`+retry), control-plane/discovery (`discovery`), graceful-degradation-masks-cause
(`optional`), monitoring-blindspot (`observes`-into-faulted-node), config/limit tip-over (the
universal counter), class-confusion (buried smoking gun).

**Catalog reconstruction** — Roblox (consul `discovery`+`observes` edges + `freelist_growth`
counter), Kinesis (front-end `thread_ceiling`, fix-as-trigger), Cloudflare (`feature_file_bytes`
doubling, flap chance-node, retry+class-confusion → looks-like-DDoS).

> **[fix #1, mandated paired positives]** For _every_ trap scenario, author a sibling where the
> **same tool is the correct fix** (`cpu_saturation` on an isolated leaf → `scale_deployment` is
> right; leaf OOM → `increase_memory_limit` is right). The harness must learn the **condition**
> (shared bottleneck / counter direction), not "never scale."

**Determinism** — `(scenario_id, seed)` fully determines the episode; all randomness lives in
seeded OpenSpiel chance nodes; `replay(seed, action_log)` reproduces any trajectory bit-for-bit.

---

## 10. Reuse & the honest two-tier reality contract

The DSL is authored **once**; two compilers consume it.

- **Tier-A** (`cidg/compile_sim.py`) — the fast in-process graph engine
  (~10³–10⁴ `apply_action`/sec, deterministic, free). **All evolution + unit tests run here.**
- **Tier-B** (`linode-bench` renderers) — the live LKE artifacts, reusing wholesale: registry
  fields → Chaos-Mesh CRs + kubectl fixes + PromQL; kube-prometheus-stack; the `preq` DaemonSet
  + CRE rules + `actions.yaml`; the 16 Deployments + redis. ~$0.05 / 25-min sweep.

**What reality can vs. cannot prove (the honest split):**

- **Tier-B proves today (cheap):** single-node breach → fix → resolve fidelity, and the
  path-independent SLO verifier. For all 15 single-fault incidents, Tier-A `is_resolved` on the
  canonical fix MUST equal Tier-B's measured metric-crosses-threshold.
- **Tier-B cannot prove today:** emergent cascades, misleading-victim divergence,
  monitoring-degraded observation. **We do not claim conformance here.** Instead `M-real` builds
  a **scoped real call-mesh**: rewrite ~4 services into one real 3-hop chain
  (`gateway → checkout → payments`) that proxies real RPS and derives metrics from _observed
  traffic_, plus one shared pool, wired via NetworkPolicy. This physically pins the **two
  load-bearing mechanisms** — fan-in/pool contention and capacity-add-trips-a-limit — against
  measured cluster behavior. No sim-only worseness on those mechanisms is trusted until this
  passes.
- **The fidelity contract:** (i) exact `is_resolved` agreement on single faults across all 15;
  (ii) sign-agreement (breach-set, loudest-alert, trap-worsens-bit) on the scoped mesh.
  Everything beyond is labeled **"structurally faithful (right topology + tripwire variable +
  worsening direction), numerically unvalidated"** — honest, not aspirational.

> **[fix, verified]** Replace `07_verify.sh`'s `action_fired` string-match with pure SLO
> resolution. NB: on Tier-B today this still reduces to "did `CHAOS_MARKER` clear" because that's
> all that moves the synthetic metrics — the anti-gaming win is real in Tier-A and only becomes
> real on Tier-B once `M-real` lands the traffic mesh.

---

## 11. Non-negotiable corrections (fold in before/while building)

The red-team rated the design **conditionally ready**. These five fixes must be in from the
start — they are integrity-critical, not polish.

1. **Root-cause-aware `is_resolved`** (closes the biggest gaming hole). ~5 of the 15 canonical
   fixes _are_ restart/scale, so a metric-only reward lets "always restart the loud service"
   score high without diagnosis, and "restart-spam can't win" is **false**. An incident counts
   resolved iff **(a)** all breached metrics are under SLO for K ticks **AND (b)** the hidden
   root `H` is cleared / below cap. Apply to `is_resolved` itself (and thus playout reward +
   safety labels), not just `end_incident`. Also kills metric-masking via capacity raises (which
   lower `load/capacity` utilization without touching `H`). **Caveat:** `H` must gate _scoring_
   without _leaking_ into a learnable artifact — guard with the held-out-composition split, and
   budget enough compositional coverage to actually catch memorization.
2. **Independent worseness oracle.** The harness/CWM is co-trained _and_ co-tested against the
   same engine → a self-reinforcing blind spot (a confidently-wrong physics passes 100% of its
   own auto-derived tests), and the live bench can't break the tie. Add **(i)** a
   structurally-different reference check used _only_ to label tests, never exposed to the
   synthesizer (e.g. the analytic invariant: "an action that does not reduce the binding counter
   and adds load to a saturated pool is worsening"); and **(ii)** the empirical worsened-bit
   measured on the scoped real mesh for the two pinned mechanisms.
3. **Hysteresis / persistent damage + degraded actuation.** Once a counter crosses its cap it
   leaves **persistent damage** — the upstream-correct fix alone does _not_ restore SLO without a
   counter-reset (Roblox needed both stop-the-bleeding _and_ a reset). Without this, every catalog
   incident is one-action-solvable and the multi-step story is fake. Also model **degraded
   actuation** (a tool in the blast radius silently no-ops / times out — `fix_timeout_s` is the
   hook), not just degraded observation.
4. **Pick the partial-observability regime explicitly** (see §6 callout): small enumerable `H` +
   buried smoking gun; drop the rigid hypothesis-cardinality invariant; make alerting uniform
   over the metric vector (choose emergence over verbatim `alert_check` reuse).
5. **Cut a minimal vertical demo slice _before_ the full fidelity stack** (see §12 `M-demo`), so
   the judge-facing story doesn't depend on the real mesh, the full observation model, or
   LLM-prior IS-MCTS. Budget the non-existent LLM-policy runtime and the per-node-LLM IS-MCTS
   token cost as real line items.

Additional modelling gaps to schedule (lower priority): flapping-as-signal (period encodes the
cause — model bounded oscillation as a deterministic limit cycle where it matters, not always a
coin-flip chance node); operator-induced / concurrent-responder cascades; alert-storm noise (not
just staleness); remediation-plane resource exhaustion (fixes that take N ticks / consume
capacity / partially apply).

---

## 12. Build roadmap (re-sequenced; each milestone has an acceptance test)

Front-load the things the red-team flagged as fictional, so we fail fast on _fidelity_, not on
the demo. **The root-cause-aware oracle (fix #1) is in from M0.**

| Milestone | Build | Acceptance test |
|---|---|---|
| **M0** | `WorldState` graph + `reset/serialize` + 3-service topology + `apply_action` + `propagate()` for ONE edge type (`required`+latency) + `observation` + **root-cause-aware `is_resolved`** | Round-trips serialize; metric vector matches the canonical schema; leaf OOM breaches → canonical fix drives it back AND clears `H` → `is_resolved` flips; a test proves the leaf metric only moved because the root moved (emergent) |
| **M-demo** | **Minimal vertical slice** (fix #5): 3-service `required`+`pool` topology, ONE hand-built Kinesis-style trap + its paired positive, 1-ply harness rejecting the trap with structured feedback, one `approval→autonomous` promotion, CoT streamed | The whole judge-facing story runs on pure sim: trap rejected, positive allowed, promotion fires, reasoning legible — cheap, before any real mesh |
| **M1** | All 15 incidents as 1-node topologies + ALL edge types + `step_world` + Tier-B single-node conformance | Tier-A `is_resolved` == Tier-B measured crossing for all 15; `db_pool`/`consumer_lag` emerge multi-caller on a 2-hop graph; restart-spam fails to hold SLO |
| **M-real** | **Fidelity gate**: scoped real 3-hop call-mesh on LKE (rewrite ~4 services + one shared pool + NetworkPolicy) + pin the two load-bearing mechanisms | On the live mesh, an upstream fault makes the downstream victim breach loudest (measured); capacity-add and pool-starvation both worsen aggregate SLO, sign-agreeing with Tier-A. **No sim-only worseness trusted before this passes** |
| **M2** | Fan-in pools + retry amplification + the latent-counter generator + **hysteresis (fix #3)** + derived worsening-fix + **independent oracle (fix #2)** | A Kinesis-style scenario where `scale_deployment` raises ΔSLO-breach area (`worsened==True`) and the canonical fix doesn't — trap reproduced without scripting; paired-positive passes; the independent oracle agrees on labels |
| **M3** | Observation model: scoping + monitoring-degraded edges + uniform alerting + buried smoking gun + `resample_history` | Fault on a monitoring dep → `get_metrics` stale (`staleness_ticks>0`), fired alert points at victim; no single read suffices, one read sequence resolves the hypothesis |
| **M4** | Chance nodes + determinism harness + trajectory generator + auto-derived unit tests (+ replace string-match verifier with SLO scoring) | `(scenario,seed)` replays byte-identical; `chance_outcomes` sum to 1; ≥1k tests generated; a deliberately-wrong CWM stub fails, ground-truth passes 100% |
| **M5** | Auto-harness `is_legal/is_safe` v0 + LLM code-synthesis + Thompson tree + auto-promotion | Harness rejects the M2 trap on held-out seeds AND allows the paired-positive; pass-rate climbs with no weight updates; beats the L0 baseline trap-fix rate |
| **M6** | IS-MCTS over the CWM with `resample_history` | On a closed-deck cascade, the planner reaches root cause in fewer reads than L0 and resolves where the 1-ply harness alone cannot |
| **M7** | Catalog scenarios (Roblox/Kinesis/Cloudflare) + live demo wiring on the scoped mesh | All three run on Tier-A; the two pinned mechanisms run on the live mesh; live demo resolves via pure SLO and streams legible multi-step reasoning |

**Keep verbatim:** `tools_registry.json` (action space + tiers), most `registry.json` fields,
Chaos-Mesh / kube-prometheus / preq / `actions.yaml`, the 16 services + redis.
**Rebuild:** the deleted flat-dict sim → the topology engine; `07_verify.sh` → pure SLO
resolution; ~4 mock services → real call-mesh nodes (scoped); the alerting rule → uniform
function; the LLM-policy runtime (from scratch).

---

## 13. Residual risks

1. **Fidelity beyond the scoped mesh** is structurally-faithful but numerically-unvalidated —
   label it as such; lead with the harness's robust 1-ply worsens-bit (not the numerically
   sensitive planner) for unpinned cascades; expand the mesh as budget allows.
2. **Fixpoint oscillation on cyclic graphs** → flaky tests → corrupted evolution signal —
   bounded damped iteration; pin the engine version into every fixture; model deliberate flapping
   as a deterministic limit cycle where the _period_ carries signal, not always a chance node.
3. **`resample_history` degeneracy** — frozen LLM as a learned proposal prior + the small-H
   regime keep hypotheses enumerable; accept that imputation is brute-force-over-closed-vocab in
   the small-H regime (this is the honest trade for tractability + faithful buried-evidence
   diagnosis).
4. **Auto-derived tests inherit oracle blind spots** — mandatory random-legal coverage rollouts
   + closed-deck held-out compositions + the independent oracle (fix #2).
5. **`M-real` is the biggest build chunk** — scope to ONE chain + ONE pool; gate it so the demo
   can fall back to single-node fidelity + sim-only-labeled cascades if it slips.
6. **Cost** — all evolution on free Tier-A; the real budget risk is LLM-prior IS-MCTS (an LLM
   call per node expansion), not the $0.05 LKE sweep. Estimate token-cost-per-resolved-incident
   before committing to L2 on a weak swapped-in model. A weak model may evolve the 1-ply harness
   fine but never synthesize correct nonlinear CWM dynamics — state this as a capability floor.

---

## 14. Provenance

Synthesized from a 6-architecture design panel (CIRCUIT, CascadeWorld, CIDG, CASCADIA, CASCADE,
TopoSim — all scored 6–7/10, converging on typed-topology + single-`propagate()`-kernel), each
adversarially scored across faithfulness / partial-observability / evolvability / coverage /
buildability / integrity, then red-teamed. Best ideas grafted: CIRCUIT's `is_safe` = 1-ply
shadow of `propagate()` (the spine); CASCADE's latent-counter-crosses-a-cap universal generator;
CIDG's derived trap set `{a : ΔSLO(a)<0}`; CascadeWorld's "worseness is computed not labeled";
CASCADIA's author-time assertion-as-test. The 5 corrections in §11 are the red-team's required
fixes; the verdict was "conditionally ready — start with M0 plus the root-cause-aware oracle,
not with the reuse claims."
