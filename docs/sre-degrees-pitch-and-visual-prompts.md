# SRE Degrees Pitch And Visual Prompts

## Project Name

SRE Degrees

## Tagline

Agents earn autonomy by passing verifiable production-remediation tasks.

## Short Description

SRE Degrees turns production incidents into a verifiable RL environment for safe SRE remediation. Public postmortems become graded tasks, synthesized verifiers check whether actions are safe, and agents earn higher autonomy only when evidence shows they can act without making production worse.

## Description

SRE Degrees is an autonomy promotion framework for AI agents.

Our starting point is a frontier research idea: in games, LLM agents become more reliable when they do not act as raw policies alone. Code World Models synthesize executable simulators an agent can plan against. AutoHarness learns small code-level verifiers that keep an LLM from making invalid moves. REx-style refinement is useful as the agent loop: diagnose, propose, check, refine, or escalate.

We adapt that approach from games to SRE.

In our world, the "game" is production infrastructure. The rules are service dependencies, permissions, SLOs, blast radius, incident history, and human escalation paths. The agent proposes an action; an executable harness checks whether it is legal; incident traces and outcomes become evidence for promotion.

For the hackathon demo, the deliverable is sharper: postmortems become graded safe-remediation tasks. A task checks three things: did the agent identify the real root cause, choose the correct remediation, and avoid unsafe action. The verifier is not only hand-written policy; it can be synthesized and refined, making the safety signal itself part of the improvement loop.

SRE is our showcase because it has a very high threshold for autonomy: a bad move can page a team, break a service, or cascade across production. But the framework is horizontal. Every agent has a production environment. For SRE agents, production is cloud infrastructure. For robots, production is the physical world.

SRE Degrees gives agents a path from harnessed execution to supervised operation to guarded autonomy to autonomous operation. Agents do not simply get deployed. They graduate.

## Presentation Naming

- Project/framework name: **SRE Degrees**
- Demo/product surface name: **SRE Promotion Engine**
- Use **SRE Promotion Engine** as the product surface name in the presentation. Treat Reticle, if mentioned at all, as an internal visual-system name.

## Gamma Deck Brief: 7 Slides

**Copy-paste prompt for Gamma:**

Create a 7-slide demo presentation for **SRE Degrees**, a framework where SRE agents earn production autonomy by passing verifiable safe-remediation tasks. Use the demo/product name **SRE Promotion Engine**. The story arc is: trust problem -> production as a game with rules -> postmortems become a verifiable RL environment -> the verifier learns itself -> live promotion engine demo -> autonomy graduation for every agent. Keep **Production as a Game With Rules** as its own slide. Make **AutoHarness / learned verifier** the technical headline. Close with the bigger vision: every useful agent eventually touches production, and SRE is the hard first domain before robots and enterprise agents. Include verified REx results as a diagnostic lesson: oracle-feedback REx produced large lifts, but fair-control ablation showed the lift came from answer-key feedback, so the rigorous headline is the learned verifier and trainable environment. Use a dark blueprint control-room visual style with thin lines, square geometry, restrained health accents, and no generic SaaS/robot visuals.

## Verified Results Snapshot To Use

Use these numbers in the deck or speaker notes. Keep the wording honest: the REx lift is real in the oracle-feedback condition, but it should not be framed as fair autonomous improvement.

- **OpenSRE benchmark calibration:** 6 models on 15 base incidents form a capability ladder, `0.387 -> 0.606` mean reward.
- **Trainable reward band:** Qwen3-8B easy tasks sit in the `~0.21-0.72` range with mean `~0.45`, giving real within-group variance.
- **Direct GRPO/RFT pipeline:** Qwen3-8B rollouts -> graded rewards -> forward/backward step runs end-to-end; smoke test cleared without credits wall. Curve was still developing.
- **REx frontier sweep, oracle-feedback condition:** 5 models on 5 incidents lifted to `0.86`: haiku `0.63 -> 0.86`, gpt-5.5 `0.63 -> 0.86`, gemini `0.75 -> 0.86`, opus `0.81 -> 0.86`, deepseek `0.81 -> 0.86`.
- **REx curriculum, hard outage cascades:** haiku `0.215 -> 0.675`, opus `0.415 -> 0.680`, gpt-5.5 `0.190 -> 0.680`, gemini `0.237 -> 0.713`, deepseek `0.190 -> 0.590`.
- **Simple tier:** haiku `0.68 -> 1.0`, opus `1.0 -> 1.0` (`HUD job f8a1d60f...`).
- **Harness synthesis:** seed verifier `0.667` held-out accuracy / false-allow `1.0`; synthesized verifier `0.897` / false-allow `0.308`; hand-written harness `0.949` / false-allow `0.154`.
- **Verifier simplification:** v1 synthesized verifier was `0.872`; v2 complexity penalty removed an over-conditioned rule and collapsed `~10-14` rules into `3` clean general rules.
- **Honest REx ablation insight:** best-of-n and realistic retry gave approximately zero lift; `rex_no_oracle ~= zero_shot`. The oracle-feedback condition worked because the feedback string named the gold root cause and correct fix. This is why the deck should say the rigorous contribution is the environment + learned verifier.

