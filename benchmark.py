import sys
import time
import statistics
import argparse
import json
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import httpx
except ImportError:
    print("httpx is required. Run: pip install httpx")
    sys.exit(1)


def percentile(data, pct):
    sorted_data = sorted(data)
    k = (len(sorted_data) - 1) * (pct / 100)
    f = int(k)
    c = f + 1
    if c >= len(sorted_data):
        return sorted_data[f]
    return sorted_data[f] + (k - f) * (sorted_data[c] - sorted_data[f])


def bench_endpoint(client, method, url, headers=None, json_body=None, n=20, label=None):
    times = []
    errors = 0
    status_codes = {}

    for i in range(n):
        try:
            start = time.perf_counter()
            if method == "GET":
                resp = client.get(url, headers=headers)
            elif method == "POST":
                resp = client.post(url, headers=headers, json=json_body)
            elif method == "PATCH":
                resp = client.patch(url, headers=headers, json=json_body)
            elapsed = (time.perf_counter() - start) * 1000
            times.append(elapsed)
            code = resp.status_code
            status_codes[code] = status_codes.get(code, 0) + 1
            if code >= 400:
                errors += 1
        except Exception as e:
            errors += 1
            status_codes["ERR"] = status_codes.get("ERR", 0) + 1

    if not times:
        return {"label": label or url, "error": "All requests failed"}

    ok = [t for t in times]
    result = {
        "label": label or url,
        "method": method,
        "requests": n,
        "errors": errors,
        "status_codes": status_codes,
        "min_ms": round(min(ok), 1),
        "max_ms": round(max(ok), 1),
        "mean_ms": round(statistics.mean(ok), 1),
        "median_ms": round(statistics.median(ok), 1),
        "p90_ms": round(percentile(ok, 90), 1),
        "p95_ms": round(percentile(ok, 95), 1),
        "p99_ms": round(percentile(ok, 99), 1),
        "stddev_ms": round(statistics.stdev(ok), 1) if len(ok) > 1 else 0,
    }
    return result


def bench_frontend(client, base_url, n=10):
    pages = [
        ("Landing/Login", "/login"),
    ]
    results = []
    for name, path in pages:
        url = base_url.rstrip("/") + path
        r = bench_endpoint(client, "GET", url, n=n, label=f"FE: {name}")
        results.append(r)
    return results


def print_results(results):
    print(f"\n{'='*90}")
    print(f"{'Label':<45} {'Med':>7} {'P95':>7} {'P99':>7} {'Mean':>7} {'Min':>7} {'Max':>7} {'Errs':>5}")
    print(f"{'='*90}")
    for r in results:
        if "error" in r:
            print(f"  {r['label']:<43} ERROR: {r['error']}")
            continue
        label = r["label"]
        print(
            f"  {label:<43} "
            f"{r['median_ms']:>6.1f} "
            f"{r['p95_ms']:>6.1f} "
            f"{r['p99_ms']:>6.1f} "
            f"{r['mean_ms']:>6.1f} "
            f"{r['min_ms']:>6.1f} "
            f"{r['max_ms']:>6.1f} "
            f"{r['errors']:>4}/{r['requests']}"
        )
    print(f"{'='*90}")


def print_summary(results):
    all_times = []
    total_errors = 0
    total_requests = 0
    for r in results:
        if "error" in r:
            total_errors += 1
            continue
        all_times.extend([r["median_ms"], r["p95_ms"]])
        total_errors += r["errors"]
        total_requests += r["requests"]

    if not all_times:
        print("\nNo successful results to summarize.")
        return

    print(f"\n--- Summary ---")
    print(f"  Endpoints tested: {len(results)}")
    print(f"  Total requests: {total_requests}")
    print(f"  Total errors: {total_errors}")
    slowest = max(results, key=lambda x: x.get("p95_ms", 0))
    fastest = min(results, key=lambda x: x.get("median_ms", float("inf")))
    print(f"  Slowest (P95): {slowest['label']} - {slowest.get('p95_ms', '?')}ms")
    print(f"  Fastest (Med): {fastest['label']} - {fastest.get('median_ms', '?')}ms")


