// Generates lib/cidg/voices.ts — the frozen "Voice of the Buyer" reddit research
// subset that powers VoicesLens. Re-run after the EDA changes:
//   node scripts/gen-cidg-voices.mjs
//
// Source of truth (committed under rl-env/research):
//   eda/keyword_frequency.json  — pain_keyword_counts + tool_mention_counts
//   eda/corpus_stats.json       — totals, subreddits{}, top_authors{}, score_stats
//   eda/time_series.json        — activity by month, by_subreddit{} and by_tier{}
//   reddit-corpus/v2_corpus.csv — full post corpus (used to pull on-topic posts)
//
// The dashboard is 100% client-side, so we freeze a compact, render-ready TS
// module rather than read JSON/CSV at runtime. NUMBERS here are MEASURED from the
// EDA artifacts; the leaderboard + quote selection is a CURATED subset (the
// incident/reliability-relevant posts, since the global top-50 is r/programming
// drama). Every quote keeps its real subreddit + score + permalink.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EDA = join(ROOT, "rl-env/research/eda");
const OUT = join(ROOT, "lib/cidg/voices.ts");

const kf = JSON.parse(readFileSync(join(EDA, "keyword_frequency.json"), "utf8"));
const cs = JSON.parse(readFileSync(join(EDA, "corpus_stats.json"), "utf8"));
const ts = JSON.parse(readFileSync(join(EDA, "time_series.json"), "utf8"));

// --- pain keywords (measured) ----------------------------------------------
const painKeywords = Object.entries(kf.pain_keyword_counts)
	.map(([term, count]) => ({ term, count }))
	.sort((a, b) => b.count - a.count);

// --- tool mentions (measured) ----------------------------------------------
// A small editorial "note" flags the surprises the pain synthesis calls out:
// Pulumi at 51% of Terraform's mentions; PagerDuty surprisingly low vs Rootly.
const TOOL_NOTE = {
	terraform: "IaC incumbent",
	pulumi: "51% of Terraform — live challenger, not noise",
	kubernetes: "orchestration won; debate moved to how",
	docker: "containerization assumed",
	rootly: "emerging incident-mgmt vendor signal",
	pagerduty: "surprisingly low for the on-call incumbent",
	datadog: "commercial observability leader",
	jenkins: "mentions skew 'migrate away'",
	gitlab: "54% above Jenkins — greenfield momentum",
};
const TOOL_CATEGORY = {
	terraform: "iac", pulumi: "iac", ansible: "iac", puppet: "iac", chef: "iac",
	kubernetes: "orchestration", k8s: "orchestration", docker: "orchestration",
	helm: "orchestration", argo: "orchestration", argocd: "orchestration",
	flux: "orchestration", istio: "orchestration",
	gitlab: "ci/cd", jenkins: "ci/cd", "github actions": "ci/cd",
	circleci: "ci/cd", spinnaker: "ci/cd",
	datadog: "observability", prometheus: "observability", grafana: "observability",
	elastic: "observability", splunk: "observability", tempo: "observability",
	loki: "observability", dynatrace: "observability", newrelic: "observability",
	sentry: "observability", cloudwatch: "observability", kibana: "observability",
	signoz: "observability", victoriametrics: "observability", highlight: "observability",
	"azure monitor": "observability", fluentd: "observability",
	rootly: "incident", pagerduty: "incident", victorops: "incident", litmus: "incident",
	openai: "ai", "gpt-4": "ai", "gpt-4o": "ai", cursor: "ai", copilot: "ai",
	claude: "ai", devin: "ai",
};
const toolMentions = Object.entries(kf.tool_mention_counts)
	.map(([tool, count]) => ({
		tool,
		count,
		category: TOOL_CATEGORY[tool] ?? "other",
		note: TOOL_NOTE[tool] ?? null,
	}))
	.sort((a, b) => b.count - a.count);

// --- subreddits (measured) -------------------------------------------------
const subreddits = Object.entries(cs.subreddits)
	.map(([name, posts]) => ({ name, posts }))
	.sort((a, b) => b.posts - a.posts);

// --- monthly time series by tier (measured) --------------------------------
// Collapse by_tier into a sorted union of YYYY-MM buckets so the chart can plot
// 3 aligned series (startup / sre / sre-cloud) over one shared month axis.
const tierKeys = Object.keys(ts.by_tier); // startup, sre, sre-cloud
const monthSet = new Set();
for (const t of tierKeys) for (const m of Object.keys(ts.by_tier[t])) monthSet.add(m);
const months = [...monthSet].sort();
const tierSeries = tierKeys.map((tier) => ({
	tier,
	points: months.map((m) => ts.by_tier[tier][m] ?? 0),
}));

// --- corpus stats (measured) -----------------------------------------------
const stats = {
	totalPosts: cs.total_posts,
	totalComments: cs.total_comments,
	subredditCount: subreddits.length,
	earliest: cs.earliest_human.slice(0, 10),
	latest: cs.latest_human.slice(0, 10),
	scoreMean: cs.score_stats.mean,
	scoreMedian: cs.score_stats.median,
	scoreMax: cs.score_stats.max,
};

