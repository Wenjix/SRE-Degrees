---
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
