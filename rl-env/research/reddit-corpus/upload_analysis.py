"""Bundle the v2 analysis artifacts (EDA + digest + synthesis) and upload as a second dataset."""
import subprocess
from pathlib import Path

REPO2 = "quantranger/reddit-sre-corpus-analysis"

src_dir = Path("/Users/mei/rl/research/reddit-corpus")
files = [
    ("synthesis_v2.md", "LLM synthesis (Claude Sonnet 4.5) on the 80 highest-signal posts"),
    ("digest_top80.txt", "Top-80 post digest used as the synthesis prompt"),
]

# 1. Upload files
for fname, _ in files:
    r = subprocess.run(
        ["hf", "upload", REPO2,
         str(src_dir / fname),
         fname,
         "--repo-type", "dataset",
         "--commit-message", f"Add {fname} (v2 corpus analysis)"],
        capture_output=True, text=True
    )
    print(f"{fname}: rc={r.returncode}, {r.stdout.strip()[:100]}")
    if r.returncode != 0:
        print(f"  STDERR: {r.stderr[-500:]}")

# 2. README for the analysis repo
readme = """---
license: other
license_name: reddit-data-api-terms
license_link: https://redditinc.com/policies/data-api-terms
tags:
  - reddit
  - sre
  - devops
  - kubernetes
  - incident-response
  - product-discovery
  - llm-synthesis
---

# Reddit SRE Corpus — Analysis Bundle (v2)

Companion artifacts for [quantranger/reddit-sre-corpus](https://huggingface.co/datasets/quantranger/reddit-sre-corpus) (1,475 posts across 15 subreddits, 2013-2026).

## Files

- **`synthesis_v2.md`** (~13k chars) — Claude Sonnet 4.5 synthesis: 5 pain clusters, trust dynamics, tool landscape, buyer signal, risks, GTM. Cites post IDs from `digest_top80.txt`.
- **`digest_top80.txt`** (~33k chars) — the 80 highest-signal posts used as the synthesis prompt (selected by pain-keyword frequency × upvote weight).

## Top-line findings

1. **Pain lives in the diagnosis tax** — engineers describe "wasting engineering time investigating incidents" as the dominant toil, not the actual fix
2. **Trust is the gating factor** — multiple posts cite AI doing diagnosis correctly but humans refusing to act on it (override loop)
3. **Buyer signal is strong in r/sre, r/devops, r/kubernetes** — senior engineers with budget authority describing daily pain
4. **Competitive gap** — no post mentions a product that combines diagnosis + override-as-training-signal

## Methodology

1. Scraped 15 subreddits via PullPush (792 posts) + Arctic Shift (683 posts)
2. Scored posts by pain-keyword frequency × upvote weight (community validation)
3. Top 80 → fed to Claude Sonnet 4.5 with product hypothesis: "Kubernetes Incident Autopilot"
4. Synthesis covers pain, trust, tools, buyer signal, risks, GTM

## Reproduce

```bash
git clone https://huggingface.co/datasets/quantranger/reddit-sre-corpus
python -c "from datasets import load_dataset; ds = load_dataset('quantranger/reddit-sre-corpus', split='train')"
```
"""

src_dir.joinpath("v2_ANALYSIS_README.md").write_text(readme)
r = subprocess.run(
    ["hf", "upload", REPO2,
     str(src_dir / "v2_ANALYSIS_README.md"),
     "README.md",
     "--repo-type", "dataset",
     "--commit-message", "Add README for v2 analysis bundle"],
    capture_output=True, text=True
)
print(f"README: rc={r.returncode}, {r.stdout.strip()[:100]}")

# 3. Make both datasets public
print("\n=== Flipping repos to public ===")
for repo in [REPO2, "quantranger/reddit-sre-corpus"]:
    r = subprocess.run(["hf", "repo", "settings", "--visibility", "public", "--repo-type", "dataset", repo],
                       capture_output=True, text=True)
    print(f"{repo}: rc={r.returncode}, {r.stdout.strip()[:100]}")
    if r.returncode != 0:
        print(f"  STDERR: {r.stderr[-300:]}")