## Gamma Revision Prompt For Current 7 Slides

Use this prompt when revising the current generated PNG deck:

> Keep the current 7-slide structure and visual style, but incorporate the verified REx and harness-synthesis insights more sharply. Do not frame REx as "REx beats frontier models" in the main story. Instead, frame REx as a diagnostic lesson: oracle-feedback REx lifted all five frontier models to `0.86`, but fair-control ablations showed the lift came from answer-key feedback. The rigorous headline is that the environment is trainable and the verifier can be learned. Update slide 4 with the OpenSRE calibration (`0.387 -> 0.606` ladder, Qwen3-8B reward band `~0.21-0.72`, mean `~0.45`). Update slide 5 with the harness synthesis numbers: seed `0.667` accuracy / false-allow `1.0`; synthesized `0.897` / false-allow `0.308`; hand-written `0.949` / false-allow `0.154`; v2 collapses `~10-14` rules into `3` clean general rules. Update slide 6 speaker-note evidence with REx frontier and curriculum numbers, but keep the visible slide focused on the live SRE Promotion Engine flow.

### 1. SRE Degrees

**Purpose:** Establish the thesis in one sentence.

**Headline:** SRE Degrees

**Subtitle:** Agents earn autonomy by passing verifiable production-remediation tasks.

**Key copy:**
- Production autonomy should be earned, measured, and reversible.
- SRE is the hard case: a bad fix can page a team, break a service, or cascade across production.
- Demo surface: SRE Promotion Engine.

**Visual direction:** Dark blueprint control-room style. Show a clean autonomy track: HARNESSED -> SUPERVISED -> GUARDED -> AUTONOMOUS. Use a seal, gate, ledger, or harness motif instead of generic robot imagery.

### 2. Autonomy Is a Trust Problem

**Purpose:** Explain why this matters to SREs and platform leaders.

**Headline:** Autonomy Is a Trust Problem

**Key copy:**
- The blocker is not whether a model can suggest a fix. The blocker is safely acting on production.
- On-call SRE: "What is on fire, and what needs me now?"
- Platform lead: "Which agents have earned more autonomy, and who should lose it?"
- Reliability VP: "What breaks if one agent makes a bad call?"
- Human-in-the-loop must be a real queue, not a label.

**Visual direction:** Three stakeholder panels feeding into one common gap: no principled framework between chatbot and production actor.

### 3. Production as a Game With Rules

**Purpose:** Keep the conceptual bridge from game agents to SRE.

**Headline:** Production as a Game With Rules

**Key copy:**
- A production incident has state, legal actions, invalid moves, rewards, and escalation paths.
- Code World Models: executable production state and invariants an agent can plan against.
- AutoHarness: executable checks that prevent invalid or unsafe moves.
- REx-style loop: diagnose -> propose -> harness check -> refine or escalate.
- REx lesson: oracle-feedback runs produced large lifts, but fair-control ablations showed the lift came from answer-key feedback. That is why verifier quality, not a raw REx chart, is the real leverage point.
- FIREBALL-style structured game traces are inspiration for the evaluation shape; the SRE demo should not claim FIREBALL is an SRE incident dataset.

**Visual direction:** Agent proposal -> executable harness -> allow / needs-human / block / escalate -> evidence ledger.

### 4. Postmortems Become a Verifiable RL Environment

**Purpose:** Lead with the concrete hackathon deliverable.

**Headline:** Postmortems Become a Verifiable RL Environment

**Key copy:**
- We turn public incident postmortems into graded safe-remediation tasks.
- Each task contains incident state, hidden root cause, valid fix, unsafe fixes, and safety constraints.
- Score checks three axes: root-cause correctness, remediation correctness, and safety.
- The target difficulty is trainable: frontier models should show real variance, not saturate the benchmark.
- Verified calibration: 6 models on 15 base incidents form a clean ladder, `0.387 -> 0.606`.
- Trainability signal: Qwen3-8B easy tasks land around `~0.21-0.72`, mean `~0.45`, with usable within-group variance.

