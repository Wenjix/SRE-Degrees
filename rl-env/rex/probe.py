"""Phase-1 / Part-A diagnostic-climb probe.

Easy probe (oom_kill) proved the SAFETY axis (trap removal). This probe tests the
DIAGNOSTIC axis on a HIDDEN-ROOT cascade (gcp_service_control): the loud 503s are
on product victims, the real root is the service-control control plane. Does haiku
climb wrong-hypothesis -> right via feedback, or plateau on the red herring?

Per iteration we log the model's STATED root cause, whether it's correct (real LLM
judge), the score, and resolved/clean-win — the diagnostic trajectory, not just score.

    python3 -m rex.probe                 # gcp_service_control (hidden root)
    python3 -m rex.probe oom_kill        # the easy baseline
"""
from __future__ import annotations

import json
import os
import statistics as st
import sys

from agent.llm import call
from rex.harness import load_scenario
from rex.loop import build_prompt, parse_plan, refine_loop

MODEL = "claude-haiku-4-5"
SEEDS = [1, 2, 3]
BUDGET = 6
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "runs")


def seeded_propose(seed: int, temperature: float = 0.6):
    def propose_fn(scenario, prior_feedback):
        prompt = build_prompt(scenario, prior_feedback) + f"\n\n(sampling variant: {seed})"
        return parse_plan(call(MODEL, prompt, max_tokens=600, temperature=temperature))
    return propose_fn


def main(argv: list) -> int:
    name = argv[0] if argv else "gcp_service_control"
    sc = load_scenario(name)
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"diagnostic_probe_{name}.jsonl")

    print(f"=== REx Part-A diagnostic-climb probe: {MODEL} on '{name}' "
          f"({len(SEEDS)} seeds x {BUDGET} iters) ===")
    print(f"hidden root = {sc.fault_node}  (gold: {sc.gold_root_description})\n")

    records, curves, first_correct = [], [], []
    with open(out_path, "w") as fh:
        for seed in SEEDS:
            res = refine_loop(sc, budget=BUDGET, propose_fn=seeded_propose(seed))  # real LLM judge
            print(f"seed {seed}:")
            print(f"  {'it':>2} {'diag?':>6} {'score':>6} {'resolved':>9}  stated root cause")
            fc_iter = None
            for it in res["iterations"]:
                ok = "OK" if it["diagnosis_correct"] else "WRONG"
                if it["diagnosis_correct"] and fc_iter is None:
                    fc_iter = it["iter"]
                cause = (it["stated_root_cause"] or "")[:64].replace("\n", " ")
                print(f"  {it['iter']:>2} {ok:>6} {it['score']:>6.2f} {str(it['resolved']):>9}  {cause}")
                rec = {"scenario": name, "seed": seed, "iter": it["iter"],
                       "stated_root_cause": it["stated_root_cause"],
                       "diagnosis_correct": it["diagnosis_correct"], "score": it["score"],
                       "resolved": it["resolved"], "failed_checks": it["failed_checks"],
                       "clean_win": not it["failed_checks"]}
                records.append(rec)
                fh.write(json.dumps(rec) + "\n")
            scores = [it["score"] for it in res["iterations"]]
            best, b = [], -1.0
            for s in scores:
                b = max(b, s); best.append(round(b, 3))
            while len(best) < BUDGET:
                best.append(best[-1])
            curves.append(best)
            first_correct.append(fc_iter)
            print(f"  -> first correct diagnosis @ iter {fc_iter}; clean_win={res['clean_win']}; "
                  f"best_score={res['best_score']}\n")

    # verdict
    agg = [round(st.mean(c[i] for c in curves), 3) for i in range(BUDGET)]
    started_wrong = sum(1 for r in records if r["seed"] in SEEDS and r["iter"] == 0
                        and not r["diagnosis_correct"])
    climbed = sum(1 for fc, c in zip(first_correct, [True] * len(SEEDS)) if fc is not None and fc > 0)
    plateaued = sum(1 for fc in first_correct if fc is None)
    print("=== aggregate best-score-so-far (mean over seeds) ===")
    print("  " + "  ".join(f"i{i}={agg[i]:.2f}" for i in range(BUDGET)))
    print(f"  seeds starting WRONG@iter0: {started_wrong}/{len(SEEDS)}  | "
          f"climbed wrong->right: {climbed}/{len(SEEDS)}  | "
          f"plateaued (never correct): {plateaued}/{len(SEEDS)}")
    if climbed >= 1 and started_wrong >= 1:
        verdict = "DIAGNOSTIC CLIMB ✅ (feedback corrects a wrong hypothesis)"
    elif plateaued == len(SEEDS):
        verdict = "PLATEAU ⚠️ (re-states a wrong cause every iter — feedback not steering diagnosis)"
    else:
        verdict = "INCONCLUSIVE (model got it right immediately — not a hidden-root test)"
    print(f"\nVERDICT: {verdict}")
    print(f"diagnostic trajectory -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