// --- curated incident/reliability leaderboard (CURATED subset) -------------
// Hand-picked from the full corpus: the posts whose title/body are about
// outages, on-call, postmortems, production safety — the actual voice of the
// buyer for an incident-response product. The global top-50 (top_posts.json) is
// r/programming drama, so it is NOT used here. Score + permalink are MEASURED.
const topPosts = [
	{ id: "uqrwq2", subreddit: "devops", score: 351, comments: 108, title: "How we deploy to production over 100 times a day", url: "https://reddit.com/r/devops/comments/uqrwq2/how_we_deploy_to_production_over_100_times_a_day/", theme: "deploy safety" },
	{ id: "1kk685o", subreddit: "devops", score: 349, comments: 166, title: "I'm done applying. I'll fix your cloud/SRE problem in 48 hours and for free.", url: "https://reddit.com/r/devops/comments/1kk685o/im_done_applying_ill_fix_your_cloudsre_problem_in/", theme: "production fires" },
	{ id: "1axfxob", subreddit: "devops", score: 340, comments: 154, title: "The next time your devs complain about production being locked down:", url: "https://reddit.com/r/devops/comments/1axfxob/the_next_time_your_devs_complain_about_production/", theme: "prod safety" },
	{ id: "1i538r1", subreddit: "devops", score: 324, comments: 184, title: "Why is DevOps still such a fragmented, exhausting (and ofc costly) mess in 2025?", url: "https://reddit.com/r/devops/comments/1i538r1/why_is_devops_still_such_a_fragmented_exhausting/", theme: "tool sprawl" },
	{ id: "rh1rw7", subreddit: "aws", score: 270, comments: 110, title: "Another AWS outage?", url: "https://reddit.com/r/aws/comments/rh1rw7/another_aws_outage/", theme: "cloud outage" },
	{ id: "1e6zlq6", subreddit: "azure", score: 145, comments: 86, title: "Microsoft and Crowdstrike Outage", url: "https://reddit.com/r/AZURE/comments/1e6zlq6/microsoft_and_crowdstrike_outage/", theme: "cloud outage" },
	{ id: "xi9fku", subreddit: "sre", score: 90, comments: 25, title: "A \"real\" day in the life of an SRE", url: "https://reddit.com/r/sre/comments/xi9fku/a_real_day_in_the_life_of_an_sre_we_have_all_seen/", theme: "toil" },
	{ id: "1foghyl", subreddit: "sre", score: 66, comments: 29, title: "Have you ever caused a major outage?", url: "https://reddit.com/r/sre/comments/1foghyl/have_you_ever_caused_a_major_outage/", theme: "outage / RCA" },
	{ id: "113t8ou", subreddit: "sre", score: 66, comments: 56, title: "Became SRE. Highly regret it. Help.", url: "https://reddit.com/r/sre/comments/113t8ou/became_sre_highly_regret_it_help/", theme: "on-call fatigue" },
	{ id: "1e0t000", subreddit: "sre", score: 63, comments: 66, title: "i once got paged on the subway and emerged in the midst of a SEV0 outage", url: "https://reddit.com/r/sre/comments/1e0t000/i_once_got_paged_on_the_subway_underground_and/", theme: "on-call fatigue" },
	{ id: "1fz23bq", subreddit: "sre", score: 62, comments: 4, title: "seeing my name in the postmortem", url: "https://reddit.com/r/sre/comments/1fz23bq/seeing_my_name_in_the_postmortem/", theme: "postmortem" },
	{ id: "wk443h", subreddit: "sre", score: 56, comments: 6, title: "Don't do this with your k8s health checks", url: "https://reddit.com/r/sre/comments/wk443h/dont_do_this_with_your_k8s_health_checks/", theme: "outage / fix" },
	{ id: "1hsyz7c", subreddit: "sre", score: 53, comments: 11, title: "SRE production readiness checklist", url: "https://reddit.com/r/sre/comments/1hsyz7c/sre_production_readiness_checklist/", theme: "prod safety" },
	{ id: "13d4i6v", subreddit: "sre", score: 50, comments: 5, title: "List of Post-Mortems", url: "https://reddit.com/r/sre/comments/13d4i6v/list_of_postmortems/", theme: "postmortem" },
	{ id: "11dsa6o", subreddit: "sre", score: 45, comments: 14, title: "When choosing SaaS vendors make sure you write this into your contracts.", url: "https://reddit.com/r/sre/comments/11dsa6o/when_choosing_saas_vendors_make_sure_you_write/", theme: "vendor trust" },
];

