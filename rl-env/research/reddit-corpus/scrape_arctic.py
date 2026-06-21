#!/usr/bin/env python3
"""
Arctic Shift scraper (curl-backed) for the subreddits that failed on PullPush.

Why curl instead of urllib: this machine's bundled Python SSL doesn't trust the
arctic-shift.photon-reddit.com cert chain (same family of CloudFront-fronted APIs
that broke Cartesia). curl has its own cert store and works.

Outputs: appends to existing .jsonl files in same schema as PullPush corpus.
"""
import json
import os
import subprocess
import time
from pathlib import Path

BASE = "https://arctic-shift.photon-reddit.com/api"
OUT_DIR = Path("/Users/mei/rl/research/reddit-corpus")

TARGET_SUBS = [
    "kubernetes", "sysadmin", "gcp", "chaosengineering",
    "ycombinator", "SaaS", "IndieHackers",
]

PAGES_PER_SUB = 1
SLEEP_BETWEEN = 0.8

KEEP = [
    "id", "name", "subreddit", "subreddit_id", "author", "author_fullname",
    "title", "selftext", "url", "permalink", "domain", "is_self",
    "score", "ups", "downs", "upvote_ratio", "num_comments", "total_awards_received",
    "created_utc", "created", "edited", "over_18", "spoiler", "stickied",
    "link_flair_text", "link_flair_css_class",
]


def fetch_json(url: str) -> dict:
    r = subprocess.run(
        ["curl", "-sL", "--max-time", "25", "-A", "research-arctic/1.0", url],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        raise RuntimeError(f"curl rc={r.returncode}: {r.stderr[:200]}")
    return json.loads(r.stdout)


def normalize_post(raw: dict) -> dict:
    out = {k: raw.get(k) for k in KEEP if k in raw}
    out["_source"] = "arctic-shift"
    out["_fetched_at"] = time.time()
    return out


def scrape_sub(sub: str) -> list[dict]:
    rows = []
    url = f"{BASE}/posts/search?subreddit={sub}&limit=100&sort=desc&sort_type=created_utc"
    print(f"  GET {url}")
    d = fetch_json(url)
    data = d.get("data", [])
    rows.extend(normalize_post(p) for p in data)
    print(f"    → {len(data)} posts (latest created_utc: {data[0].get('created_utc') if data else 'n/a'})")
    return rows


def main():
    summary = {}
    for sub in TARGET_SUBS:
        print(f"\n=== {sub} ===")
        try:
            posts = scrape_sub(sub)
        except Exception as e:
            print(f"  FAILED: {e}")
            summary[sub] = {"error": str(e)[:120]}
            time.sleep(SLEEP_BETWEEN)
            continue
        if not posts:
            summary[sub] = {"posts": 0}
            time.sleep(SLEEP_BETWEEN)
            continue
        out_path = OUT_DIR / f"{sub}.jsonl"
        mode = "a" if out_path.exists() else "w"
        existing = sum(1 for _ in open(out_path)) if mode == "a" else 0
        with open(out_path, mode) as f:
            for p in posts:
                f.write(json.dumps(p) + "\n")
        print(f"  wrote {len(posts)} → {out_path} (mode={mode}, was {existing}, now {existing + len(posts)})")
        summary[sub] = {"new": len(posts), "mode": mode, "was": existing, "total": existing + len(posts)}
        time.sleep(SLEEP_BETWEEN)

    print("\n\n========== SUMMARY ==========")
    for s, r in summary.items():
        print(f"  {s:20s} {r}")


if __name__ == "__main__":
    main()