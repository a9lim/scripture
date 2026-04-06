#!/usr/bin/env python3
"""Patch bom.txt to align word content with the PDF-sourced Book of Mormon.

Replaces verse text where the two editions have different words (not just
punctuation, case, parentheses, or hyphenation differences).  Preserves the
bom.txt line-wrap formatting style.

Usage:
    python3 patch_bom.py [path/to/bom.txt]
"""

import json
import os
import re
import sys
import textwrap

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from base_parser import BaseParser

# ── Parse bom.txt ──────────────────────────────────────────────────────

_BOOK_RE = re.compile(r"^([\w ]+?)\s+Chapter\s+(\d+)\s*$")
_VERSE_RE = re.compile(r"^(\d+):(\d+)\s+(.*)")

_NAME_TO_ID = {
    "1 Nephi": "1-ne", "2 Nephi": "2-ne", "Jacob": "jacob", "Enos": "enos",
    "Jarom": "jarom", "Omni": "omni", "Words of Mormon": "w-of-m",
    "Mosiah": "mosiah", "Alma": "alma", "Helaman": "hel",
    "3 Nephi": "3-ne", "4 Nephi": "4-ne", "Mormon": "morm",
    "Ether": "ether", "Moroni": "moroni",
}


def _parse_bom(lines):
    """Return {(book_name, ch, vs): raw_text} and {key: (start_line, end_line)}."""
    verses = {}
    spans = {}
    cur_book = None
    cur_key = None
    cur_text = []
    cur_start = 0

    def flush(end):
        if cur_key and cur_text:
            verses[cur_key] = " ".join(cur_text)
            spans[cur_key] = (cur_start, end)

    for i, raw in enumerate(lines):
        line = raw.rstrip("\n")
        bm = _BOOK_RE.match(line)
        if bm:
            flush(i)
            cur_book = bm.group(1).strip()
            cur_key = None
            cur_text = []
            continue
        vm = _VERSE_RE.match(line)
        if vm:
            flush(i)
            ch, vs = int(vm.group(1)), int(vm.group(2))
            cur_key = (cur_book, ch, vs)
            cur_text = [vm.group(3).strip()]
            cur_start = i
            continue
        stripped = line.strip()
        if stripped and cur_key:
            cur_text.append(stripped)
        elif not stripped and cur_key:
            flush(i)
            # don't clear cur_key — next verse or header will do that

    flush(len(lines))
    return verses, spans


def _is_real_text_diff(pdf_verse, txt_verse):
    """True if the verses differ in actual words (not just punct/case/parens/hyphens)."""
    if pdf_verse == txt_verse:
        return False
    a = re.sub(r"[\(\)\-]", " ", pdf_verse).replace("\u2014", " ")
    b = re.sub(r"[\(\)\-]", " ", txt_verse).replace("\u2014", " ")
    a = re.sub(r"[^a-z ]", "", a.lower()).split()
    b = re.sub(r"[^a-z ]", "", b.lower()).split()
    return a != b


def _wrap_verse(ch, vs, text, width=72):
    """Format a verse as CH:VS text with line wrapping."""
    prefix = f"{ch}:{vs} "
    wrapped = textwrap.fill(text, width=width, initial_indent=prefix,
                            subsequent_indent="", break_long_words=False,
                            break_on_hyphens=False)
    return wrapped


def main():
    bom_path = sys.argv[1] if len(sys.argv) > 1 else "../raw/bom.txt"
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "bom")

    with open(bom_path, encoding="utf-8") as f:
        lines = f.readlines()

    verses, spans = _parse_bom(lines)
    manifest = json.load(open(os.path.join(data_dir, "manifest.json")))

    # Build replacement map: line range → new text
    replacements = {}  # (start, end) → new_lines
    count = 0

    for book in manifest["books"]:
        bid = book["id"]
        book_name = next((n for n, i in _NAME_TO_ID.items() if i == bid), None)
        if not book_name:
            continue
        start = book.get("start", 1)
        for i in range(book["chapters"]):
            ch_num = start + i
            ch_id = f"{bid}-{ch_num}"
            ch_path = os.path.join(data_dir, "chapters", f"{ch_id}.json")
            if not os.path.exists(ch_path):
                continue
            ch_data = json.load(open(ch_path))
            pdf_vs = [v for s in ch_data["sections"] for v in s["verses"]]

            for vs_idx, pv in enumerate(pdf_vs):
                vs_num = vs_idx + 1
                key = (book_name, ch_num, vs_num)
                tv = verses.get(key)
                if tv is None:
                    continue
                tv_clean = BaseParser.clean_text(tv)
                if not _is_real_text_diff(pv, tv_clean):
                    continue

                # Replace this verse's text with the PDF version.
                # We need to undo clean_text transforms to get raw-ish text:
                # clean_text strips brackets and normalizes dashes/spaces,
                # but the PDF data has already been through it, so we use pv directly.
                span = spans.get(key)
                if span is None:
                    continue
                s, e = span
                new_text = _wrap_verse(ch_num, vs_num, pv)
                replacements[(s, e)] = new_text.split("\n")
                count += 1

    if count == 0:
        print("No changes needed — already patched.")
        return

    # Apply replacements in reverse order to preserve line numbers
    for (s, e), new_lines in sorted(replacements.items(), reverse=True):
        # Replace lines[s:e] with new_lines + blank line
        lines[s:e] = [l + "\n" for l in new_lines] + ["\n"]

    with open(bom_path, "w", encoding="utf-8") as f:
        f.writelines(lines)

    print(f"Patched {count} verses with word-level differences in {bom_path}")


if __name__ == "__main__":
    main()
