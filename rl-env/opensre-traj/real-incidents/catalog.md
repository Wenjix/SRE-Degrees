# Real-world cascading-incident catalog (19 entries, verified against first-party postmortems)

Each entry is a real production outage with a **misleading loud symptom**, a **trap action**
(naive fix that worsened it), and a **correct fix sequence**. Source material for the
real-world diagnosis spec packs (`specs/real/<NN>-<slug>.json`).

---

## 01 — circleci-kubeproxy-iptables  (CircleCI)
- date/dur: 2023-03-14, ~7h + 2 follow-on tails
- loud_symptom: widespread svc-to-svc comms failing; "Sync failed iptables-restore" buried in kube-proxy logs
- why_misleading: kube-proxy, CoreDNS, node-local-dns-cache all "appeared healthy"; fingers pointed at DNS
- hypotheses/fixes: (1) roll back partial K8s upgrade — looked like recovery, WRONG-DIRECTION (2) restart misc svcs — ineffective (3) restart CoreDNS/node-local-dns-cache — WORSENED (DNS broke fully) (4) restart kube-proxy on a node, traffic flows (5) rolling restart all nodes (6) restart dependency pool — recovery (7) roll RMQ → 2 follow-on RMQ corruption incidents
- root_cause: kube-proxy/kubelet version skew during upgrade; kube-proxy "Failed to execute iptables-restore" → Service routing rules stop updating
- causal_chain: partial K8s upgrade → kube-proxy/kubelet skew → iptables-restore failures → stale Service routing → svc traffic fails → job backlog → RMQ saturation → RMQ corruption tail
- trap_action: restart CoreDNS / node-local-dns-cache (broke DNS fully); surface-level rollback
- correct_fix: identify skew via iptables-restore errors BEFORE touching DNS; full rolling node restart; preserve RMQ logging before mitigation
- category: network_fault (control-plane/service-routing)

## 02 — datadog-systemd-cilium  (Datadog)
- date/dur: 2023-03-08, ~27h, all 5 regions / 3 clouds simultaneously
- loud_symptom: all regions offline within minutes — looked like global control-plane incident
- why_misleading: regions intentionally isolated (multi-AZ, 3 clouds, no shared CP); "regions aren't supposed to fail together"
- hypotheses/fixes: (1) frame as global CP incident — wrong, none existed (2) reboot nodes — worked where autoscaler kept nodes; on aggressive-replace clouds lost local data + thundering herd vs cloud APIs (3) disable legacy security-update channel; fix systemd-networkd so routing survives restart
- root_cause: legacy apt unattended-upgrades auto-applied systemd update; on Ubuntu 22.04/systemd 249, systemd-networkd restart flushed Cilium CNI routes; OS auto-update window 06:00-07:00 UTC fired simultaneously across regions
- causal_chain: legacy apt channel → systemd update @06:00 → systemd-networkd restart → Cilium routes deleted → node loses pod networking → per-region K8s CP overload → quorum stateful svcs refuse
- trap_action: mass node REPLACEMENT (data loss + thundering herd); restart workloads before per-region K8s CP recovers
- correct_fix: recover each region's K8s CP BEFORE workloads; reboot (don't replace) where data is local; scale provider rate limits first; fix systemd-networkd KeepConfiguration; remove legacy apt channel
- category: config_error (OS-update → CNI route flush)

## 03 — incidentio-anetd-cpu  (incident.io)
- date/dur: 2023-09, intermittent ~1 week
- loud_symptom: Postgres conn timeouts, later memcached "read i/o timeout"; no consistent user/node pattern
- why_misleading: looked like app-layer connection-pool/stale-TCP; postmortem: "definitely looked more like connection timeouts"
- hypotheses/fixes: (1) dead-pg-conn race — doubled max conn lifetime + static pool (partial) (2) memcached idle conn — bumped MaxIdleConns 2→20 (briefly helped) (3) blame GKE-managed memcached → self-host in-cluster (no effect) (4) an unrelated runaway-external-API fix landed when errors vanished — miscredited (5) found GKE docs: Dataplane V2 anetd uses 2-3 vCPU under rapid TCP churn
- root_cause: GKE Dataplane V2 agent (anetd) CPU-saturates when a workload opens/closes many TCP conns rapidly per node; nearby pods drop packets, fail health checks
- causal_chain: bursty outbound TCP from one pod → anetd CPU sat on node → dropped packets / failed health checks for unrelated cache/DB conns on same node → downstream timeouts
- trap_action: disable Dataplane V2 (cluster rebuild for a workload problem); endless DB/cache pool tuning
- correct_fix: constrain outbound conn concurrency; reuse via pooling/keep-alives; monitor node-wide TCP-conn-rate not per-pod
- category: saturation (node CNI-agent CPU)

