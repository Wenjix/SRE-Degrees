"""Frontier sweep — does REx (Thompson-tree refinement) lift a FROZEN model above
its own zero-shot baseline, across many frontier models and one shared substrate?

Two conditions per (model, incident), graded by the SAME root-cause-aware reward:
  baseline : the model answers ONCE (zero-shot)                  -> grade
  rex      : the same model inside the REx tree (propose -> harness feedback ->
             refine, with the safety gate), budget BUDGET        -> best node's grade

The model is frozen and swappable (agent/models.py); REx is the only thing added.
Cross-provider frontier models route through the HUD inference gateway (one key).

    HUD_API_KEY=... python3 -m rex.frontier        # writes rex/runs/frontier.json
"""
from __future__ import annotations

import json
import os
import statistics as st
import traceback

from agent.llm import call
from rex.harness import load_scenario, run_plan
from rex.loop import build_prompt, parse_plan
from rex.scoring import score_plan
from rex.tree import rex_tree

SCENARIOS = ["oom_kill", "cpu_saturation_leaf", "bad_deploy_leaf",
             "gcp_service_control", "singleton_node_notready"]
MODELS = ["claude-haiku-4-5", "claude-opus-4-8",
          "gpt-5.5", "gemini-3.1-pro", "deepseek-v4-pro"]
BUDGET = 3
MAX_TOKENS = 4000   # headroom so reasoning models aren't truncated before the JSON plan
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "runs", "frontier.json")


def _propose(model):
    def fn(scenario, prior_feedback):
        return parse_plan(call(model, build_prompt(scenario, prior_feedback),
                               max_tokens=MAX_TOKENS))
    return fn


def _grade(plan, scenario) -> float:
    sim = run_plan(plan, scenario)
    score, _ = score_plan(plan, scenario, sim, judge_fn=None)   # real haiku judge
    return score


def run_model(model: str) -> dict:
    propose = _propose(model)
    base, rex = [], []
    for name in SCENARIOS:
        sc = load_scenario(name)
        try:
            b = _grade(propose(sc, None), sc)                    # zero-shot baseline
        except Exception as e:
            print(f"  [{model}] {name} baseline ERR: {e}"); b = None
        try:
            tree = rex_tree(sc, budget=BUDGET, propose_fn=propose)
            r = tree["best_score"]
        except Exception as e:
            print(f"  [{model}] {name} rex ERR: {e}"); traceback.print_exc(); r = None
        base.append(b); rex.append(r)
        bs = "ERR" if b is None else f"{b:.3f}"
        rs = "ERR" if r is None else f"{r:.3f}"
        print(f"  [{model}] {name:24} baseline={bs}  rex={rs}")
    bv = [x for x in base if x is not None]
    rv = [x for x in rex if x is not None]
    bm = round(st.mean(bv), 3) if bv else None
    rm = round(st.mean(rv), 3) if rv else None
    return {
        "model": model, "per_scenario": dict(zip(SCENARIOS, zip(base, rex))),
        "baseline_mean": bm, "rex_mean": rm,
        "lift": round(rm - bm, 3) if (bm is not None and rm is not None) else None,
        "baseline_clean_wins": sum(1 for x in bv if x >= 0.999),
        "rex_clean_wins": sum(1 for x in rv if x >= 0.999),
    }


def main() -> int:
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    print(f"=== Frontier REx-vs-baseline — {len(MODELS)} models x {len(SCENARIOS)} "
          f"incidents, REx budget {BUDGET} ===\n")
    rows = []
    for m in MODELS:
        print(f"--- {m} ---")
        rows.append(run_model(m))
        print()
    summary = {"budget": BUDGET, "scenarios": SCENARIOS, "models": rows}
    json.dump(summary, open(OUT, "w"), indent=2)

    print("=== HEADLINE: baseline -> REx (lift) ===")
    print(f"  {'model':18} {'baseline':>9} {'REx':>7} {'lift':>7}  clean(base->rex)")
    for r in rows:
        bm = "  ERR" if r["baseline_mean"] is None else f"{r['baseline_mean']:.3f}"
        rm = "  ERR" if r["rex_mean"] is None else f"{r['rex_mean']:.3f}"
        lf = "  ERR" if r["lift"] is None else f"{r['lift']:+.3f}"
        print(f"  {r['model']:18} {bm:>9} {rm:>7} {lf:>7}   "
              f"{r['baseline_clean_wins']}/{len(SCENARIOS)} -> {r['rex_clean_wins']}/{len(SCENARIOS)}")
    print(f"\n  -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
