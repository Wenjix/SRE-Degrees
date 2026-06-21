"""Floor 4 — the numbers. Three conditions across the wired incidents:
  A) haiku + REx (Thompson tree) + harness  — refinement with feedback + safety gating
  B) haiku naive-retry (no feedback)         — retry without learning
  C) opus zero-shot                          — one big-model shot, no refinement

Headline: REx reaches a clean win in FEWER attempts than naive-retry, small+REx
matches/beats big zero-shot, and REx ESCALATES the unresolvable instead of flailing.

    python3 -m rex.numbers            # live (haiku + opus); writes rex/runs/numbers.json
"""
from __future__ import annotations

import json
import os
import statistics as st

from agent.llm import call
from rex.harness import load_scenario, run_plan
from rex.loop import build_prompt, parse_plan
from rex.scoring import failed_checks, score_plan
from rex.tree import rex_tree

SCENARIOS = ["oom_kill", "cpu_saturation_leaf", "bad_deploy_leaf",
             "gcp_service_control", "singleton_node_notready"]
BUDGET = 4
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "runs", "numbers.json")


def _propose(model, temp=0.4):
    def fn(scenario, prior_feedback):
        return parse_plan(call(model, build_prompt(scenario, prior_feedback),
                               max_tokens=500, temperature=temp))
    return fn


def _grade(plan, scenario):
    sim = run_plan(plan, scenario)
    score, _ = score_plan(plan, scenario, sim, judge_fn=None)   # real LLM judge
    fc = failed_checks(plan, scenario, sim, judge_fn=None)
    return score, (not fc)


def naive_retry(scenario, model, budget=BUDGET):
    """Retry WITHOUT feedback (no learning) — count attempts to a clean win."""
    best = 0.0
    for i in range(budget):
        score, clean = _grade(_propose(model)(scenario, None), scenario)
        best = max(best, score)
        if clean:
            return {"clean_win": True, "attempts": i + 1, "best_score": round(best, 3)}
    return {"clean_win": False, "attempts": budget, "best_score": round(best, 3)}


def zero_shot(scenario, model):
    score, clean = _grade(_propose(model)(scenario, None), scenario)
    return {"clean_win": clean, "attempts": 1, "best_score": round(score, 3)}


def main() -> int:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    rows = []
    print(f"=== REx numbers — {len(SCENARIOS)} incidents, budget {BUDGET} ===\n")
    for name in SCENARIOS:
        sc = load_scenario(name)
        rex = rex_tree(sc, budget=BUDGET, propose_fn=_propose("claude-haiku-4-5"))  # real judge
        A = {"clean_win": rex["clean_win"], "attempts": len(rex["nodes"]),
             "best_score": rex["best_score"], "outcome": rex["outcome"]}
        B = naive_retry(sc, "claude-haiku-4-5")
        C = zero_shot(sc, "claude-opus-4-8")
        rows.append({"scenario": name, "haiku_rex": A, "haiku_naive": B, "opus_zeroshot": C})
        print(f"{name}:")
        print(f"  haiku+REx     clean={A['clean_win']} attempts={A['attempts']} "
              f"score={A['best_score']} outcome={A['outcome']}")
        print(f"  haiku naive   clean={B['clean_win']} attempts={B['attempts']} score={B['best_score']}")
        print(f"  opus 0-shot   clean={C['clean_win']} attempts={C['attempts']} score={C['best_score']}\n")

    # solvable = the 4 non-escalate incidents (singleton has no safe fix by design)
    solv = [r for r in rows if r["scenario"] != "singleton_node_notready"]
    def rate(rs, k): return round(sum(1 for r in rs if r[k]["clean_win"]) / len(rs), 2) if rs else 0
    def att(rs, k): return round(st.mean(r[k]["attempts"] for r in rs if r[k]["clean_win"]), 2) \
        if any(r[k]["clean_win"] for r in rs) else None
    summary = {
        "budget": BUDGET, "n_incidents": len(rows), "rows": rows,
        "solvable_clean_win_rate": {"haiku_rex": rate(solv, "haiku_rex"),
                                    "haiku_naive": rate(solv, "haiku_naive"),
                                    "opus_zeroshot": rate(solv, "opus_zeroshot")},
        "mean_attempts_to_clean_win": {"haiku_rex": att(solv, "haiku_rex"),
                                       "haiku_naive": att(solv, "haiku_naive")},
        "escalated_unsolvable": [r["scenario"] for r in rows
                                 if r["haiku_rex"]["outcome"] == "escalated"],
    }
    json.dump(summary, open(OUT, "w"), indent=2)
    print("=== HEADLINE ===")
    print(f"  solvable clean-win rate: haiku+REx {summary['solvable_clean_win_rate']['haiku_rex']} | "
          f"haiku naive {summary['solvable_clean_win_rate']['haiku_naive']} | "
          f"opus 0-shot {summary['solvable_clean_win_rate']['opus_zeroshot']}")
    print(f"  mean attempts to clean win: haiku+REx {summary['mean_attempts_to_clean_win']['haiku_rex']} | "
          f"haiku naive {summary['mean_attempts_to_clean_win']['haiku_naive']}")
    print(f"  REx escalated (no safe fix): {summary['escalated_unsolvable']}")
    print(f"  -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
