# CONCRETE RECOMMENDATION: 24-Hour Hackathon Build

## The Wedge
**Kubernetes Incident Autopilot** — an SRE agent that investigates K8s incidents through progressive evidence gathering, shows its reasoning in real-time, and turns every human override into a training signal for the next incident.

---

## v1 Scope (24h deliverables)

1. **Live K8s incident injector** (pod crash, OOM, network partition, ConfigMap drift) with one-click trigger
2. **Terminal UI streaming the agent's chain-of-thought** in real-time (hypothesis → kubectl command → evidence → next step)
3. **Multi-signal evidence fusion** (logs + metrics + resource state) → confidence score per hypothesis
4. **Override capture UI** — when human clicks "wrong path," system records [context, agent choice, human choice, timestamp]
5. **3-incident playthrough** with escalating complexity (OOM → cascading pod failures → config drift causing crashloop)
6. **Before/after metrics dashboard** — "Time to root cause: 18min → 4min" on same incident class
7. **Override replay screen** — show how past human corrections bias current investigation paths

---

## The Demo (3-minute pitch)

### Setup (0:00-0:30)
"You're on-call. 3am. Slack lights up: pods crashing in production."

Click button → inject pod OOMKill incident in live K8s cluster.

### Act 1: The Agent Investigates (0:30-1:30)
Terminal UI shows:
```
[HYPOTHESIS 1] Pod crash → check recent deployments
  ├─ Running: kubectl get events --sort-by=.lastTimestamp
  ├─ Evidence: No deployments in last 2h (confidence: 0.3)
  
[HYPOTHESIS 2] Resource exhaustion → memory pressure
  ├─ Running: kubectl top pods
  ├─ Evidence: Pod "api-7f8d" restarted 4x, last exit: OOMKilled
  ├─ Running: kubectl describe pod api-7f8d
  ├─ Evidence: Container memory limit 128Mi, request 64Mi (confidence: 0.85)
  
[ROOT CAUSE] Memory limit too low for workload spike
[RECOMMENDATION] Increase memory limit to 256Mi + add HPA
```

**The number:** "Root cause identified in **4 minutes**. Last month's identical incident took your team 18 minutes."

### Act 2: The Override (1:30-2:15)
"But what if the agent guesses wrong?"

Inject cascading failure (network partition).

Agent starts down wrong path (checks deployments first).

Human clicks **"Wrong path — check network"** in UI.

Show capture screen:
```
OVERRIDE RECORDED
├─ Context: 3 pods down, cross-AZ traffic spike
├─ Agent chose: Check deployment history
├─ Human chose: Check network policies
├─ Timestamp: 2024-01-15 03:42:18 UTC
```

Agent immediately pivots:
```
[LEARNING FROM OVERRIDE] Network check prioritized
  ├─ Running: kubectl get networkpolicies
  ├─ Evidence: Policy "deny-cross-az" applied 8m ago
```

### Act 3: The Flywheel (2:15-3:00)
Pull up **Override Replay Dashboard**:
- 12 past incidents
- 8 overrides recorded
- Show graph: "Agent accuracy improving 23% per incident in config-drift scenarios"

**The kicker:** "Every time your SRE says 'no, check this instead,' the system gets smarter. This isn't replacing your team — it's **learning from your team**."

---

## The Differentiator

### What Datadog Workflows / PagerDuty AIOps / Rootly **can't** do:

1. **They don't show their work in real-time**  
   - Existing tools: black-box "probable root cause" after 5 minutes  
   - Us: streaming chain-of-thought with evidence + confidence scores every 10 seconds

2. **They don't treat overrides as training data**  
   - Existing tools: human takes over → agent learns nothing  
   - Us: override = labeled example for contextual learning (LLM few-shot refinement)

3. **They're not model-agnostic infrastructure**  
   - Existing tools: vendor-locked inference (Datadog's models, PagerDuty's black box)  
   - Us: swap Claude 3.5 → GPT-4o → Gemini with env var change; harness stays constant

4. **They don't fuse signals at investigation time**  
   - Existing tools: alerts → runbooks (static)  
   - Us: dynamic evidence gathering (logs contradict metrics? Agent requests more kubectl context before concluding)

**Specific example from evidence:**  
Your top post (#1, 44K upvotes) was Apollo dev *posting code* to disprove Reddit's claims. **Transparency beats black-box trust.** Our agent shows the kubectl commands, the output, the reasoning. When it's wrong, you see *why* it was wrong.

---

## Risks / Honest Caveats

### What we **don't know**:
1. **Do SREs actually want to see chain-of-thought during incidents?**  
   - Risk: Cognitive overload during 3am pages  
   - Mitigation: Make it collapsible; default to "summary mode" with drill-down

2. **Can we make override capture feel non-intrusive in 24h?**  
   - Risk: Clunky UI → people won't use it  
   - Acceptance: V1 can be a simple "thumbs down + 2-button choice" — doesn't have to be elegant, just functional for demo

3. **Is the before/after metric (18min → 4min) real or cherry-picked?**  
   - Honest answer: We'll engineer the demo scenarios to show this  
   - Risk: Judges ask "prove this on *novel* incidents"  
   - Mitigation: Acknowledge it's示范; real validation needs 50+ incidents (outside 24h scope)

4. **Does override-as-training-signal actually work with frontier LLMs?**  
   - We're betting on **few-shot prompting** with past overrides injected into context  
   - Risk: LLM doesn't generalize from 8-12 examples  
   - Fallback: Even if learning is weak, *transparency + override UX* still differentiates

### What we **are guessing**:
- That Anthropic judges care more about *interpretation of test-time compute* (multi-step reasoning with evidence fusion) than raw accuracy
- That Cognition judges (Devin team) want to see **human-in-the-loop** that improves the agent, not replaces it
- That K8s incidents are concrete enough for a 3-min demo (vs. abstract "speed up CI/CD")

### What **could fail**:
- K8s cluster flakes during live demo (mitigation: record backup video)
- Agent takes >60sec per hypothesis → demo drags (mitigation: pre-warm with simple incidents)
- Judges ask "why not just use Datadog Workflow Automation?" and we don't have a crisp answer (mitigation: memorize the 4 differentiators above)

---

## Why This Wins

**For Anthropic:** You're showcasing extended thinking (multi-hypothesis evaluation) + interpretability (constitutional AI vibes with explainable reasoning)

**For Cognition:** You're proving agents need *overrides as data*, not as failure modes — aligned with Devin's "human edits make AI better" philosophy

**For Mercor/Etched:** You're building infra that works with *any* model — if Etched's ASICs make inference 10x cheaper, your harness runs 10x more hypotheses in parallel

**For the $50K:** You have a **3-minute narrative** (incident → investigation → override → learning), a **single metric** (18min → 4min), and **live K8s chaos** that's visually compelling. You're not pitching vaporware — you're running `kubectl` on stage.

---

# Final Directive

**Build the terminal UI first** (hours 0-8). If that works, the rest is just wiring incident scenarios (hours 8-16) and recording overrides (hours 16-20). Reserve hours 20-24 for demo polish + backup video.

**Do not:** Try to build real LLM fine-tuning, multi-agent debate, or novel reasoning algorithms. Those are research projects. You're building a **harness that makes test-time compute legible and steerable**. The frontier model does the reasoning; you do the transparency + feedback loop.

**Ship it.**