# linode-bench — Live RLVR scenarios on Akamai LKE

Real-infrastructure test bench for all 15 incident types in
`/Users/mei/rl/sim/cluster.py`. Each scenario runs the **full loop**:

```
provision LKE cluster  →  install monitoring + chaos-mesh + preq
    → deploy target workloads (16 mock services)
        → inject fault (Chaos Mesh / kubectl / pod-exec)
            → metric crosses SLO  →  Prometheus alert fires  →  preq CRE fires
                → runbook action runs (the fix)
                    → metric returns under SLO  →  verifier scores reward=1
                        → teardown cluster (stops billing)
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Linode region (us-ord)                       │
│                                                               │
│  LKE cluster (3 × g6-standard-2, k8s 1.31)                    │
│  ├─ ns rlvr-target     ─ 16 mock service Deployments + redis  │
│  ├─ ns chaos-mesh      ─ Chaos Mesh (fault injection)         │
│  ├─ ns monitoring      ─ kube-prometheus-stack                │
│  │                        (Prometheus + Alertmanager + Grafana)│
│  └─ ns preq            ─ preq-runner (DaemonSet tails pod     │
│                          logs, runs CRE rules + actions)       │
│                                                               │
│  Orchestrator (this Mac)                                      │
│  └─ linode-bench/   ─  staged scripts that drive the cluster  │
└──────────────────────────────────────────────────────────────┘
```

## Layout

```
linode-bench/
├── env.sh                # sourced everywhere (paths, region, namespaces)
├── scenarios/
│   ├── registry.json     # all 15 incidents → fault / cre / metric / fix
│   └── cre-*.yaml        # one CRE rule per incident (15 total)
├── stages/               # 00..09 — each idempotent, gated by .done.<n>
│   ├── lib.sh            # shared helpers (kubectl, jq, status)
│   ├── 00_preflight.sh   # verify linode-cli, kubectl, helm, jq
│   ├── 01_provision_lke.sh  # create cluster via existing provision_lke.sh
│   ├── 02_deploy_workloads.sh  # 16 mock services + redis + a load-gen
│   ├── 03_install_monitoring.sh  # kube-prometheus-stack + alert rules
│   ├── 04_install_chaos_mesh.sh  # helm install chaos-mesh
│   ├── 05_install_preq.sh        # preq CLI + CRE rules + runbook actions
│   ├── 06_run_scenario.sh        # one scenario end-to-end
│   ├── 07_verify.sh              # score with rl/verify/score.py
│   └── 09_teardown.sh            # delete cluster
├── orchestrator/
│   ├── run_all.sh        # loops registry scenarios, aggregates results
│   └── aggregate.py      # JSON → human + machine report
├── state/                # runtime: kubeconfig, .done.N markers
└── results/              # per-scenario JSON + aggregate.json
```

## Quickstart

```bash
source env.sh
bash stages/00_preflight.sh                         # checks (no cost)

# one-shot full setup (asks once before billing starts)
bash stages/01_provision_lke.sh
bash stages/02_deploy_workloads.sh
bash stages/03_install_monitoring.sh
bash stages/04_install_chaos_mesh.sh
bash stages/05_install_preq.sh

# run one scenario
SCENARIO=oom_kill bash stages/06_run_scenario.sh

# or run all 15, aggregated
bash orchestrator/run_all.sh

# stop billing
bash stages/09_teardown.sh
```

Each stage is idempotent — re-running is a no-op if its `.done.N` marker exists.

## All 15 scenarios

| #  | incident            | fault vector                                | fix (runbook)             |
|----|---------------------|---------------------------------------------|---------------------------|
| 1  | oom_kill            | Chaos Mesh StressChaos (memory)             | kubectl scale + restart   |
| 2  | cpu_saturation      | Chaos Mesh StressChaos (cpu)                | kubectl scale             |
| 3  | disk_pressure       | kubectl exec dd fill / IOChaos              | kubectl exec rm + restart |
| 4  | crashloop           | Chaos Mesh PodChaos (kill)                  | kubectl rollout undo      |
| 5  | latency_spike       | Chaos Mesh NetworkChaos (delay)             | NetworkChaos delete       |
| 6  | dns_failure         | Chaos Mesh NetworkChaos (corrupt dns)       | NetworkChaos delete       |
| 7  | memory_leak         | sidecar leaky pod                           | kubectl delete pod        |
| 8  | cert_expiry         | mount expired cert + restart                | mount good cert + restart |
| 9  | cache_stampede      | redis FLUSHALL + burst load                 | redis warm-up             |
| 10 | upstream_5xx        | upstream returns 503                        | kill bad upstream pod     |
| 11 | bad_deploy_errors   | kubectl set image:bad                       | kubectl rollout undo      |
| 12 | db_pool_exhaustion  | open 120 sqlite conns via pod-exec          | kill leaking pod          |
| 13 | node_not_ready      | kubectl cordon + drain                      | uncordon                  |
| 14 | consumer_lag        | kafka/redis producer flood                  | scale consumers           |
| 15 | stuck_rollout       | kubectl set image:bad + progressDeadline=1s | kubectl rollout undo      |

## Signal flow we verify

For every scenario the orchestrator confirms all 4 signals fire, in order:

1. **Metric** — Prometheus scrapes the breach (`memory_util_pct > 90`)
2. **Alert** — Alertmanager sees the rule fire (queried via API)
3. **Detection** — preq tails pod logs, matches the CRE, prints the CRE ID
4. **Action** — preq runbook execs the fix command
5. **Recovery** — metric drops back under SLO; `rl/verify/score.py` returns reward=1

If any signal in the chain is missing, the scenario is logged with exactly
which link broke.

## Cost note

- 3 × `g6-standard-2` LKE nodes = $0.108/hr (~$0.05 per 30 min)
- Single full sweep (~25 min) ≈ **$0.05**
- Pre-emptible spot-style teardown if a stage fails: `09_teardown.sh` always
  asks first to avoid accidental bills.