## 04 — slack-tgw-fd-exhaustion  (Slack, 2021-01-04)
- date/dur: 2021-01-04, ~4h
- loud_symptom: rising error rate; dashboarding/alerting service itself went down
- why_misleading: looked like internal regression — first instinct rolled back day-of changes (unrelated); real cause was AWS Transit Gateway saturation
- hypotheses/fixes: (1) roll back recent deploys — WRONG (2) escalate to AWS (3) web autoscaler downscaled (threads waited on net) then upscaled +1,200 (4) provision-service hit Linux open-file limit + AWS API quota during burst — NAIVE SCALE-UP PROLONGED (5) disable web downscaling (6) repair provisioner; LB panic mode + circuit breakers (7) AWS upscaled TGW
- root_cause: AWS TGW in hub-and-spoke VPC topology didn't auto-scale fast enough for first-Monday PPS surge; cross-VPC packet loss
- causal_chain: low holiday traffic → TGW scaled down → Monday cold-cache surge → TGW packet loss → backend latency → Apache threads block → CPU drops → autoscaler downscales (wrong) then upscales → 1200 provisioner calls hit FD limit + quota → broken instances hit ASG max → dashboard tier (separate VPC) loses DB
- trap_action: aggressive web-tier scale-up while network saturated; rolling back recent app code
- correct_fix: order — stop autoscaling first, AWS manually scales TGW, then drain backlog with LB panic mode + circuit breakers; pre-warm TGW; co-locate dashboard with its DB
- category: network_fault (provider net saturation; scale-up trap)

## 05 — slack-consul-cache-db-metastable  (Slack, 2022-02-22)
- date/dur: 2022-02-22, several hours
- loud_symptom: Vitess keyspace severely overloaded; "GDM list" scatter query saturating DB
- why_misleading: DB-load shape looked like a runaway query/app bug; real driver was a Consul-agent rolling restart churning the memcached cache ring
- hypotheses/fixes: (1) suspect caches (partly right) (2) throttle client_boot — partial (3) raised throttle too aggressively → DB surged again (WORSENED) (4) reduce throttle; raise in small steps (5) pause Consul rolling restart (too late, metastable) (6) change scatter query to read only missing shards + replicas; cache refills; lift throttle gradually
- root_cause: Consul-agent restart on memcached → mcrib promotes spares + flushes returning nodes → cache hit-rate drops → sharded GDM-list scatter hits every shard → DB read load superlinear with miss rate → metastable; retries pin it
- causal_chain: Consul PBR restart → memcached churn → mcrib reassigns/flushes slots → hit rate falls → scatter expansion → Vitess overload → cache fills time out → client retries amplify
- trap_action: restart cache nodes; lift throttles fast; roll back unrelated code
- correct_fix: throttle client_boot first to cap DB load, fix scatter to read-only-missing + replicas, then gradually lift throttle
- category: dependency_failure (discovery→cache→DB metastable)

## 06 — github-network-partition-orchestrator  (GitHub, 2018-10-21)
- loud_symptom: many internal alerts; cluster topology unexpectedly West-Coast primary
- why_misleading: looked like a database problem; root was a 43-second optical-equipment swap on US East that Orchestrator (Raft) read as primary failure
- hypotheses/fixes: (1) topology trace — Orchestrator shows only West servers (2) NAIVE fail back to East — DECIDED AGAINST (would lose ~40min writes; both coasts held non-replicated writes) (3) lock deploy tooling (4) pause webhooks + Pages to protect data (5) restore West from backups + sync; restore East from West (6) re-establish East 11:12 UTC
- root_cause: brief intersite partition → Orchestrator Raft leader deselection; quorum re-formed without East; apps wrote West post-recovery; divergent writes made simple failback unsafe
- causal_chain: 100G optic replacement → 43s loss of E-W link → Raft deselection → West quorum promotes → connectivity returns → apps write West → both coasts hold non-replicated writes → failback impossible without data loss → backup-restore + slow re-replication
- trap_action: failing back to East (loses ~40min writes); blindly promoting more read replicas
- correct_fix: choose integrity over availability; pause write-heavy paths; restore from backup; rebuild replication; accept extended degradation
- category: network_fault (partition → split-brain DB)

