#!/usr/bin/env python3
"""CLI entry point for scripture extraction.

Usage::

    python3 extract.py <source> --parser <name> --output <dir>

Source can be a PDF, plaintext file, or directory depending on the parser.

For the internal text format (text/*.txt → JSON), use txt_to_json.py instead.
"""

import argparse
import sys
import os

# Ensure the extract/ directory is on sys.path so `parsers` resolves
# when invoked as `python3 extract.py` from within extract/.
_here = os.path.dirname(os.path.abspath(__file__))
if _here not in sys.path:
    sys.path.insert(0, _here)

from parsers import PARSERS


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract structured JSON from a scripture source file."
    )
    parser.add_argument("source", help="Path to the source (PDF, TXT, or directory)")
    parser.add_argument(
        "--parser",
        required=True,
        choices=sorted(PARSERS.keys()),
        help="Parser to use for this source",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output directory for JSON files",
    )

    args = parser.parse_args()

    if not os.path.exists(args.source):
        print(f"Error: source not found: {args.source}", file=sys.stderr)
        sys.exit(1)

    parser_cls = PARSERS[args.parser]
    p = parser_cls()

    print(f"Parsing {args.source} with {args.parser} parser...")
    works = p.parse(args.source)

    print(f"Writing output to {args.output}/")
    p.write_output(works, args.output)

    for work in works:
        wid = work["manifest"]["id"]
        n_ch = len(work["chapters"])
        print(f"  {wid}: {n_ch} chapters")

    total = sum(len(w["chapters"]) for w in works)
    print(f"Done: {total} chapters across {len(works)} work(s).")


if __name__ == "__main__":
    main()