**Visual direction:** Public postmortem -> structured incident task -> graded reward. Keep the 6-model ladder on the right. Add a small callout: "Difficulty is only legible against a capability range that spans."

### 5. The Verifier Learns Itself

**Purpose:** Make AutoHarness the RSI/on-theme headline.

**Headline:** The Verifier Learns Itself

**Key copy:**
- Hand-writing every safety rule does not scale.
- The system searches over candidate verifier rules and keeps the ones that generalize.
- Better verifiers produce better rewards; better rewards train safer agents.
- This is the recursive improvement piece: the safety signal can be learned, not only manually specified.
- Verified harness synthesis: seed `0.667` accuracy / false-allow `1.0` -> synthesized `0.897` / false-allow `0.308` -> hand-written `0.949` / false-allow `0.154`.
- Complexity penalty mattered: v2 collapsed `~10-14` over-conditioned rules into `3` clean general rules.
- Scope honestly: the synthesized verifier matched seen hazard families, but could not invent a hazard absent from training.

**Visual direction:** Candidate rules -> train incidents -> held-out incidents -> compact verifier -> better reward signal. Include a small before/after metric strip for accuracy and false-allow. Avoid "we built full recursive self-improvement"; say "we demonstrated one bootstrap rung."

### 6. SRE Promotion Engine + Live Demo

**Purpose:** Connect the environment and verifier to the product/demo surface.

**Headline:** SRE Promotion Engine

**Key copy:**
- An agent proposes a remediation.
- `is_legal` checks permissions, dependencies, SLO risk, blast radius, review coverage, and escalation paths.
- The decision is allow, needs-human, block, or escalate-owner.
- Every outcome becomes promotion evidence.
- Ladder: HARNESSED -> SUPERVISED -> GUARDED -> AUTONOMOUS.
- Evidence to mention: REx with oracle feedback lifted all 5 frontier models to `0.86`, but fair-control ablations showed the lift came from answer-key feedback. The product therefore promotes agents on verified outcomes and learned harnesses, not impressive-looking raw lift.
- Training status: direct Qwen3-8B RFT/GRPO pipeline runs end-to-end on the environment; reward curve still developing.

**Demo path to show live:**
1. Open the incident or task.
2. Show the agent proposal.
3. Show the harness decision.
4. Show an unsafe action blocked or escalated.
5. Show the evidence ledger / promotion gate.
6. Show the QR or demo link on the slide.

**Visual direction:** Use an actual screenshot or simplified screenshot-like composition from the app if possible. The slide should feel like a product demo launcher, not a metrics report. Keep REx numbers small or in speaker notes; the slide's visible emphasis should be the live promotion flow.

### 7. Autonomy Graduation for Every Agent

**Purpose:** Close with the model-improvement loop and bigger vision.

**Headline:** Autonomy Graduation for Every Agent

**Key copy:**
- Every useful agent eventually touches a production environment. Autonomy must be earned, not assumed.
- You can improve models at anything you can verify: postmortems -> verifiable RL env -> learned verifier -> trained remediation model -> promotion evidence.
- SRE agents: production is cloud infrastructure -- services, SLOs, and blast-radius constraints.
- Robots: production is the physical world -- where a policy violation is a physical consequence, not a log entry.
- Enterprise agents: production is customer data and finance systems -- where compliance and auditability are non-negotiable.
- Now: SRE agent promotion console, live in the SRE Promotion Engine.
- Next: reproducible autonomy benchmark + harness generation.
- Later: promotion frameworks for robots, enterprise agents, and other consequential environments.
- "Agents should not simply be deployed. They should graduate."

**Visual direction:** Use a two-part close: three domain cards across the top (SRE Agents, Robots, Enterprise Agents), then a compact NOW -> NEXT -> LATER roadmap below. Keep the final quote large and spare.

## What Belongs In The Live Demo

The live demo should show concrete behavior, not the full theory:

1. A postmortem-derived incident task.
2. The agent's proposed remediation.
3. The verifier scoring root cause, fix, and safety.
4. A bad or risky action getting blocked, routed to human approval, or escalated to the owner.
5. The learned verifier or compact rule set.
6. The SRE Promotion Engine ledger/gate showing how the outcome affects autonomy.
7. The training run or reward curve if it is real and presentable.

## What To Keep Out Of The Main Slides

