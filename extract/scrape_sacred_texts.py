#!/usr/bin/env python3
"""Scrape a work from sacred-texts.com to a raw text file.

Requires: pip install cloudscraper beautifulsoup4

Takes an index page URL, discovers chapter links, scrapes each page,
and writes them to a single text file with ``=== CHAPTER N ===`` markers.

Usage::

    python3 scrape_sacred_texts.py <index_url> <output_file>

Examples::

    python3 scrape_sacred_texts.py https://sacred-texts.com/cfu/menc/index.htm ../raw/mencius_raw.txt
    python3 scrape_sacred_texts.py https://sacred-texts.com/hin/gita/index.htm ../raw/gita_raw.txt
"""

import re
import sys
import time
from urllib.parse import urljoin

import cloudscraper
from bs4 import BeautifulSoup


def discover_chapters(session, index_url):
    """Fetch the index page and return an ordered list of chapter URLs."""
    r = session.get(index_url)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    # Base directory of the index page
    base_dir = index_url.rsplit("/", 1)[0] + "/"

    seen = set()
    chapters = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # Skip anchors, external links, and the index itself
        if href.startswith("#") or href.startswith("http"):
            continue
        if href == "index.htm":
            continue
        # Only follow links within the same directory
        full = urljoin(index_url, href)
        if not full.startswith(base_dir):
            continue
        if full not in seen:
            seen.add(full)
            label = a.get_text(strip=True)
            chapters.append((full, label))

    return chapters


def scrape_page(session, url):
    """Fetch a page and extract its body text, stripping nav chrome."""
    r = session.get(url)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    # Remove nav/header/footer elements before extracting text
    for tag in soup.select("title, script, style, noscript"):
        tag.decompose()

    body = soup.get_text("\n", strip=False)
    lines = body.split("\n")

    _NAV_WORDS = {
        "Sacred-texts", "Sacred Texts", "sacred-texts.com",
        "Index", "Previous", "Next", "Next »", "« Previous",
        "Confucianism", "Hinduism", "Islam", "Judaism",
        "Christianity", "Buddhism", "Taoism", "Zoroastrianism",
        "Shinto",
    }

    def _is_nav(s):
        """True if a line looks like site navigation."""
        return not s or any(w in s for w in _NAV_WORDS)

    # Strip leading nav: skip lines until we hit substantive content
    start = 0
    for j, line in enumerate(lines):
        s = line.strip()
        if not s:
            continue
        if _is_nav(s) or len(s) < 5:
            continue
        # First numbered verse or long paragraph = content
        if re.match(r"^\d+\.\s", s) or len(s) > 80:
            start = j
            break

    # Strip trailing nav/footer: scan backwards, skipping blanks and nav
    end = len(lines)
    for j in range(len(lines) - 1, -1, -1):
        s = lines[j].strip()
        if _is_nav(s) or len(s) < 5:
            end = j
            continue
        break

    return "\n".join(lines[start:end]).strip()


def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <index_url> <output_file>", file=sys.stderr)
        sys.exit(1)

    index_url = sys.argv[1]
    output_file = sys.argv[2]

    session = cloudscraper.create_scraper()

    print(f"Discovering chapters from {index_url}...")
    chapters = discover_chapters(session, index_url)
    print(f"  Found {len(chapters)} chapter links")

    if not chapters:
        print("Error: no chapter links found", file=sys.stderr)
        sys.exit(1)

    with open(output_file, "w", encoding="utf-8") as f:
        for i, (url, label) in enumerate(chapters):
            print(f"  [{i + 1}/{len(chapters)}] {label}...", end="", flush=True)
            text = scrape_page(session, url)
            f.write(f"=== CHAPTER {i + 1} ===\n")
            f.write(text + "\n\n")
            print(f" {len(text)} chars")
            time.sleep(0.5)

    print(f"Done: {len(chapters)} chapters written to {output_file}")


if __name__ == "__main__":
    main()
