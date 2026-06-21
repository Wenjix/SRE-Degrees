#!/usr/bin/env python3
"""generate.py — render opensre-standard trajectory data from spec packs.

For every specs/<incident>.json, emit N variants:
  out/synthetic/k8s/<NNN>-<incident>[-sSEED]/{alert.json, scenario.yml,
                                              <evidence>.json, answer.yml}
and append one flattened record per variant to out/trajectories.jsonl.

Usage:
  python3 generate.py --n 20                 # 20 variants per incident
  python3 generate.py --n 1 --out out        # 1 canonical each
"""
import argparse
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib_opensre import subst_map, substitute, render_trajectory, TOOL_EVIDENCE  # noqa: E402

try:
    import yaml  # PyYAML (used by the bench already)
    HAVE_YAML = True
except Exception:
    HAVE_YAML = False

# canonical incident order -> NNN prefix (matches registry order)
ORDER = ["oom_kill", "cpu_saturation", "disk_pressure", "crashloop", "latency_spike",
         "dns_failure", "memory_leak", "cert_expiry", "cache_stampede", "upstream_5xx",
         "bad_deploy_errors", "db_pool_exhaustion", "node_not_ready", "consumer_lag", "stuck_rollout"]


def dump_yaml(obj, path):
    if HAVE_YAML:
        with open(path, "w") as f:
            yaml.safe_dump(obj, f, default_flow_style=False, sort_keys=False, allow_unicode=True, width=100)
    else:  # minimal fallback (block style, good enough for these shapes)
        with open(path, "w") as f:
            f.write(_yaml_min(obj, 0))


def _yaml_min(o, ind):
    pad = "  " * ind
    out = []
    if isinstance(o, dict):
        for k, v in o.items():
            if isinstance(v, (dict, list)) and v:
                out.append(f"{pad}{k}:")
                out.append(_yaml_min(v, ind + 1))
            elif isinstance(v, str) and "\n" in v:
                out.append(f"{pad}{k}: |")
                out += [f"{pad}  {ln}" for ln in v.splitlines()]
            else:
                out.append(f"{pad}{k}: {json.dumps(v) if not isinstance(v, str) else v}")
    elif isinstance(o, list):
        for v in o:
            if isinstance(v, (dict, list)) and v:
                out.append(f"{pad}-")
                out.append(_yaml_min(v, ind + 1))
            else:
                out.append(f"{pad}- {json.dumps(v) if not isinstance(v, str) else v}")
    return "\n".join(out) + ("\n" if ind == 0 else "")


def render_one(spec, incident, nnn, seed, out_root, jsonl_fh, source="synthetic"):
    m = subst_map(spec, incident, seed)
    s = substitute(spec, m)  # concrete copy

    name = f"{nnn:03d}-{incident}" + ("" if seed == 0 else f"-s{seed:03d}")
    folder = os.path.join(out_root, source, "k8s", name)
    os.makedirs(folder, exist_ok=True)

    # alert.json
    alert = s["alert"]
    with open(os.path.join(folder, "alert.json"), "w") as f:
        json.dump(alert, f, indent=2)

    # scenario.yml
    scenario = {
        "base": "000-healthy",
        "scenario_id": name,
        "failure_mode": s.get("failure_mode", incident),
        "severity": s.get("default_severity", "critical"),
        "scenario_difficulty": s.get("scenario_difficulty", 2),
        "adversarial_signals": s.get("scenario", {}).get("adversarial_signals", []),
        "available_evidence": s.get("scenario", {}).get("available_evidence", []),
        "source": source,
    }
    dump_yaml(scenario, os.path.join(folder, "scenario.yml"))

    # evidence files
    evidence = s.get("evidence", {})
    for fname, content in evidence.items():
        with open(os.path.join(folder, fname), "w") as f:
            json.dump(content, f, indent=2)

    # answer.yml (opensre ground truth + remediation extension)
    ans = dict(s.get("answer", {}))
    ans["remediation"] = s.get("remediation", {})
    dump_yaml(ans, os.path.join(folder, "answer.yml"))

    # JSONL mirror
    rec = {
        "trajectory_id": f"{incident}_{seed:04d}",
        "provider": "k8s",
        "incident": incident,
        "scenario_id": name,
        "difficulty": scenario["scenario_difficulty"],
        "source": source,
        "alert": alert,
        "scenario": scenario,
        "evidence": evidence,
        "answer": s.get("answer", {}),
        "remediation": s.get("remediation", {}),
        "trajectory": render_trajectory(s, m),
        "meta": {"failure_mode": scenario["failure_mode"],
                 "root_cause_category": s.get("answer", {}).get("root_cause_category"),
                 "root_cause_subtype": s.get("answer", {}).get("root_cause_subtype"),
                 "fix_tool": s.get("remediation", {}).get("fix_tool"),
                 "trap_actions": s.get("remediation", {}).get("trap_actions", []),
                 "source_company": s.get("source_company"),
                 "source_url": s.get("source_url")},
    }
    jsonl_fh.write(json.dumps(rec) + "\n")
    return name


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--specs", default=os.path.join(HERE, "specs"))
    ap.add_argument("--out", default=os.path.join(HERE, "out"))
    ap.add_argument("--n", type=int, default=10, help="variants per incident")
    args = ap.parse_args()

    spec_paths = sorted(glob.glob(os.path.join(args.specs, "*.json")))
    if not spec_paths:
        sys.exit(f"no spec packs in {args.specs} — run the spec-authoring step first")

    os.makedirs(args.out, exist_ok=True)
    jsonl_path = os.path.join(args.out, "trajectories.jsonl")
    counts, total = {}, 0
    with open(jsonl_path, "w") as jf:
        for p in spec_paths:
            try:
                spec = json.load(open(p))
            except Exception as e:
                print(f"  ! skip {os.path.basename(p)}: bad JSON ({e})")
                continue
            inc = spec.get("incident") or os.path.basename(p)[:-5]
            nnn = (ORDER.index(inc) + 1) if inc in ORDER else (len(ORDER) + 1)
            for seed in range(args.n):
                render_one(spec, inc, nnn, seed, args.out, jf)
                total += 1
            counts[inc] = args.n

        # real-world incident packs (specs/real/*.json) — 1 canonical each, source="real"
        real_paths = sorted(glob.glob(os.path.join(args.specs, "real", "*.json")))
        real_n = 0
        for p in real_paths:
            try:
                spec = json.load(open(p))
            except Exception as e:
                print(f"  ! skip real/{os.path.basename(p)}: bad JSON ({e})")
                continue
            inc = spec.get("incident") or os.path.basename(p)[:-5]
            base = os.path.basename(p)
            nnn = 100 + (int(base[:2]) if base[:2].isdigit() else 0)  # 101..119
            render_one(spec, inc, nnn, 0, args.out, jf, source="real")
            real_n += 1

    print(f"wrote {total} synthetic + {real_n} real = {total + real_n} scenarios -> {args.out}/{{synthetic/,real/,trajectories.jsonl}}")
    for inc in ORDER:
        if inc in counts:
            print(f"  {inc:20} x{counts[inc]}")
    print(f"JSONL: {jsonl_path}")


if __name__ == "__main__":
    main()
