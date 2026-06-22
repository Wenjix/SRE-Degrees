# AGENTS.md

Orientation for AI agents working in this repo. This file captures the
**non-obvious operational knowledge** (commands with surprising flags, hard
constraints, cross-system links, gotchas). It is a complement to — not a
duplicate of — the deep docs; read those (listed at the bottom) when you need
detail.

## TL;DR — this is a two-system monorepo

| System | Location | Stack | Toolchain |
|---|---|---|---|
| **UI** (the product) | repo root (`app/`, `lib/`, `components/`) | Next.js 16 · React 19 · TypeScript (strict) · Tailwind v4 | pnpm + Node |
| **RL env / REx** (the research) | `rl-env/` | Python (sim engine, frozen-LLM harness, trajectory generator) | pip + pytest |

The two are coupled by **code generation** (see below): the UI's CIDG Lab data
is frozen into TS modules generated from `rl-env`'s scenario specs.

---

## Commands

### UI (run from repo root)

```bash
pnpm install
pnpm dev          # http://127.0.0.1:3220   (NOTE: --webpack, not Turbopack)
pnpm typecheck    # next typegen && tsc --noEmit   (strict, must pass)
pnpm test         # node --test over an EXPLICIT file list (see gotcha)
pnpm build        # production build (--webpack)
pnpm start        # serve the production build on :3220
```

The dev/build/start/test scripts all run through `scripts/next-cli.mjs`, which
spawns the local `next` binary with `NODE_OPTIONS=--disable-warning=DEP0205`.
Don't call `next` directly — use the pnpm scripts.

**Verify any UI change with the triple:** `pnpm typecheck && pnpm test && pnpm build`.

### RL env / REx (run from `rl-env/`)

```bash
# --- lightweight runtime (sim + frozen-model client + rex loop) ---
pip install -r requirements-rex.txt        # pyyaml + requests ONLY

# --- offline tests (no API keys needed; proposer/judge are faked) ---
python3 -m pytest tests/test_rex_*.py tests/test_engine.py tests/test_spec.py

# --- live REx probes (need ANTHROPIC_API_KEY in rl-env/.env) ---
python3 -m rex.probe oom_kill
python3 -m rex.probe gcp_service_control

# --- trajectory generation (needs a HUD venv at rl-env/.venv-hud + keys) ---
bash opensre-traj/run_models.sh           # 4-model spanning set, synthetic
bash opensre-traj/run_real.sh             # 19 real-world incidents
```

`requirements.txt` is the **GPU/SFT stack** (unsloth/trl/transformers) — install
it only on a GPU box or Colab, never on the dev laptop. Training scripts
(`train_sft.py`, `train_dpo.py`, `eval_agent.py`) run on a GPU, not here.

---

## Hard constraints (UI)

These are enforced by convention and will break the build or the design if violated.

- **Indentation is TABS, not spaces.** Match every file you touch.
- **NO NEW RUNTIME DEPENDENCIES.** Runtime deps are frozen at exactly
  `next`, `react`, `react-dom`, `lucide-react`. The camera, clustering, charts,
  audio, state, and animation are all **hand-rolled** — do not add a
  graph/canvas/physics/chart/audio/state library. Match existing patterns instead.
- **Imports use the `@/` alias** (maps to repo root), e.g. `@/lib/promotion`.
- **Build/dev use `--webpack`, not Turbopack**, despite `next.config.ts`
  containing a `turbopack` key. The `--webpack` flag is set in `package.json`.
- **Pure logic in `lib/*.ts` must stay React/DOM-free** so `node --test` can
  import it via type-stripping. Use **type-only imports** (`import type`) across
  the `@/` alias inside those files. Anything touching React/DOM lives in
  `components/` and carries a `"use client"` directive.
- **No `Date.now()` / `Math.random()` at module scope** — it breaks SSR hydration.
  The seed data is deterministic; runtime randomness lives only inside
  `stepTelemetry` (a client-side effect).
- **One timer only.** The store ticks a single `setInterval` (`stepTelemetry`,
  ~1600ms) that evolves metrics, autonomy evidence, incidents, and the approval
  queue. **Extend `stepTelemetry`; never add a second `setInterval`.**
- **Tailwind v4, CSS-first.** `app/globals.css` opens with `@import "tailwindcss"`.
  There is **no `tailwind.config`**. All design tokens are `--ret-*` CSS custom
  properties defined in `:root` (light) and `.dark` / `:root[data-theme="dark"]`.
- **`pnpm test` runs an explicit file list** declared in the `test` script in
  `package.json`. **A new `test/*.test.ts` file will NOT run until you add it to
  that script.**
- **`.npmrc` sets `store-dir=.pnpm-store`** (a local, gitignored store) and
  `manage-package-manager-versions=false`, so pnpm version is not auto-pinned.

## Design invariants (UI)

These are load-bearing — see `DESIGN.md` and `.impeccable/design.json` for the
full spec. Violating them is a bug even if it typechecks.

- **Saturated color = agent HEALTH, and nothing else.** Green/amber/red are the
  only hues, always paired with a text label + shape cue. Status is never
  conveyed by color alone.
