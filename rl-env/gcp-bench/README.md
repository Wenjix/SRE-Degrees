# gcp-bench — Live RLVR scenarios on Google GKE

GCP port of `linode-bench`. Same Tier-B live bench from
[`docs/ENVIRONMENT_DESIGN.md`](../docs/ENVIRONMENT_DESIGN.md) §10, reproducing all
15 incident types on **GKE Standard** instead of Akamai LKE. Every cluster-agnostic
artifact (the 15 scenarios, `workloads.yaml`, `alerts.yaml`, kube-prometheus-stack,
Chaos Mesh, the preq runner, scenario runner, verifier, aggregator) is **byte-identical**
to `linode-bench` — only the provision / teardown / preflight / env layer changed
(`linode-cli lke` → `gcloud container clusters`).

Each scenario runs the **full loop**:

```
provision GKE cluster  →  install monitoring + chaos-mesh + preq
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
│              GCP project (zone us-central1-a)                  │
│                                                               │
│  GKE Standard cluster (3 × e2-standard-2, COS-containerd)     │
│  ├─ ns rlvr-target     ─ 16 mock service Deployments + redis  │
│  ├─ ns chaos-mesh      ─ Chaos Mesh (fault injection)         │
│  ├─ ns monitoring      ─ kube-prometheus-stack                │
│  │                        (Prometheus + Alertmanager + Grafana)│
│  └─ ns preq            ─ preq-runner (tails pod logs, runs    │
│                          CRE rules + runbook actions)          │
│                                                               │
│  Orchestrator (this Mac)                                     │
│  └─ gcp-bench/   ─  staged scripts that drive the cluster     │
└──────────────────────────────────────────────────────────────┘
```

## Why GKE **Standard** (not Autopilot)

Chaos Mesh installs a privileged `chaos-daemon` DaemonSet that mounts the host
containerd socket (`/run/containerd/containerd.sock`) to inject faults. Autopilot
forbids privileged/hostPath workloads, so it can't run Chaos Mesh. The default GKE
node image (`COS_CONTAINERD`) already exposes that socket — so stage 04 is unchanged
from `linode-bench`.

## One-time auth (you must do this — it's an interactive browser login)

The hackathon provisioned a **temporary** account with **$25** in credits. There is no
password-based CLI login for gcloud user accounts, so log in once in a browser:

```bash
gcloud auth login devstar4126@gcplab.me     # opens a browser; sign in with the temp creds
gcloud projects list                         # find the temp project id
export GCP_PROJECT=<temp-project-id>         # required by every stage
```

`env.sh` pins `CLOUDSDK_CORE_ACCOUNT=$GCP_ACCOUNT` (default `devstar4126@gcplab.me`) for
every command, so the bench targets the temp account even though your machine's default
gcloud account is something else. Your personal account is never billed.

## Layout

```
gcp-bench/
├── env.sh                # sourced everywhere (project/account, zone, node type, namespaces)
├── gcp/
│   ├── provision_gke.sh  # gcloud container clusters create + get-credentials
│   └── teardown_gke.sh   # gcloud container clusters delete
├── scenarios/
│   ├── registry.json     # all 15 incidents → fault / cre / metric / fix  (verbatim)
│   └── cre-*.yaml         # one CRE rule per incident (15 total)          (verbatim)
├── stages/               # 00..09 — each idempotent, gated by .done.<n>
│   ├── lib.sh            # shared helpers (kubectl, jq, status, require_gcloud)
│   ├── 00_preflight.sh   # verify gcloud auth + project + kubectl/helm/jq
│   ├── 01_provision_gke.sh  # create cluster via gcp/provision_gke.sh
│   ├── 02_deploy_workloads.sh   # 16 mock services + redis + a load-gen  (verbatim)
│   ├── 03_install_monitoring.sh # kube-prometheus-stack + alert rules     (verbatim)
│   ├── 04_install_chaos_mesh.sh # helm install chaos-mesh                 (verbatim)
│   ├── 05_install_preq.sh        # preq CLI + CRE rules + runbook actions (verbatim)
│   ├── 06_run_scenario.sh        # one scenario end-to-end                (verbatim)
│   ├── 07_verify.sh              # score with the RLVR reward             (verbatim)
│   └── 09_teardown.sh            # delete cluster
├── orchestrator/
│   ├── run_all.sh        # loops registry scenarios, aggregates results   (verbatim)
│   └── aggregate.py      # JSON → human + machine report                 (verbatim)
├── state/                # runtime: kubeconfig, .done.N markers
└── results/              # per-scenario JSON + aggregate.json
```

## Quickstart

```bash
source env.sh                                       # after exporting GCP_PROJECT
bash stages/00_preflight.sh                         # checks (no cost)

# one-shot full setup (asks once before billing starts)
bash stages/01_provision_gke.sh
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

## Knobs (override before sourcing `env.sh`, or export then re-source)

| var | default | meaning |
|-----|---------|---------|
| `GCP_PROJECT` | *(required)* | temp project id (`gcloud projects list`) |
| `GCP_ACCOUNT` | `devstar4126@gcplab.me` | account pinned for every gcloud/kubectl call |
| `ZONE` | `us-central1-a` | zonal cluster location |
| `NODE_TYPE` | `e2-standard-2` | node machine type (use `e2-medium` to trim cost) |
| `NODE_COUNT` | `3` | Chaos Mesh needs ≥3 for node spread + drain headroom |
| `DISK_SIZE_GB` | `32` | boot disk per node |
| `GKE_RELEASE_CHANNEL` | `regular` | version channel; set `GKE_VERSION` to pin exactly |

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

For every scenario the orchestrator confirms the chain fires, in order:

1. **Metric** — Prometheus scrapes the breach (`memory_util_pct > 90`)
2. **Alert** — Alertmanager sees the rule fire (queried via API)
3. **Detection** — preq tails pod logs, matches the CRE, prints the CRE ID
4. **Action** — preq runbook execs the fix command
5. **Recovery** — metric drops back under SLO; verifier returns reward=1

If any signal in the chain is missing, the scenario is logged with exactly which
link broke.

## Cost note

- 3 × `e2-standard-2` (us-central1) ≈ $0.20/hr + GKE cluster mgmt fee $0.10/hr ≈ **$0.30/hr**
- Single full sweep (~25–30 min) ≈ **$0.15** — comfortably inside the $25 credit
- `09_teardown.sh` always asks first to avoid accidental bills. **Delete the cluster
  when done** — an idle GKE cluster keeps billing.
