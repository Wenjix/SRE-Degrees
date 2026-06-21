# Source this:  source /Users/mei/rl/linode-bench/env.sh
export ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export STATE_DIR="$ROOT/state"
export RESULTS_DIR="$ROOT/results"
export SCENARIOS_DIR="$ROOT/scenarios"

# ---------- Cluster defaults (override before running a stage) ----------
# Three nodes is the floor for Chaos Mesh (need scheduler spread + room to
# actually drain a node without killing the workload). g6-standard-2 = 2 vCPU
# / 4 GB — cheapest that fits kube-prometheus-stack + 16 mock service pods.
export LKE_LABEL="${LKE_LABEL:-rlvr-bench}"
export REGION="${REGION:-us-ord}"
export LKE_K8S_VERSION="${LKE_K8S_VERSION:-1.31}"
export NODE_TYPE="${NODE_TYPE:-g6-standard-2}"
export NODE_COUNT="${NODE_COUNT:-3}"

# Namespaces the test bench owns (kept tidy by teardown)
export NS_TARGET="${NS_TARGET:-rlvr-target}"
export NS_CHAOS="${NS_CHAOS:-chaos-mesh}"
export NS_MON="${NS_MON:-monitoring}"
export NS_PREQ="${NS_PREQ:-preq}"

# Polling
export PROBE_TIMEOUT_S="${PROBE_TIMEOUT_S:-300}"    # cluster ready / ssh timeout
export SCENARIO_WAIT_S="${SCENARIO_WAIT_S:-90}"     # how long to wait per scenario for alert+recovery

# Where the kubeconfig lives (created by stage 01)
export KUBECONFIG="${KUBECONFIG:-$STATE_DIR/lke-kubeconfig.yaml}"
export PATH="$ROOT/bin:$PATH"