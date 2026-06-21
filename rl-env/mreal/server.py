#!/usr/bin/env python3
"""CIDG real-RPS mock service — health EMERGES from real upstream calls.

Each GET / actually calls this service's REQUIRED upstreams (real HTTP) and, if
configured, a shared POOL. The response is 200 only if this service isn't faulted
AND every required upstream answered 200 AND a pool slot was acquired. Latency
accumulates down the chain. So a fault injected at one node propagates to its
callers as a real, Prometheus-observable cascade — with no scripted cascade entry
anywhere. This is the live-cluster twin of sim/engine.py's propagate().

Env:
  APP        service name (metric label)
  UPSTREAMS  comma-separated host:port of REQUIRED deps (cascade edges)
  POOL       host:port of a shared pool dep (optional; fan-in contention)
  POOL_SIZE  if >0, THIS service IS a shared pool: a semaphore of N slots
  OWN_FAULT  "error" | "slow" | "" — static root-cause injection (or use /ctl)

Control (no kubectl exec needed):
  POST /ctl/fault?mode=error|slow    inject the root cause here
  POST /ctl/heal                     clear it
"""
import os
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

APP = os.environ.get("APP", "svc")
UPSTREAMS = [u.strip() for u in os.environ.get("UPSTREAMS", "").split(",") if u.strip()]
POOL = os.environ.get("POOL", "").strip()
POOL_SIZE = int(os.environ.get("POOL_SIZE", "0") or "0")
_FAULT_MODE = os.environ.get("OWN_FAULT", "").strip()   # mutable at runtime via /ctl

_sem = threading.Semaphore(POOL_SIZE) if POOL_SIZE > 0 else None

_lock = threading.Lock()
_status = {"200": 0.0, "500": 0.0}
_up_req = 0.0
_up_2xx = 0.0
BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
_hist = {b: 0.0 for b in BUCKETS}
_hsum = 0.0
_hcount = 0.0


def _faulted():
    return _FAULT_MODE in ("error", "slow")


def _serve_pool():
    if _sem.acquire(timeout=0.4):
        try:
            time.sleep(0.02)                 # service time while holding a slot
            return 200, 0.02
        finally:
            _sem.release()
    return 500, 0.4                          # pool exhausted -> all sharers feel it


def _call(hostport):
    t = time.time()
    try:
        with urllib.request.urlopen(f"http://{hostport}/", timeout=3) as r:
            r.read()
            return (r.status == 200), (time.time() - t)
    except Exception:
        return False, (time.time() - t)


def _handle():
    global _up_req, _up_2xx
    t0 = time.time()
    if _sem is not None:                     # I am a pool node
        return _serve_pool()
    ok = True
    if _FAULT_MODE == "error":
        ok = False
    elif _FAULT_MODE == "slow":
        time.sleep(1.2)
    for u in UPSTREAMS:                       # required upstreams (cascade)
        up_ok, _ = _call(u)
        with _lock:
            _up_req += 1
            _up_2xx += 1 if up_ok else 0
        if not up_ok:
            ok = False
    if POOL:                                  # shared pool (fan-in contention)
        p_ok, _ = _call(POOL)
        if not p_ok:
            ok = False
    return (200 if ok else 500), (time.time() - t0)


def _record(status, latency):
    global _hsum, _hcount
    with _lock:
        _status[str(status)] = _status.get(str(status), 0.0) + 1
        _hsum += latency
        _hcount += 1
        for b in BUCKETS:
            if latency <= b:
                _hist[b] += 1


def _metrics():
    a = APP
    with _lock:
        out = [
            f'app_requests_total{{app="{a}",status="200"}} {_status["200"]}',
            f'app_requests_total{{app="{a}",status="500"}} {_status["500"]}',
            f'app_upstream_requests_total{{app="{a}"}} {_up_req}',
            f'app_upstream_2xx_total{{app="{a}"}} {_up_2xx}',
            f'app_up{{app="{a}"}} {0 if _faulted() else 1}',
        ]
        for b in BUCKETS:
            out.append(f'app_request_duration_seconds_bucket{{app="{a}",le="{b}"}} {_hist[b]}')
        out.append(f'app_request_duration_seconds_bucket{{app="{a}",le="+Inf"}} {_hcount}')
        out.append(f'app_request_duration_seconds_sum{{app="{a}"}} {_hsum}')
        out.append(f'app_request_duration_seconds_count{{app="{a}"}} {_hcount}')
    return ("\n".join(out) + "\n").encode()


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/metrics":
            self._send(200, _metrics(), "text/plain; version=0.0.4")
            return
        if self.path == "/healthz":          # liveness — stays up even when faulted
            self._send(200, b"ok\n")
            return
        status, latency = _handle()
        _record(status, latency)
        self._send(status, b"ok\n" if status == 200 else b"err\n")

    def do_POST(self):
        global _FAULT_MODE
        if self.path.startswith("/ctl/fault"):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            _FAULT_MODE = q.get("mode", ["error"])[0]
            self._send(200, f"fault={_FAULT_MODE}\n".encode())
            return
        if self.path.startswith("/ctl/heal"):
            _FAULT_MODE = ""
            self._send(200, b"healed\n")
            return
        self._send(404, b"no\n")

    def _send(self, code, body, ctype="text/plain"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except Exception:
            pass

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), H).serve_forever()