## 07 — github-mlag-stonith-splitbrain  (GitHub, 2012-12-22)
- loud_symptom: network instability after aggregation-switch upgrade; ultimately wholesale fileserver outage with STONITH'd pairs both dead
- why_misleading: a routine forensic step (dumping switch agent state, historically benign) triggered the worse failover mode + L2 churn that took down fileservers
- hypotheses/fixes: (1) switch upgrade hits issues; disable half aggregation links (correct workaround) (2) vendor requests agent state dump — assumed safe — TRIGGERED OUTAGE (peer switch saw heartbeat loss but link up → disruptive failover; L2 reconvergence blocked inter-rack ~90s) (3) fileserver pairs (Pacemaker+DRBD+STONITH) exceeded heartbeat timeouts; both halves issued STONITH → mutual kill (4) roll back switch software; log-driven recovery for last-primary per pair
- root_cause: MLAG peer-failover heuristic + STONITH HA whose heartbeat ran over the same fabric
- causal_chain: "safe" agent state dump → agent stops responding while links up → peer switch disruptive failover → L2 churn → heartbeat timeout on fileserver pairs → both take over → mutual STONITH → fleet down → log-driven recovery
- trap_action: reboot fileservers in arbitrary order (data corruption — needs log forensics); trusting "just a state dump" runbook step
- correct_fix: put fileserver HA in maintenance mode before ANY switch change; decouple cluster heartbeat from production net; recover one node at a time, validate DRBD
- category: network_fault (fencing storm / split-brain)

## 08 — github-dns-zone-corruption  (GitHub, 2016-12-08)
- loud_symptom: DNS query timeouts → NXDOMAIN → app slowness from fileservers
- why_misleading: caching-DNS bug was trigger; "fixing" DNS triggered a circular dependency that corrupted zone files; then fileserver OOM looked like its own incident
- hypotheses/fixes: (1) new DNS config; Puppet bug only restarted auth NS not caching NS (old IPs) — UNNOTICED (2) DNS timeouts → reload both NSes — TRIGGERED WORSE: DNS-deploy pipeline itself needs DNS; output unvalidated → truncated zone → NXDOMAIN (3) manually fix zones via direct API + validation (4) fileservers refusing conns from OOM (retry-proc spawn during DNS outage); remove misbehaving fileservers individually
- root_cause: Puppet manifest bug + circular dep between DNS deploy pipeline and DNS itself + missing zone-file sanity check
- causal_chain: Puppet partial restart → caching NS old IPs → DNS timeouts → deploy DNS → pipeline needs DNS → truncated zone → NXDOMAIN → apps spawn retry procs → fileserver OOM → healthy fileservers unreachable
- trap_action: re-run DNS deploy without sanity-check; uniform fileserver restart
- correct_fix: manual API call + validate output + push verified zones; clean up fileservers individually
- category: config_error (DNS circular dep)

## 09 — github-proxysql-fd-limit  (GitHub, 2020-02)
- loud_symptom: stalled writes on mysql1; dependent services failing (4 incidents over 9 days)
- why_misleading: looked like DB capacity / connection-pool each time; actual issue a silent systemd LimitNOFILE clamp in ProxySQL above an unobserved threshold
- hypotheses/fixes: (1) suspect a resource-intensive query (2) planned primary promotion → same failure → suspect promotion (3) active conns crossed threshold → realized FD limit 65,536 (systemd silently clamped LimitNOFILE=1B → system max → ProxySQL default) (4) race between process manager + service config slowed even the ulimit fix (5) later query change → 4h23m incident; 3-day freeze
- root_cause: systemd LimitNOFILE silently capped; ProxySQL effective FDs 65k not 1B; no alert on the gap
- causal_chain: query spike → ProxySQL conn limit hit → conn saturation → stalled writes mysql1 → dependents fail → fix is race-prone → deploy freeze
- trap_action: restart ProxySQL (re-clamps); blame query authors; roll back promotion
- correct_fix: fix LimitNOFILE via correct systemd unit; verify /proc/<pid>/limits; partition data; audit reads from primary
- category: config_error (silent FD ceiling)

