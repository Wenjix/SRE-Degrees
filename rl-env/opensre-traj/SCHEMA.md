# opensre-traj — trajectory data standard

Trajectory data for the 15 infra-ops incidents, generated to the **opensre**
benchmark standard ([Tracer-Cloud/opensre](https://github.com/Tracer-Cloud/opensre),
`tests/synthetic/<provider>/<NNN-name>/`), **extended with remediation** (the
repo's FIREBALL `state_before → fix → state_after`).

opensre is a *diagnosis* benchmark: the agent reads read-only evidence via tools,
then emits a structured root-cause. We mirror that exactly and append the
remediation + recovery our live bench actually performs.

## A scenario = one folder

```
out/<synthetic|live>/k8s/<NNN>-<incident>[-<seed>]/
├── alert.json              # the trigger (opensre alert shape)
├── scenario.yml            # metadata (opensre)
├── <evidence>.json         # observable state, one file per read-tool
└── answer.yml              # ground truth (opensre) + remediation extension
```

Provider is `k8s` (our substrate is GKE + Prometheus, not opensre's EKS+Datadog),
so evidence/tool names use the `k8s_*` / `prometheus_*` convention.

### alert.json  (opensre shape)
```jsonc
{
  "title": "[synthetic-k8s] <symptom> — <pod>",
  "state": "alerting",
  "alert_source": "prometheus",
  "commonLabels":      { "alertname","severity","service","namespace",
                         "workload_type","workload_name","cluster_name" },
  "commonAnnotations": { "summary","description","error","suspected_symptom",
                         "k8s_failure_mode","context_sources" }
}
```

### scenario.yml  (opensre)
```yaml
base: 000-healthy
scenario_id: <NNN>-<incident>
failure_mode: <incident>            # e.g. oom_killed
severity: critical|warning
scenario_difficulty: 1..5
adversarial_signals: [ ... ]        # red herrings the agent must rule out
available_evidence: [ k8s_pods, k8s_events, k8s_pod_logs, k8s_node_health,
                      k8s_deployments, prometheus_metrics, prometheus_alerts, traces ]
```

### evidence files  (one per read-tool that returns it)
| file | produced by tool |
|---|---|
| `k8s_pods.json`        | `describe_pod` |
| `k8s_events.json`      | `get_events` |
| `k8s_pod_logs.json`    | `get_logs` |
| `k8s_node_health.json` | `get_node_status` |
| `k8s_deployments.json` | `get_deployment_status` |
| `prometheus_metrics.json` | `get_metrics` |
| `prometheus_alerts.json`  | `get_alerts` |
| `traces.json`             | `query_traces` |

Evidence is realistic but compact (≈2–4 pods, a few events/log lines). The
*smoking gun* lives in the evidence; `adversarial_signals` are benign facts that
look suspicious. Exactly one root cause is supported by the evidence.

### answer.yml  (opensre ground truth + remediation extension)
```yaml
root_cause_category: resource_exhaustion   # closed vocab (see below)
required_keywords:  [ ... ]                 # must appear in a correct diagnosis
forbidden_categories: [ ... ]
ruling_out_keywords: [ ... ]                # evidence that rules out red herrings
optimal_trajectory: [ describe_pod, get_events, get_logs ]   # gold READ sequence
required_queries:   [ describe_pod, get_logs ]
max_investigation_loops: 3
model_response: |
  ROOT_CAUSE: ...
  ROOT_CAUSE_CATEGORY: <category>
  VALIDATED_CLAIMS:
  - ... [evidence: k8s_pods]
  NON_VALIDATED_CLAIMS:
  - ...
  CAUSAL_CHAIN:
  - ...
# --- remediation extension (FIREBALL state_before -> fix -> state_after) ---
remediation:
  fix_tool: increase_memory_limit         # from the 25-tool registry
  canonical_fix: "kubectl ... / increase memory limit"
  trust_tier: autonomous|approval|blocked
  primary_metric: memory_util_pct
  direction: lower|higher
  state_before: { <metric>: <breached value> }
  state_after:  { <metric>: <healthy value> }
  recovery_check: "<metric> <op> <slo>"
  resolved: true
```

`root_cause_category` closed vocab: `resource_exhaustion`, `bad_deploy`,
`dependency_failure`, `network_fault`, `config_error`, `data_quality`,
`saturation`, `node_failure`, `healthy`, `unknown`.

## JSONL mirror (`out/trajectories.jsonl`)
One object per scenario, flattening the folder for training/eval:
```jsonc
{ "trajectory_id","provider","incident","scenario_id","difficulty",
  "alert": {...}, "scenario": {...}, "evidence": { "<file>": {...} },
  "answer": {...}, "remediation": {...},
  "trajectory": [ {role:"assistant", thought, action:{tool,args}},
                  {role:"tool", name, result:{success, state_diff}} , ... ],
  "source": "synthetic|live", "meta": {...} }
```
The `trajectory[]` is the rendered investigation (optimal_trajectory tools →
evidence reads) + the remediation step + `end_incident`, i.e. the same
alternating assistant/tool shape as the repo's FIREBALL SFT records.

## Spec packs (`specs/<incident>.json`)
The per-incident-type template the generator renders at scale. One file per
incident; carries the alert/scenario/evidence/answer/remediation above with
`{{PLACEHOLDER}}` tokens (service, namespace, pod ids, numbers) that
`generate.py` fills per seed to produce N variants.
