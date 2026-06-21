"""REx proper: Thompson-sampling tree over candidate refinements.

Each candidate is a node with a Beta posterior; we Thompson-sample which node to
refine next, expand it (propose with that node's feedback), and score the child.
Clean win -> resolved; budget exhausted -> escalate. Deterministic under a seed
(seeded RNG + injected proposer/judge).
"""
from rex.harness import load_scenario
from rex.tree import rex_tree

SC = load_scenario("oom_kill")
CLEAN = {"root_cause": "memory leak; OOMKilled on image-resizer, RSS over limit",
         "actions": [{"tool": "increase_memory_limit", "args": {"target": "image-resizer", "mem_limit_mb": 1024}},
                     {"tool": "restart_pod", "args": {"target": "image-resizer"}}]}
TRAP = {"root_cause": "too few replicas",
        "actions": [{"tool": "scale_deployment", "args": {"target": "image-resizer", "replicas": 6}}]}


def _judge(stated, gold, herrings):
    return any(k in stated.lower() for k in ("memory", "leak", "oom", "rss"))


def test_tree_resolves_when_root_is_clean():
    res = rex_tree(SC, budget=6, propose_fn=lambda sc, fb: CLEAN, judge_fn=_judge, seed=1)
    assert res["outcome"] == "resolved"
    assert len(res["nodes"]) == 1            # clean at the root -> no expansion needed


def test_tree_climbs_to_clean_via_refinement():
    def climber(sc, prior):
        return CLEAN if (prior and "increase_memory_limit" in prior) else TRAP
    res = rex_tree(SC, budget=6, propose_fn=climber, judge_fn=_judge, seed=1)
    assert res["outcome"] == "resolved"
    assert res["best_score"] > res["nodes"][0]["score"]   # best climbed above the root


def test_tree_escalates_when_never_clean_and_explores_full_budget():
    res = rex_tree(SC, budget=5, propose_fn=lambda sc, fb: TRAP, judge_fn=_judge, seed=1)
    assert res["outcome"] == "escalated"
    assert len(res["nodes"]) == 5            # no clean win -> spends the budget exploring
    assert "escalation" in res


def test_tree_nodes_form_a_tree_with_parents():
    res = rex_tree(SC, budget=4, propose_fn=lambda sc, fb: TRAP, judge_fn=_judge, seed=3)
    assert res["nodes"][0]["parent"] is None              # root
    assert all(n["parent"] is not None for n in res["nodes"][1:])   # every other node has a parent
    assert all(0 <= n["parent"] < n["node"] for n in res["nodes"][1:])


def test_tree_is_deterministic_under_a_seed():
    mk = lambda: rex_tree(SC, budget=5, propose_fn=lambda sc, fb: TRAP, judge_fn=_judge, seed=7)
    a, b = mk(), mk()
    assert [n["parent"] for n in a["nodes"]] == [n["parent"] for n in b["nodes"]]
    assert a["best_score"] == b["best_score"]


def test_best_score_is_monotone_vs_root():
    res = rex_tree(SC, budget=6, propose_fn=lambda sc, fb: TRAP, judge_fn=_judge, seed=2)
    assert res["best_score"] >= res["nodes"][0]["score"]
