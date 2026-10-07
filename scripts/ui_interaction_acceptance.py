#!/usr/bin/env python3
"""Run A01–A22 on the actual UI backed by disposable synthetic storage.

server/.venv/bin/python scripts/ui_interaction_acceptance.py
Use --group archives|workshops or --case A01 --case A02 for focused reruns.
"""
import argparse

from interaction_acceptance_support import Harness


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", choices=["all", "archives", "workshops"], default="all")
    parser.add_argument("--case", action="append", default=[])
    args = parser.parse_args()
    with Harness(group=args.group, cases=args.case) as harness:
        if args.group in {"all", "archives"}:
            from ui_interaction_acceptance_archives import run
            run(harness)
        if args.group in {"all", "workshops"}:
            from ui_interaction_acceptance_workshops import run
            run(harness)
        result = harness.write_results()
    if not result["cases"] or result["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