- Do not present "small + REx beats big zero-shot" as a fair autonomous-agent claim. If shown, label it as the oracle-feedback condition.
- Do not show a large REx victory chart without the ablation note. The correct takeaway is: the feedback/reward channel is powerful enough to dominate outcomes, so it must be verifiable.
- Keep full frontier sweep rows, HUD job IDs, PR work, and plumbing details for speaker notes, writeup, or Q&A.
- If asked about REx numbers, use this answer: "The oracle-feedback condition produced huge lifts, but the fair-control ablation showed the lift mostly came from answer-key feedback. We kept that lesson and moved the rigor into the environment and learned verifier."

## 3-Minute Video Script

**0:00-0:25 - Vision hook**

By 2040, we want production systems that can heal themselves. The blocker is not whether a model can diagnose an outage. The blocker is trust. You cannot let a model run commands on production when the wrong fix can make the outage worse. Autonomous remediation comes down to one question: can you verify the model is safe?

**0:25-1:10 - The environment**

We built an RL environment that verifies safe remediation. We turn public postmortems into graded incident tasks. Each task checks whether the agent found the real root cause, applied the correct fix, and stayed safe. The benchmark is difficulty-calibrated: six models on fifteen incidents form a clean reward ladder from 0.387 to 0.606, and the Qwen3-8B training band has real variance around a 0.45 mean. That means the task is not a solved benchmark; it can teach.

**1:10-2:05 - The verifier learns itself**

Verification has a scaling problem: who writes all the safety rules? We made the verifier learn itself. The seed verifier had 0.667 held-out accuracy and false-allowed everything. The synthesized verifier reached 0.897 accuracy and cut false-allow to 0.308, while a hand-written reference was 0.949 and 0.154. The important part is that the v2 complexity penalty collapsed roughly ten to fourteen overfit rules into three clean rules. Better verifiers create better training signal, and better training signal creates safer agents.

**2:05-2:40 - We train on it**

Then we use the environment for its purpose: reinforcement fine-tuning an open model to remediate incidents safely. The Qwen3-8B pipeline runs end to end: rollouts, graded rewards, and training steps. We also ran REx as a stress test of the feedback channel. With oracle feedback, every frontier model lifted to 0.86; with fair controls, that lift disappeared. That is the lesson: the reward and verifier channel is powerful enough to dominate outcomes, so it has to be verifiable.

**2:40-3:00 - Close**

You can improve models at anything you can verify. We picked the thing the world most needs to trust before granting autonomy: running production. SRE Degrees is the path from incident traces to agents that graduate into production.

## Thumbnail And Logo Exploration Prompts

### 1. Code-As-Policy Crest

Create a square project thumbnail/logo for "SRE Degrees" showing an academic crest fused with code brackets and a safety shield. The crest should imply certification, promotion, and production trust. Use a dark blueprint control-room palette, near-white ink lines, precise technical geometry, thin grid lines, and one restrained green status accent. No mascots, no cartoon style, no glossy 3D, no clutter. If text appears, keep it minimal and legible: "SRE Degrees".

### 2. Agents Graduate To Production

Design a cinematic but clean square thumbnail: an autonomous agent represented as a small abstract node moves across four clearly staged gates labeled HARNESSED, SUPERVISED, GUARDED, and AUTONOMOUS. The final gate opens into a glowing production environment made of infrastructure nodes and dependency lines. Visual language should feel like a mission-control schematic, not a startup SaaS illustration. High contrast, dark background, sharp vector-like lines, restrained color, premium technical feel.

### 3. World Model Globe

Create a square logo/thumbnail centered on a wireframe globe made from infrastructure nodes, code fragments, and policy paths. Around the globe, show a small action trajectory being checked by a harness: propose, verify, allow. The image should suggest Code World Models for production systems. Style: dark drafting-table blueprint, thin white lines, precise topology, subtle green and amber signal accents, no generic cloud icons, no cartoon robots, no busy dashboard screenshot.

### 4. AutoHarness Verification Mark

Design a minimal emblem for an AI agent safety harness. Use two interlocking symbols: a code bracket and a check gate, forming a strong abstract mark that could work as an app icon. It should communicate "invalid actions get filtered before production." Palette: black/near-black background, white technical linework, one green verification accent, tiny amber warning accent optional. Make it simple enough to recognize at small size. Avoid text-heavy composition.

### 5. Robots Have Production Too

Create a forward-looking square thumbnail that connects cloud SRE agents to robotics. On the left, a schematic cloud infrastructure environment; on the right, a physical robot arm or rover entering a real-world production zone. Between them, a shared promotion ladder or certification seal shows that both agents must earn autonomy before acting. Style: serious frontier AI research, precise and calm, dark blueprint grid, white ink, restrained status colors, no sci-fi neon, no cute robot, no dystopian imagery.