## 10 — github-mysql-semaphore-rename  (GitHub, 2021-11-27)
- loud_symptom: read replicas crashing during final RENAME of a long migration; cascading load on remaining replicas
- why_misleading: classic capacity-shape; engineers promoted internal analytics replicas to prod — fed them into the same crash-recovery loop
- hypotheses/fixes: (1) promote internal/analytics replicas to add capacity — WRONG (2) observe crash-recovery loop: replicas return, hit RENAME, crash again (3) PROACTIVELY REMOVE prod traffic from broken replicas until RENAME completes (integrity over availability) (4) return replicas after RENAME
- root_cause: final RENAME of large table → InnoDB semaphore deadlock; many read replicas enter crash-recovery simultaneously
- causal_chain: RENAME → semaphore deadlock on replicas → crash-recover → remaining replicas overload → "more capacity" re-introduces replicas → loop
- trap_action: add read replicas / promote internal ones — they crash-recover again, worsening availability ("add capacity" is the trap)
- correct_fix: pull broken replicas from prod path; let RENAME complete; then re-add; canary migrations to a single shard
- category: resource_exhaustion (DB deadlock; add-capacity trap)

## 11 — github-git-failover-rollback  (GitHub, 2023-05-09)
- loud_symptom: Git read failures; PR pushes not appearing
- why_misleading: the config change was meant to PREVENT conn saturation and had applied safely elsewhere; the cluster failover it triggered looked separate; later the rollback path itself failed
- hypotheses/fixes: (1) revert config change → ROLLBACK FAILED (internal infra error) (2) manual gradual failover (3) extended PR/push reconciliation (May 11) automated failover succeeded BUT did not reattach read replicas → primary overload → 15-26% Git ops fail → reattach replicas
- root_cause: config change triggered failover; rollback path broken; later failover code path didn't reattach read replicas
- causal_chain: conn-sat config push → cluster failover → rollback path broken → manual gradual failover → later automated failover leaves cluster missing replicas → primary overload
- trap_action: trust standard rollback; assume automated failover keeps replicas attached
- correct_fix: manual gradual failover; explicitly verify replica attachment post-failover; fix rollback path
- category: config_error (failover/rollback path defects)

## 12 — github-cache-ttl-read-explosion  (GitHub, 2026-02-09)
- loud_symptom: connection exhaustion in Git HTTPS proxy; widespread errors
- why_misleading: TTL change quickly identified; the slow part was understanding WHY read load kept increasing — two client apps released weeks earlier had a 10x read regression masked by the longer TTL until peak Monday
- hypotheses/fixes: (1) identify TTL change; revert — HALF THE STORY (2) disable async cache rewrites + restart Git proxies — partial (3) second incident same day: sync writes from a different source repeats cascade → disable source + restart Git proxy (4) multi-week investigation of the 10x read growth
- root_cause: refresh TTL dropped 12h→2h; combined with two client apps' latent 10x read regression (masked by long TTL); peak Monday surge overwhelmed user-settings DB; cascading cache rewrites overwhelmed background-work coordinator → Git HTTPS proxy conn exhaustion
- causal_chain: latent client 10x read regression → TTL change → peak Monday → user-mgmt DB overload → async cache rewrites swamp coordinator → Git HTTPS proxy conn exhaustion → auth-token / Git dependents fail
- trap_action: just revert TTL (doesn't address client read traffic)
- correct_fix: disable async cache rewrites; restart proxies; restrict cache write sources; add per-traffic switches; segment user-settings DB
- category: saturation (config change + latent read regression)

## 13 — cloudflare-1111-zonemd-stale-cache  (Cloudflare, 2023-10-04; seeded 2023-09-21)
- loud_symptom: 1.1.1.1 SERVFAIL spike 3%→15%; "DNSSEC signatures in root zone expired" — looks like upstream DNS/DNSSEC issue
- why_misleading: real trigger 13 days earlier (ZONEMD added to root zone); static_zone parser silently failed; cache held old root until DNSSEC sig expired. Looks external; was internal parser + stale cache
- hypotheses/fixes: (1) disable static_zone via override-rule tag (rec_disable_static) — DIDN'T WORK (forwarded cache-miss queries didn't carry the tag) (2) disable static_zone preloading entirely — fixes at 10:30
- root_cause: root-zone parser couldn't handle new ZONEMD record; static_zone retained old root 13 days; on DNSSEC sig expiry, nodes not restarted in 13 days SERVFAIL
- causal_chain: ZONEMD added → static_zone parse fails silently → old root cached → 13 days later DNSSEC sigs expire → stale-cache nodes SERVFAIL → override-rule doesn't propagate via forwarding → must disable static_zone app
- trap_action: trust an override-rule whose tags don't survive cache-miss forwarding
- correct_fix: disable static_zone app entirely (not per-request tag); handle unknown RR types; alert on stale root zone
- category: config_error (silent parse fail + stale cache); first fix DID NOT WORK

