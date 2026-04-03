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
