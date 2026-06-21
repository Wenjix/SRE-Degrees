# SRE-Degrees — Architecture

**What we're building:** an RL **environment + trajectory generator** for autonomous
incident response, where the hard part is reproduced faithfully — *cascading* outages whose
*loudest alert points at a victim, not the cause*, where the *naive fix makes it worse*. The
LLM is a **frozen, swappable policy** (no fine-tuning); reliability comes from the
**environment + a root-cause-aware reward**, in the spirit of code-as-policy / auto-harness.

## The thesis in one line

> A real production cascade misleads even frontier models on the first try; a reward that
> grades **root cause + correct fix + trap-avoidance** (not just "did it come back up")
> produces trajectory data with genuine within-group signal.

We verified both halves: faulting one node propagates to a downstream victim on a real GKE
cluster, and the grader cleanly separates "looks resolved" (reward 0.45) from a clean win
(1.0), with the trap penalised (−0.60).

## System diagram

```mermaid
flowchart TB
  subgraph SRC["① Scenario specs — single source of truth"]
    DSL["CIDG scenario DSL<br/>sim/spec.py · scenarios/cidg/*.yaml<br/>opensre-traj/specs/real/*.json<br/>(real post-mortems: GCP Service Control, Kinesis,<br/>Cloudflare, Slack/Consul, GitHub, Datadog …)"]
  end

  subgraph A["② Tier-A — fast in-process sim (free, deterministic)"]
    ENG["propagate() engine · sim/engine.py<br/>typed dependency graph<br/>emergent cascade · root-cause-aware is_resolved<br/>causal remediation + trap detection"]
  end

  subgraph B["③ Tier-B — M-real live cluster (high fidelity)"]
    MESH["real-RPS call-mesh · mreal/server.py on GKE<br/>services call upstreams over real HTTP<br/>→ cascades are physically emergent"]
    OBS["kube-prometheus-stack<br/>Prometheus · Alertmanager · Grafana<br/>uniform alert fires on the VICTIM"]
    MESH --> OBS
  end

  subgraph POL["④ Frozen LLM policies — no fine-tuning"]
    LLM["agent/llm.py + agent/models.py<br/>Claude Opus 4.8 · Claude Haiku 4.5 (Anthropic)<br/>glm-5p2 · minimax-m3 (Fireworks)"]
  end

  subgraph H["⑤ Rollout harness + grading"]
    REX["rex/harness.py · rex/loop.py · rex/probe.py<br/>observe → propose tool → apply → re-diagnose (iter loop)"]
    SCORE["rex/scoring.py<br/>0.30·diagnosis + 0.25·correct_fix + 0.45·resolved − 0.60·trap<br/>LLM-judge on the MECHANISM · anti-reward-hacking"]
    REX --> SCORE
  end

  subgraph OUT["⑥ Outputs"]
    TRAJ["FIREBALL-schema trajectories<br/>state_before → tool → state_after → reward<br/>within-group reward spread (0.0 / 0.15 / 1.0)"]
    HUDT["HUD v6 traces / dashboard<br/>.venv-hud (Python 3.12)"]
  end

  DSL --> ENG
  DSL --> MESH
  ENG --> REX
  MESH --> REX
  LLM --> REX
  SCORE --> TRAJ
  REX --> HUDT
```

## Why each piece exists

| # | Component | Role | Status |
|---|---|---|---|
| ① | **Scenario specs** (`sim/spec.py`, `scenarios/cidg/`, `opensre-traj/specs/real/`) | Declarative topology + hidden root cause + trap + correct fix. Cascades are *derived*, never scripted. One spec drives both tiers. | ✅ 9 CIDG + larger `opensre-traj` catalog, validated |
| ② | **Tier-A sim** (`sim/engine.py`) | One `propagate()` kernel makes cascades emergent in-process — cheap, deterministic, the training-data engine. | ✅ emergent cascade + root-cause-aware resolution (TDD) |
| ③ | **Tier-B M-real** (`mreal/`) | Real services calling each other over HTTP on GKE → physically real cascades, observed by Prometheus, alert on the victim. | ✅ deployed + verified on live GKE |
| ④ | **Frozen policies** (`agent/llm.py`) | Model-agnostic incident-response policy; swap models for cross-provider spread. | ✅ 4 models live (Anthropic + Fireworks) |
| ⑤ | **Harness + grading** (`rex/`) | Run a model through the incident, grade **root cause + fix + trap**, give feedback, let it re-diagnose. | ✅ producing graded trajectories |
| ⑥ | **Outputs** | FIREBALL-schema trajectories with within-group spread; HUD traces for inspection. | ✅ data flowing |

## The reward (anti-gaming, the crux)

```
score = 0.30·diagnosis_correct + 0.25·correct_fix + 0.45·resolved − 0.60·trap   (clamp 0..1)
```

`resolved` alone is only 45% — a model that restarts/scales until the metric recovers but
**misdiagnoses or trips the trap scores 0.0**. `diagnosis_correct` is an LLM-judge on the
*mechanism* (a config-crash diagnosed as "resource exhaustion" is wrong), and the trap (e.g.
scaling a crash-looping control plane → herds its datastore → worsens it) costs −0.60. This is
what gives the data real signal instead of reward-hackable noise.

## Two-tier reality contract (honest)

- **Tier-A (sim)** generates the bulk of trajectories — free, deterministic, seedable.
- **Tier-B (GKE M-real)** validates that the cascades are physically real and powers the live
  demo (Grafana + Alertmanager firing on the victim).
- We do **not** claim sim numbers equal cluster numbers beyond the mechanisms pinned on the
  real mesh; everything else is labelled "structurally faithful, numerically unvalidated."

See `docs/ENVIRONMENT_DESIGN.md` for the full design rationale and the adversarial review that
shaped it.