## 14 — cloudflare-byzantine-switch  (Cloudflare, 2020-11-02)
- loud_symptom: switch alerts (unreachable to pings) + API errors; each redundancy layer "degraded but not fully failed"
- why_misleading: partial switch failure — control-plane down, data-plane up → asymmetric reachability → conflicting node views (textbook Byzantine)
- hypotheses/fixes: (1) per-component health — each redundancy reports "degraded" not "failed" (2) identify Byzantine (node1 self-votes, node2 votes node3, no leader) (3) hard-down the partially-failed switch so cluster sees a clean partition (4) wait for async catch-up
- root_cause: switch in "partially operating" state → asymmetric connectivity; cluster manager hit a fault mode it wasn't designed for; promotion timing too quick post-recovery
- causal_chain: partial switch failure → asymmetric reachability A↔B↔C → leader election ties → no leader → writes block → API failures
- trap_action: restart switch CP (re-enters degraded); restart cluster nodes (asymmetry persists)
- correct_fix: forcibly take down the partial-failed switch so cluster sees a clean failure; then re-introduce capacity; tune promotion timing
- category: network_fault (Byzantine/asymmetric partition)

## 15 — circleci-waf-manual-edit  (CircleCI, 2025-04-04)
- loud_symptom: CORS errors, frontend-backend connectivity loss, GitHub webhook drop
- why_misleading: started minutes after an unrelated incident wrapped — treated as aftereffects; WAF managed by Terraform, so team assumed any WAF change would show in IaC
- hypotheses/fixes: (1) treat as continuation of prior incident — wasted time (2) investigate recent deploys + infra — fruitless (3) investigate CORS/API gateway/network — fruitless (4) Terraform drift detection (~80min) flags out-of-band WAF rule (5) revert WAF rule
- root_cause: IAM let an operator modify WAF directly; "read-only" security monitoring inadvertently applied a rule blocking legitimate traffic
- causal_chain: lax IAM → manual WAF edit → CloudFront blocks legit API/UI → CORS+conn errors → debugging derailed by prior-incident bias
- trap_action: anchor on previous incident's hypotheses; trust IaC without verifying actual cloud state
- correct_fix: drift detection finds manual edit; revert; tighten IAM so only IaC pipeline mutates WAF
- category: config_error (out-of-band manual change; anchoring trap)

## 16 — aws-dynamodb-dns-enactor  (AWS, 2025-10-19)
- loud_symptom: DDB API errors → looked like DDB control-plane outage; later NLB conn errors + EC2 capacity errors looked like separate issues
- why_misleading: root was a DNS Enactor race leaving an EMPTY DNS record for the regional DDB endpoint; EC2 DWFM + NLB health-check storm were knock-ons that looked distinct
- hypotheses/fixes: (1) identify DDB DNS state as source (2) temp mitigations (3) restore all DNS (4) EC2 launches still failing → DWFM lease backlog; throttle (5) NLB health-checks flap → automatic AZ DNS failover removes capacity → DISABLE automatic health-check failover (auto-mitigation wrong-direction) (6) re-enable NLB failover only after EC2 recovers
- root_cause: DDB DNS Enactor race (delayed enactor + concurrent fast enactor w/ cleanup) left an empty DNS record; system stuck inconsistent
- causal_chain: DNS Enactor race → empty DNS for DDB endpoint → DNS failure for all callers → internal DDB-dep services fail → EC2 DWFM lease churn (uses DDB) → "insufficient capacity" → NLB nodes flap → NLB auto AZ DNS failover removes capacity → multi-AZ apps lose serving capacity
- trap_action: let NLB automatic AZ DNS failover keep firing while capacity recovers (removes healthy capacity)
- correct_fix: manual DNS restore; disable DNS Planner/Enactor automation before re-enabling with race-fix; disable NLB auto AZ failover during storm; re-enable only after EC2 healthy; velocity-control on capacity removal
- category: dependency_failure (DNS race; auto-mitigation trap)