- **Autonomy is a non-color language:** lane **position** (left→right) + a
  monochrome **ink fill bar** + hatch texture + chain/shackle icon + mono label.
  Use `AutonomyChip` for any autonomy display. Never encode autonomy as a hue.
- **`--ret-accent` is an ink** (`#ededed` dark / `#18181b` light), not a color.
  It marks active/primary/autonomy. It must never read as a fifth health state.
- **Flat by default:** square corners (`--ret-card-radius: 0`), 1px hairlines
  (`--ret-border`), zero shadows. The **single** permitted `box-shadow` is the
  critical-card state-lift. Separate regions with hairlines or the tonal ladder
  (`bg → surface → surface-hover`), never with shadows.
- **Motion signals real state change.** Every animation goes in `globals.css`
  **and** into the `prefers-reduced-motion` block (collapses to an instant
  change). No decorative animation. Sound (`useAmbientSound`) is off by default.
- **Reuse before adding:** tokens in `globals.css`, primitives in
  `components/reticle/`, `Sparkline` for charts, `AutonomyChip` for autonomy,
  `STATUS_COLOR_VAR` / `visual.ts` for health color.

## Gotchas (RL env / Python)

- **Two requirements files — pick the right one.** `requirements-rex.txt` is the
  lightweight runtime (sim + rex + frozen-model client). `requirements.txt` is
  the GPU/SFT stack (unsloth/trl). Installing the wrong one either misses deps or
  pulls a heavy torch.
- **No pytest config** (`pytest.ini`/`pyproject`/`conftest.py`). Tests are plain
  `test_*.py` functions with bare `assert`; invoke explicitly as shown above.
- **`.env` is gitignored** and holds API keys. Shell scripts source it with
  `set -a; . ../.env; set +a`. The HUD venv is expected at `rl-env/.venv-hud`.
- **Trajectory data (`*.jsonl`) is gitignored** in `rl-env/` — regenerate with
  `generate.py` / `generate_pathc.py`, or pull from Hugging Face (see
  `rl-env/README.md`).
- **Tier-A (sim) vs Tier-B (M-real on GKE).** Sim numbers are "structurally
  faithful, numerically unvalidated" beyond mechanisms pinned on the real mesh —
  don't claim sim == cluster.

---

## The cross-system codegen link (important)

The UI's CIDG Lab (`/dashboard/lab`) reads from `lib/cidg/catalog.ts` and
`lib/cidg/voices.ts`, but these are **generated**, not hand-written:

```
rl-env/opensre-traj/specs/*.json   ─┐
rl-env/opensre-traj/specs/real/*.json ─┴─► scripts/gen-cidg-catalog.mjs ─► lib/cidg/catalog.ts
                                          scripts/gen-cidg-voices.mjs   ─► lib/cidg/voices.ts
```

The dashboard is client-side, so a compact render-ready subset is frozen into TS
rather than read at runtime. **If you edit a scenario spec, re-run the generator
scripts and commit the regenerated TS** — the UI will otherwise show stale data.

---

## Architecture pointers

**UI** — one store, many projections. `app/dashboard/page.tsx` mounts
`<LensProvider><SectorWorkspace/>`. `LensProvider` (`components/sector/`) holds
all state via `useReducer`; every lens (Canvas, List, Scatter, Promote,
Incidents, Queue, Fleet, Blast, World) is a pure projection of it. Picking an
agent anywhere re-roots every lens via the shared `selectedId`. `/` redirects to
`/dashboard`; `/dashboard/projects` and `/dashboard/settings` are legacy demo
pages still on `lib/demo-data.ts`.

**RL env** — scenario specs are the single source of truth and drive both tiers:
Tier-A in-process sim (`sim/engine.py`, free + deterministic) and Tier-B M-real
(`mreal/`, real HTTP call-mesh on GKE). A frozen, swappable LLM policy runs
through the REx harness (`rex/`), which grades on root-cause + correct-fix +
trap-avoidance (not just "did it come back up") and emits FIREBALL-schema
trajectories with real within-group reward spread.

---

## Where to read next (progressive disclosure)

Read these only when the task needs the detail — they're long on purpose.

| Doc | When to read |
|---|---|
| `README.md` | **Start here.** The master map of the UI: architecture, the full domain model, lens-by-lens walkthrough, conventions. |
| `DESIGN.md` | The complete SRE Promotion Engine design system (colors, type, elevation, components, named rules). Read before any visual/styling work. |
| `PRODUCT.md` | Users, product purpose, brand personality, design principles. Read before product/UX decisions. |
| `.impeccable/design.json` | Machine-readable design tokens, component CSS, motion spec, dos/donts. |
| `rl-env/ARCHITECTURE.md` | The RL thesis, system diagram, the anti-gaming reward, the REx result table. |
| `rl-env/rex/README.md` | The REx vertical slice: layout, run order, foundation files. |
| `rl-env/HANDOFF.md` | Training run order (SFT → DPO → eval) and the result we're chasing. |
| `rl-env/docs/ENVIRONMENT_DESIGN.md` | Full env-design rationale + adversarial review. |
| `app/design-system/page.tsx` | Live component showcase (incl. SECTOR primitives). |
