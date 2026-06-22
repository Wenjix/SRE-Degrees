# Product

## Register

product

## Users

**Primary: frontier SREs operating fleets of AI agents.** Their context is high-stakes reliability work, often under incident pressure (the "3am view"), reasoning about autonomous agents they cannot fully see. Their jobs, on any given screen: triage what's on fire, clear the queue of agent actions awaiting human approval, decide which agents have earned more autonomy (and yank it back when trust erodes), and understand what breaks if one agent makes a bad call.

**Secondary: VPs of platform & reliability.** They zoom out to the portfolio — fleet cost/economics, how much of the fleet runs without a human in the loop, where authority is dangerously concentrated, and who owns that risk.

The console is dual-audience by design, but the operator's day-to-day workflow comes first; the executive views are the deliberate zoom-out.

## Product Purpose

The **SRE Promotion Engine** is a spatial operations console that makes a fleet of autonomous SRE agents into first-class, legible objects. Eight lenses project one shared live store: a spatial board (Canvas), dense triage (List), a latency×error-budget Scatter, the **Promotion Engine** (agents earn their way from HARNESSED → AUTONOMOUS on verifiable evidence), the **on-call cockpit** (Incidents + the human approval Queue), the **VP telescope** (Fleet Risk & Economics), the **Authority & Blast-Radius map**, and the **World Model** (the production estate as a "code world model" agents plan against).

It exists because operating AI agents demands a different instrument than operating services: you must see an agent's own health *and* the service it owns, the evidence behind its autonomy, the blast radius of its authority, and the real human-in-the-loop decisions it's waiting on. REx reframes that evidence: a baseline model proposes, an executable harness refines and blocks unsafe behavior, and the console shows whether that loop reached the known ceiling instead of merely looking green. The live product language is code-as-policy: `propose_action` creates candidate changes, `is_legal` gates them, and every denial/escalation becomes auditable evidence. Success: an operator can answer **"what's on fire, what needs me, who has earned more autonomy, and what breaks if this agent errs"** in seconds — honestly, without vanity metrics.

Agents earn promotion through a ledger of evidence: simulator incidents, live-fire GKE/LKE and M-real incidents, RL/eval rollouts, blocked unsafe actions, correct escalations, dwell time, review coverage, and owned-service SLO health. Promotion is reversible; a clean live incident can advance an agent, while degraded judgment or unsafe proposals can hold or demote it.

Current evidence posture: the built-in REx sweep is preliminary calibration over 5 incidents and 5 frontier models, not a broad benchmark. It shows baseline scores `0.630-0.810` compressed to the ceiling-aware `0.860` after oracle-feedback REx, where the singleton unsafe incident earns escalation credit instead of a fake fix. The rigorous product claim is the promotion framework and verifier-backed evidence loop; trained open-weight performance remains future work until measured and archived.

Longer-term, SRE is the first domain, not the only domain. The framework should transfer anywhere agents operate inside a consequential production environment: enterprise workflows, lab automation, and eventually robotics. For robots, production is the physical world. They will need SRE-like promotion agents that monitor real-world state, verify proposed actions, block unsafe plans, and keep an evidence ledger before physical autonomy expands.

## Brand Personality

Blueprint-precise, calm-under-fire, instrument-grade. Voice: terse, technical, honest. Three words: **precise, honest, calm**. The emotional target is the steady confidence of a well-instrumented control room — legibility over spectacle, trust earned through evidence rather than asserted through green checkmarks.

## Anti-references

- **Generic SaaS observability dashboards** (Datadog/Grafana sameness): endless identical card grids, the hero-metric template (big number + small label + gradient accent), the cool-gray + single-accent monoculture.
- **Dark "hacker" cliché**: neon-on-black, matrix-rain, terminal-as-costume. (Terminal-native typography is welcome; costume is not.)
- **Consumer / playful**: rounded friendly shapes, bright multi-color, mascots, delight-for-its-own-sake.
- **Heavy enterprise**: dense gray data tables, Bootstrap/AdminLTE chrome, modal-on-modal flows.

## Design Principles

1. **Make the model honest.** Surface the real signals — owned-service SLO burn, cost/runaway spend, review coverage, decision-quality eval — never vanity greens. A healthy agent sitting over a burning service must read as exactly that. Color carries one meaning only: agent health.
2. **Position is meaning.** Spatial layout encodes truth: service zones on the board, autonomy as left→right position + monochrome ink (never a saturated hue), blast radius as a traversable graph. The operator reads structure, not just numbers.
3. **Trust is earned and can be lost.** Autonomy is a ladder gated by verifiable evidence in progressively riskier proving grounds; demotion is automatic when trust erodes. The interface dramatizes both directions.
4. **Code is the trust wedge.** The dashboard shows proposed action, legal check, policy version, route, and outcome; policy is deterministic, versioned, and correctable.
5. **REx is evidence, not magic.** A higher REx score never widens autonomy by itself; task coverage, review coverage, clean wins, and correct escalation on unsolvable cases stay visible.
6. **Human-in-the-loop is a worklist, not a label.** Oversight appears as a real queue of decisions — each with blast radius, the agent's stated reasoning, confidence, and an SLA — that the operator can actually act on.
7. **Legibility over spectacle.** Calm by default; motion and emphasis are reserved for genuine state change. Every signal is reachable by keyboard and screen reader, and nothing is conveyed by color alone.

## Accessibility & Inclusion

WCAG 2.2 **AA**. Keyboard-first: the List lens is the keyboard / screen-reader spine, every interactive surface is reachable and operable by keyboard, and canvas-based surfaces (the spatial board, the blast map, the world globe) carry parallel screen-reader affordances. **Reduced motion** is honored on every animation (`prefers-reduced-motion` → static or instant). **Color is never the sole signal** — health color is always paired with text + shape, and autonomy is encoded by position + ink + icon, not hue. **Desktop-optimized** for the hackathon demo; mobile is deprioritized, with the dense List lens as the small-screen fallback.