## 17 — aws-kinesis-cell-manager  (AWS, 2024-07-30)
- loud_symptom: latency + error spike on a Kinesis cell used by internal AWS services
- why_misleading: cellularized arch ran fine for months → looked like a routine deploy problem; actual cause was cell management misbehavior against a novel workload (many very-low-throughput shards)
- hypotheses/fixes: (1) focus on the deploy — partial (2) resource contention spiking (3) shed load (reduce less time-sensitive internal stream volume) (4) first improvement (5) add capacity to TLS connection-provisioner (downstream of reshuffle storm) (6) majority succeed
- root_cause: cell manager distributes by throughput/IO not shard count; many low-tput shards piled on few hosts; status messages grew large; manager read slow status as unhealthy; reshuffle storm overloaded TLS conn-provisioner → dataplane impaired
- causal_chain: deploy removes a host → rebalance picks few hosts for many shards → oversized status messages → delayed processing → false unhealthy → reshuffle storm → TLS conn-provisioner overload → dataplane errors
- trap_action: restart hosts (more rebalance churn); add raw shard capacity without addressing status-message size; rely on cell isolation
- correct_fix: shed load first to reduce status-message size; add capacity to conn-provisioner; enforce conn limits; make cell manager shard-count-aware
- category: saturation (control-plane reshuffle storm; add-capacity trap)

## 18 — cloudflare-bgp-reorder-withdraw  (Cloudflare, 2022-06-21)
- loud_symptom: sudden 50% global traffic drop on a config rollout (19 MCP data centers offline)
- why_misleading: diff looked harmless ("added some additional information") but a term re-order moved site-local prefix advertisement BEHIND a REJECT-THE-REST term, silently turning a community-add into an implicit withdraw
- hypotheses/fixes: (1) declare incident (2) first router change to verify root cause (3) root cause found (4) revert — BUT "network engineers walked over each other's changes, reverting previous reverts, problem reappeared sporadically" (5) final stable
- root_cause: BGP policy term reorder in AGGREGATES-OUT placed site-locals behind REJECT-THE-REST; site-locals withdrawn; MCP servers lose mutual reachability; Multimog LB overload of small clusters
- causal_chain: harmless-looking diff reorders terms → site-locals match REJECT first → withdrawn from iBGP → MCP nodes lose reachability → Multimog can't forward → small clusters overload → operators lose access to the routers they need to fix
- trap_action: multiple engineers reverting concurrently without locking; standard rollback re-introduced bad state
- correct_fix: coordinated revert with commit-confirm semantics; stagger MCP-specific rollout
- category: config_error (BGP policy reorder; concurrent-revert trap)

## 19 — launchdarkly-legacy-routing-cold-cache  (LaunchDarkly, 2025-10-20)
- loud_symptom: phase 1 mirrored the AWS us-east-1 outage; phase 2 began AFTER AWS recovery when an internal "stabilization" change triggered a streaming-service collapse
- why_misleading: phase 1 had a clear external cause; phase 2 looked like fallout but was a SELF-INFLICTED regression — reverting to a legacy routing path with COLD CACHES caused SDKs to retry excessively
- hypotheses/fixes: (1) wait for AWS recovery (2) apply internal change "to reduce load on web app" → triggered failure in flag delivery — WRONG FIX (the worsening) (3) excessive SDK retries overwhelm streaming + LB → LB unresponsive (4) can't scale out — EC2 still impaired (5) wait for AWS EC2 recovery + manual stabilization
- root_cause: reverting flag delivery to legacy routing path with cold caches during a cloud outage; SDKs retried aggressively; load + cold caches + no autoscale capacity → collapse
- causal_chain: AWS us-east-1 outage → LD autoscale impaired → operator chooses legacy routing to relieve web app → legacy caches cold → SDK retries amplify on every miss → streaming + LB collapse → can't scale (EC2 CP degraded) → extended outage
- trap_action: cutting over to a cold/legacy path mid-incident "to relieve load"
- correct_fix: keep the new fault-tolerant path; if cutover required, pre-warm caches; add SDK auto-failover from streaming to polling
- category: dependency_failure (provider outage + self-inflicted cold-cache cutover trap)