// --- curated buyer quotes (CURATED subset; verbatim text from corpus) -------
// Pulled from the self-text/comments of the on-topic posts above. score +
// subreddit are MEASURED; these are the pain in the buyer's own words.
const quotes = [
	{ subreddit: "sre", score: 66, keyword: "on-call", postTitle: "Became SRE. Highly regret it. Help.", body: "I work in an environment where getting 50+ pages per week is common. I dread on-call weeks as a result. I have to put my entire life on hold because I am constantly anticipating the next alert.", url: "https://reddit.com/r/sre/comments/113t8ou/became_sre_highly_regret_it_help/" },
	{ subreddit: "sre", score: 63, keyword: "3am page", postTitle: "i once got paged on the subway and emerged in the midst of a SEV0 outage", body: "it was a sunday. had to steal wifi from an urban outfitters on 5th ave to manage it. what's your most inconveniently timed page?", url: "https://reddit.com/r/sre/comments/1e0t000/i_once_got_paged_on_the_subway_underground_and/" },
	{ subreddit: "devops", score: 340, keyword: "rollback", postTitle: "The next time your devs complain about production being locked down", body: "While building a feature, we performed a database migration command locally, but it incorrectly pointed at production — one of your worst nightmares.", url: "https://reddit.com/r/devops/comments/1axfxob/the_next_time_your_devs_complain_about_production/" },
	{ subreddit: "sre", score: 16, keyword: "outage", postTitle: "Have you ever caused a major outage?", body: "You can't call yourself an engineer if you haven't taken down prod at least once.", url: "https://reddit.com/r/sre/comments/1foghyl/have_you_ever_caused_a_major_outage/" },
	{ subreddit: "devops", score: 324, keyword: "toil", postTitle: "Why is DevOps still such a fragmented, exhausting mess in 2025?", body: "DevOps was supposed to make life easier for developers, but honestly, it still feels like an endless headache. Every problem needs a different tool.", url: "https://reddit.com/r/devops/comments/1i538r1/why_is_devops_still_such_a_fragmented_exhausting/" },
	{ subreddit: "sre", score: 45, keyword: "vendor trust", postTitle: "When choosing SaaS vendors make sure you write this into your contracts", body: "Just came off a super frustrating experience with a SaaS 'observability' vendor where essentially they provide the ability for us to back up our log data locally in an S3 bucket that...", url: "https://reddit.com/r/sre/comments/11dsa6o/when_choosing_saas_vendors_make_sure_you_write/" },
	{ subreddit: "devops", score: 349, keyword: "production fires", postTitle: "I'll fix your cloud/SRE problem in 48 hours and for free", body: "3 years of experience stabilizing cloud chaos, scaling infrastructure, optimizing observability, and putting out production fires nobody else could trace.", url: "https://reddit.com/r/devops/comments/1kk685o/im_done_applying_ill_fix_your_cloudsre_problem_in/" },
	{ subreddit: "sre", score: 62, keyword: "postmortem", postTitle: "seeing my name in the postmortem", body: "seeing my name in the postmortem", url: "https://reddit.com/r/sre/comments/1fz23bq/seeing_my_name_in_the_postmortem/" },
];

const banner = "// AUTO-GENERATED by scripts/gen-cidg-voices.mjs — DO NOT EDIT BY HAND.\n// Re-run: node scripts/gen-cidg-voices.mjs\n";

const out = `${banner}
// Voice-of-the-Buyer reddit market-research subset that motivates CIDG. Numeric
// series (keyword/tool counts, monthly tier activity, subreddit/score stats) are
// MEASURED from rl-env/research/eda artifacts. The post leaderboard + buyer
// quotes are a CURATED, on-topic subset (the incident/reliability posts) with
// real subreddit + score + permalink preserved.

export type PainKeyword = { term: string; count: number };
export type ToolMention = { tool: string; count: number; category: string; note: string | null };
export type SubredditCount = { name: string; posts: number };
export type TierSeries = { tier: string; points: number[] };
export type VoicePost = { id: string; subreddit: string; score: number; comments: number; title: string; url: string; theme: string };
export type BuyerQuote = { subreddit: string; score: number; keyword: string; postTitle: string; body: string; url: string };

export const VOICES_STATS = ${JSON.stringify(stats, null, "\t")} as const;

export const PAIN_KEYWORDS: PainKeyword[] = ${JSON.stringify(painKeywords, null, "\t")};

export const TOOL_MENTIONS: ToolMention[] = ${JSON.stringify(toolMentions, null, "\t")};

export const SUBREDDITS: SubredditCount[] = ${JSON.stringify(subreddits, null, "\t")};

// Shared month axis (YYYY-MM) for the tier activity series below.
export const ACTIVITY_MONTHS: string[] = ${JSON.stringify(months)};

export const TIER_SERIES: TierSeries[] = ${JSON.stringify(tierSeries, null, "\t")};

export const TOP_POSTS: VoicePost[] = ${JSON.stringify(topPosts, null, "\t")};

export const BUYER_QUOTES: BuyerQuote[] = ${JSON.stringify(quotes, null, "\t")};
`;

writeFileSync(OUT, out);
console.log(`wrote ${OUT}`);
console.log(`  pain keywords: ${painKeywords.length}, tools: ${toolMentions.length}, subreddits: ${subreddits.length}`);
console.log(`  months: ${months.length}, tier series: ${tierSeries.length}, posts: ${topPosts.length}, quotes: ${quotes.length}`);
