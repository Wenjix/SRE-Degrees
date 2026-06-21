---
license: other
license_name: reddit-data-api-terms
license_link: https://redditinc.com/policies/data-api-terms
task_categories:
  - text-classification
  - question-answering
  - text-generation
tags:
  - reddit
  - sre
  - devops
  - kubernetes
  - incident-response
  - startups
size_categories:
  - 1K<n<10K
---

# Reddit SRE + Founder corpus (v2)

1475 unique posts scraped from 15 subreddits between 2013-06-14 and 2026-06-19. Built for product discovery on the Kubernetes Incident Autopilot hypothesis — agents that reason at inference time through incident diagnosis, with humans in an override loop.

## Subreddits (15)

SRE tier: r/sre, r/devops, r/kubernetes, r/sysadmin, r/aws, r/azure, r/gcp, r/programming, r/ExperiencedDevs, r/chaosengineering

Founder tier: r/Entrepreneur, r/startups, r/SaaS, r/IndieHackers, r/ycombinator

## Sources

Two scrape backends, both Pushshift-compatible JSON:
- **PullPush** (api.pullpush.io) — original 792 posts
- **Arctic Shift** (arctic-shift.photon-reddit.com) — recovered 683 previously-missing posts (the open successor to Pushshift, no auth required)

## Field schema

| field | type | notes |
|-------|------|-------|
| id | str | Reddit post ID |
| subreddit | str | lowercase canonical name |
| title | str | post title |
| selftext | str | body text (empty for link posts) |
| author | str | may be '[deleted]' |
| score | int | upvote count at scrape time |
| num_comments | int | comment count at scrape time |
| created_utc | int | unix timestamp |
| permalink | str | relative URL |
| url | str | external URL or self |
| domain | str | |
| is_self | bool | text post? |
| upvote_ratio | float | 0-1 |
| over_18 | bool | NSFW? |
| link_flair_text | str | sub-specific tag |
| _source | str | pullpush or arctic-shift |
| _fetched_at | int | unix timestamp of scrape |

## Use

```python
from datasets import load_dataset
ds = load_dataset("quantranger/reddit-sre-corpus", split="train")
```

## Companion files in this repo

- `synthesis_v2.md` — Claude Sonnet 4.5 product synthesis on the 80 highest-signal posts
- `eda_summary.md` — pain keywords, tool mentions, top posts
- `digest_top80.txt` — the prompt input fed to the LLM

## Compliance

PullPush and Arctic Shift are third-party archives of public Reddit data. Commercial use may require a separate agreement with Reddit (see https://redditinc.com/policies/data-api-terms).
