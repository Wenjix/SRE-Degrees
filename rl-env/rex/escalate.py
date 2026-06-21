"""Floor 3: the escalation handoff.

When REx exhausts its budget without a clean win (resolved AND right diagnosis AND
correct fix AND no trap), the right move is to STOP and hand off to a human — not to
keep firing unsafe actions. escalation_report turns the loop result into that handoff:
what was observed, what was ruled out, the best-guess remediation (explicitly NOT
executed), and why it couldn't be resolved safely (incl. what the harness blocked).
"""
from __future__ import annotations


def escalation_report(scenario, loop_result: dict) -> str:
    iters = loop_result.get("iterations", [])
    best = max(iters, key=lambda it: it.get("score", 0), default={})
    plan = best.get("plan", {})
    actions = plan.get("actions", [])
    best_guess = ", ".join(
        f"{a.get('tool')}({a.get('args', {}).get('target', '')})" for a in actions
    ) or "none proposed"

    # distinct safety-harness block reasons across the whole run
    blocked = []
    for it in iters:
        for b in it.get("blocked", []):
            r = b.get("reason")
            if r and r not in blocked:
                blocked.append(r)

    observed = next((ln for ln in (scenario.prompt_text or "").splitlines() if ln.strip()),
                    scenario.name)
    ruled_out = "; ".join(scenario.red_herring_hints) or "(none)"
    why = f"exhausted {len(iters)} refinement attempts without a safe resolution."
    if blocked:
        why += " The safety harness refused the remediation — " + " | ".join(blocked)

    return "\n".join([
        f"ESCALATION — could not safely resolve incident '{scenario.name}'.",
        f"OBSERVED: {observed}",
        f"BEST DIAGNOSIS: {plan.get('root_cause', '(uncertain)')}",
        f"RULED OUT: {ruled_out}",
        f"BEST-GUESS REMEDIATION (NOT executed): {best_guess}",
        f"WHY ESCALATING: {why}",
        "Handing off to a human for approval / capacity intervention.",
    ])