def main():
    parser = argparse.ArgumentParser(description="Team Request Hub Benchmark")
    parser.add_argument("--api-url", default="https://api.kaiser-bot.online", help="API base URL")
    parser.add_argument("--frontend-url", default="https://app.kaiser-bot.online", help="Frontend base URL")
    parser.add_argument("--token", default=None, help="Supabase JWT access token for auth endpoints")
    parser.add_argument("-n", "--requests", type=int, default=20, help="Requests per endpoint (default: 20)")
    parser.add_argument("--frontend", action="store_true", help="Also benchmark frontend pages")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--concurrency", type=int, default=1, help="Concurrent requests (default: 1)")
    args = parser.parse_args()

    api_url = args.api_url.rstrip("/")
    all_results = []

    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        print(f"Team Request Hub Benchmark")
        print(f"  API:       {api_url}")
        print(f"  Frontend:  {args.frontend_url}")
        print(f"  Requests:  {args.requests} per endpoint")
        print(f"  Token:     {'provided' if args.token else 'none (public endpoints only)'}")

        # --- Public endpoints ---
        print(f"\n>>> Public Endpoints")
        public = [
            bench_endpoint(client, "GET", f"{api_url}/health", n=args.requests, label="GET /health"),
        ]
        all_results.extend(public)
        print_results(public)

        # --- Authenticated endpoints ---
        if args.token:
            auth_headers = {"Authorization": f"Bearer {args.token}"}
            print(f"\n>>> Authenticated Endpoints")

            auth_endpoints = []

            # Users
            auth_endpoints.append(
                ("GET", f"{api_url}/users/me", None, "GET /users/me")
            )
            auth_endpoints.append(
                ("GET", f"{api_url}/users/active", None, "GET /users/active")
            )
            auth_endpoints.append(
                ("GET", f"{api_url}/users", None, "GET /users")
            )

            # Requests
            auth_endpoints.append(
                ("GET", f"{api_url}/requests?view=assigned", None, "GET /requests?assigned")
            )
            auth_endpoints.append(
                ("GET", f"{api_url}/requests?view=created", None, "GET /requests?created")
            )
            auth_endpoints.append(
                ("GET", f"{api_url}/requests?view=all", None, "GET /requests?all")
            )

            # Dashboard
            auth_endpoints.append(
                ("GET", f"{api_url}/dashboard/summary", None, "GET /dashboard/summary")
            )

            # Notifications
            auth_endpoints.append(
                ("GET", f"{api_url}/notifications", None, "GET /notifications")
            )
            auth_endpoints.append(
                ("GET", f"{api_url}/notifications?unread_only=true", None, "GET /notifications?unread")
            )

            # Files
            auth_endpoints.append(
                ("GET", f"{api_url}/files", None, "GET /files")
            )
            auth_endpoints.append(
                ("GET", f"{api_url}/files/tree", None, "GET /files/tree")
            )
            auth_endpoints.append(
                ("GET", f"{api_url}/files/activity", None, "GET /files/activity")
            )

            if args.concurrency > 1:
                with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
                    futures = []
                    for method, url, body, label in auth_endpoints:
                        fut = executor.submit(
                            bench_endpoint, client, method, url, auth_headers, body, args.requests, label
                        )
                        futures.append(fut)
                    auth_results = [f.result() for f in as_completed(futures)]
                    auth_results.sort(key=lambda x: x.get("label", ""))
            else:
                auth_results = []
                for method, url, body, label in auth_endpoints:
                    r = bench_endpoint(client, method, url, auth_headers, body, args.requests, label)
                    auth_results.append(r)

            all_results.extend(auth_results)
            print_results(auth_results)
        else:
            print(f"\n  (Skipping authenticated endpoints - provide --token to test them)")

        # --- Frontend ---
        if args.frontend:
            print(f"\n>>> Frontend Pages")
            fe_results = bench_frontend(client, args.frontend_url, n=max(args.requests // 2, 5))
            all_results.extend(fe_results)
            print_results(fe_results)

    # --- Output ---
    if args.json:
        print(json.dumps(all_results, indent=2))

    print_summary(all_results)


if __name__ == "__main__":
    main()
