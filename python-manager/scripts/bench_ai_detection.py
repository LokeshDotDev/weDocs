#!/usr/bin/env python3
import argparse
import math
import sys
import time
import requests

DEFAULT_MANAGER_URL = "http://localhost:5002"

LOREM = (
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. "
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. "
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. "
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. "
)


def make_chunk(size: int) -> str:
    if size <= 0:
        return ""
    s = []
    base = LOREM
    while sum(len(x) for x in s) < size:
        s.append(base)
    joined = "".join(s)
    return joined[:size]


def build_texts(total_chars: int, chunk_size: int) -> list[str]:
    n = max(1, math.ceil(total_chars / chunk_size))
    texts = []
    for i in range(n):
        remaining = total_chars - i * chunk_size
        size = chunk_size if remaining >= chunk_size else remaining
        texts.append(make_chunk(size))
    return texts


def main():
    ap = argparse.ArgumentParser(description="Benchmark AI batch-detect via python-manager")
    ap.add_argument("--manager-url", default=DEFAULT_MANAGER_URL, help="python-manager base URL (default: %(default)s)")
    ap.add_argument("--total-chars", type=int, default=36000, help="Total characters to process (default: %(default)s)")
    ap.add_argument("--chunk-size", type=int, default=2000, help="Approx chunk size in characters (default: %(default)s)")
    ap.add_argument("--show-results", action="store_true", help="Print returned predictions")
    args = ap.parse_args()

    mgr = args.manager_url.rstrip("/")

    # Warm-up: initialize models (excluded from timing)
    try:
        warm = {"text": "warmup text to init models"}
        requests.post(f"{mgr}/ai-detection/detect", json=warm, timeout=300)
    except Exception:
        pass

    texts = build_texts(args.total_chars, args.chunk_size)
    payload = {"texts": texts}

    t0 = time.perf_counter()
    r = requests.post(f"{mgr}/ai-detection/batch-detect", json=payload, timeout=600)
    dt = time.perf_counter() - t0

    if r.status_code != 200:
        print(f"Error: status {r.status_code}: {r.text}")
        sys.exit(1)

    data = r.json()
    n = len(texts)
    throughput = args.total_chars / dt
    print(f"Batch-detect OK | chunks={n} total_chars={args.total_chars} elapsed={dt:.2f}s throughput={throughput:.1f} chars/s")

    if args.show_results:
        print(data)


if __name__ == "__main__":
    main()
