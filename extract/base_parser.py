"""Base class for all scripture parsers — shared utilities and JSON output."""

import json
import os
import re
import unicodedata


class BaseParser:
    """Base class with shared helpers for all scripture parsers.

    Subclasses override ``parse()`` to produce a list of work dicts, each
    with keys ``manifest`` and ``chapters``.  The shared
    ``write_output()`` method serialises them to disk.
    """

    # -- shared helpers ----------------------------------------------------

    @staticmethod
    def slugify(text: str) -> str:
        """Convert *text* to a URL-safe ASCII slug."""
        text = unicodedata.normalize("NFKD", text)
        text = text.encode("ascii", "ignore").decode("ascii")
        text = re.sub(r"[^\w\s-]", "", text).strip().lower()
        return re.sub(r"[-\s]+", "-", text)

    @staticmethod
    def normalize_divine_names(text: str) -> str:
        """Normalize LORD/GOD to title case (small-caps tetragrammaton)."""
        return re.sub(r"\b(?:LORD|GOD)\b", lambda m: m.group().title(), text)

    @staticmethod
    def clean_text(text: str) -> str:
        """Shared text cleanup applied to all verse text regardless of parser."""
        text = re.sub(r"[\[\]]", "", text)
        text = re.sub(r" ([,;:.!?])", r"\1", text)
        text = re.sub(r"  +", " ", text)
        return text.strip()

    @staticmethod
    def normalize_caps_first_words(text: str) -> str:
        """Convert leading ALL-CAPS words to title case.

        Handles the drop-cap convention where the first word(s) of a
        chapter are printed in capitals, e.g. "MASTERED by desire" →
        "Mastered by desire", "IN THE NAME OF GOD" → "In the name of God".
        """
        words = text.split()
        if not words:
            return text
        # Find how many leading words are all-caps (ignoring punctuation).
        # Single uppercase letters (A, I) continue an existing run but
        # don't start one.
        n = 0
        for w in words:
            clean = re.sub(r"[^A-Za-z]", "", w)
            if not clean:
                continue
            if clean == clean.upper() and (len(clean) > 1 or n > 0):
                n += 1
            else:
                break
        if n == 0:
            return text
        # Lower-case the leading caps words, then capitalize the first letter
        for i in range(n):
            words[i] = words[i].lower()
        words[0] = words[0][0].upper() + words[0][1:]
        # Restore divine names that were lowercased
        for i in range(n):
            bare = re.sub(r"[^a-z]", "", words[i])
            if bare in ("god", "lord"):
                words[i] = words[i].capitalize()
        return " ".join(words)

    @staticmethod
    def strip_parenthesized(text: str) -> str:
        """Remove all parenthesized terms and clean up whitespace."""
        text = re.sub(r"\s*\([^)]*\)", "", text)
        text = re.sub(r"  +", " ", text)
        return text.strip()

    @staticmethod
    def make_section(verses, start=1, clean=True):
        """Build a section dict from a list of verse text strings."""
        return {
            "startVerse": start,
            "verses": [
                BaseParser.clean_text(v) if clean else v
                for v in verses
            ],
        }

    # -- JSON cleanup ------------------------------------------------------

    @staticmethod
    def _strip_none(d, skip=frozenset()):
        """Remove None-valued optional fields and internal keys from a dict."""
        return {k: v for k, v in d.items()
                if k not in skip and not (v is None and k in ('name', 'intro'))}

    @classmethod
    def _strip_chapter(cls, chapter):
        return cls._strip_none(chapter, skip={'_book'})

    @classmethod
    def _strip_manifest(cls, manifest):
        out = dict(manifest)
        out['books'] = []
        for book in manifest.get('books', []):
            b = {k: v for k, v in book.items() if not k.startswith('_') and v is not None}
            out['books'].append(b)
        return out

    # -- output ------------------------------------------------------------

    def write_output(self, works: list[dict], output_dir: str) -> None:
        """Write extracted works to *output_dir*.

        Each work is written to ``<output_dir>/<work_id>/``.

        Creates per work::

            <output_dir>/<work_id>/manifest.json
            <output_dir>/<work_id>/chapters/<chapter-id>.json
        """
        for work in works:
            work_dir = os.path.join(output_dir, work["manifest"]["id"])
            os.makedirs(work_dir, exist_ok=True)
            chapters_dir = os.path.join(work_dir, "chapters")
            os.makedirs(chapters_dir, exist_ok=True)

            with open(os.path.join(work_dir, "manifest.json"), "w", encoding="utf-8") as f:
                json.dump(self._strip_manifest(work["manifest"]), f, ensure_ascii=False, indent=2)

            for chapter in work["chapters"]:
                stripped = self._strip_chapter(chapter)
                ch_id = stripped.pop('_id')
                chapter_path = os.path.join(chapters_dir, f"{ch_id}.json")
                with open(chapter_path, "w", encoding="utf-8") as f:
                    json.dump(stripped, f, ensure_ascii=False, indent=2)
