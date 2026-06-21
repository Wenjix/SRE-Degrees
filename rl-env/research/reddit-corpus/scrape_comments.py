#!/usr/bin/env python3
"""Scrape comments for the top 20 highest-signal pain posts via Arctic Shift."""
import json, subprocess, time
from pathlib import Path

OUT_DIR = Path("/Users/mei/rl/research/reddit-corpus")
targets = json.loads((OUT_DIR / "_top20_targets.json").read_text())

BASE = "https://arctic-shift.photon-reddit.com/api"


def fetch(url):
    r = subprocess.run(
        ["curl", "-sL", "--max-time", "25", "-A", "research-comments/1.0", url],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        return {"data": []}
    try:
        return json.loads(r.stdout)
    except:
        return {"data": []}


def scrape_post_comments(post_id: str, subreddit: str, limit: int = 100):
    """Arctic Shift comments endpoint takes link_id (with t3_ prefix)."""
    link_id = f"t3_{post_id}"
    url = f"{BASE}/comments/search?link_id={link_id}&limit={limit}"
    d = fetch(url)
    return d.get("data") or []


results = []
for t in targets:
    pid = t["id"]
    sub = t["subreddit"]
    title = t["title"][:60]
    print(f"[{t['score']:>5d}↑ {t['num_comments']:>3d}c] r/{sub} {title}...")
    comments = scrape_post_comments(pid, sub)
    print(f"    → {len(comments)} comments")
    for c in comments:
        results.append({
            "post_id": pid,
            "post_title": t["title"],
            "post_subreddit": sub,
            "comment_id": c.get("id"),
            "author": c.get("author"),
            "body": c.get("body", ""),
            "score": c.get("score", 0),
            "created_utc": c.get("created_utc"),
            "permalink": c.get("permalink"),
            "_source": "arctic-shift",
        })
    time.sleep(0.6)

# Write
out_path = OUT_DIR / "_top20_comments.jsonl"
with open(out_path, "w") as f:
    for r in results:
        f.write(json.dumps(r) + "\n")

print(f"\nWrote {len(results)} comments → {out_path}")

# Quick stats
authors = set(r["author"] for r in results if r["author"] and r["author"] != "[deleted]")
total_chars = sum(len(r["body"] or "") for r in results)
print(f"  Unique commenters: {len(authors)}")
print(f"  Total chars:       {total_chars:,}")
print(f"  Avg comment len:   {total_chars // len(results) if results else 0}")