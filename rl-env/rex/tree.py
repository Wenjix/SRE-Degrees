"""REx proper — Thompson-sampling tree over candidate refinements.

The linear loop always refines the latest candidate. REx instead keeps every
candidate as a tree node with a Beta posterior over its quality, and each round
Thompson-samples which node to expand (refine) next — so it explores from the most
promising candidate, not just the last one. Same scoring/harness/escalate machinery
as the linear loop; deterministic under `seed`.
"""
from __future__ import annotations

import random

from rex.harness import run_plan
from rex.loop import propose as default_propose
from rex.scoring import failed_checks, score_plan


def _memo_judge(judge_fn):
    """One judge verdict per stated cause (consistent score/feedback, fewer calls)."""
    from rex import scoring
    cache: dict = {}

    def memo(stated, gold, herrings):
        if stated not in cache:
            fn = judge_fn or scoring._llm_judge
            cache[stated] = bool(fn(stated, gold, herrings))
        return cache[stated]
    return memo


def rex_tree(scenario, budget: int = 6, propose_fn=default_propose, judge_fn=None, seed: int = 0) -> dict:
    rng = random.Random(seed)
    nodes: list = []

    def add(plan: dict, parent):
        memo = _memo_judge(judge_fn)
        sim = run_plan(plan, scenario)
        score, fb = score_plan(plan, scenario, sim, judge_fn=memo)
        fc = failed_checks(plan, scenario, sim, judge_fn=memo)
        rec = {
            "node": len(nodes), "parent": parent,
            "depth": 0 if parent is None else nodes[parent]["depth"] + 1,
            "score": round(score, 4), "resolved": bool(sim["resolved"]),
            "stated_root_cause": plan.get("root_cause", ""),
            "diagnosis_correct": "root_cause" not in fc, "failed_checks": fc,
            "blocked": sim.get("blocked_actions", []), "plan": plan, "feedback": fb,
            # Beta posterior over node quality, seeded from its own score
            "alpha": 1.0 + score, "beta": 1.0 + (1.0 - score),
        }
        nodes.append(rec)
        return rec

    add(propose_fn(scenario, None), None)                 # root: no prior feedback
    while len(nodes) < budget:
        if any(not n["failed_checks"] for n in nodes):    # a clean win exists -> stop
            break
        # Thompson sampling: draw theta_i ~ Beta(alpha_i, beta_i), expand the argmax
        sel = max(range(len(nodes)), key=lambda i: rng.betavariate(nodes[i]["alpha"], nodes[i]["beta"]))
        child = add(propose_fn(scenario, nodes[sel]["feedback"]), sel)
        # tighten the selected parent's posterior by the child's outcome
        nodes[sel]["alpha"] += child["score"]
        nodes[sel]["beta"] += 1.0 - child["score"]

    best = max(range(len(nodes)), key=lambda i: nodes[i]["score"])
    result = {
        "scenario": scenario.name, "nodes": nodes, "iterations": nodes,  # alias for escalate/probe
        "best_score": nodes[best]["score"], "best_iter": best,
        "resolved": any(n["resolved"] for n in nodes),
        "clean_win": any(not n["failed_checks"] for n in nodes),
        "engine": "thompson-tree",
    }
    result["outcome"] = "resolved" if result["clean_win"] else "escalated"
    if result["outcome"] == "escalated":
        from rex.escalate import escalation_report
        result["escalation"] = escalation_report(scenario, result)
    return result
