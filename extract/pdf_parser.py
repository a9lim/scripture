"""Abstract base class for PDF-based scripture parsers."""

from abc import ABC, abstractmethod

import fitz

from base_parser import BaseParser


class PdfParser(BaseParser, ABC):
    """Base class for parsers that extract from PDF via PyMuPDF.

    Subclasses implement ``extract_chapters()`` and ``build_manifest()``
    for their specific PDF layout.
    """

    @abstractmethod
    def extract_chapters(self, doc: fitz.Document) -> list[dict]:
        """Return a list of chapter dicts.

        Each dict follows this schema::

            {
                "chapter": <int>,
                "id": "<slug>",
                "name": "<descriptive name or None>",
                "intro": "<chapter intro text or None>",
                "sections": [
                    {
                        "title": "<section heading or None>",
                        "verses": [
                            {
                                "number": <int>,
                                "text": "<verse body>"
                            },
                            ...
                        ]
                    },
                    ...
                ]
            }
        """

    @abstractmethod
    def build_manifest(self, chapters: list[dict]) -> dict:
        """Return a work manifest dict.

        Expected shape::

            {
                "id": "<work-id>",
                "title": "<display title>",
                "books": [
                    {
                        "id": "<book-slug>",
                        "name": "<book name>",
                        "chapters": [<chapter-number>, ...]
                    },
                    ...
                ]
            }
        """

    def parse(self, pdf_path: str) -> list[dict]:
        """Open *pdf_path* with PyMuPDF and run the full extraction pipeline.

        Returns a list of work dicts, each with keys
        ``manifest`` and ``chapters``.

        ``build_manifest()`` may return a single manifest dict (backward
        compatible) or a list of manifest dicts.  When returning a list,
        each manifest should include a ``_chapter_ids`` set so that
        chapters can be partitioned across works.
        """
        doc = fitz.open(pdf_path)
        try:
            chapters = self.extract_chapters(doc)
            manifests = self.build_manifest(chapters)
        finally:
            doc.close()

        # Normalize single manifest → list
        if isinstance(manifests, dict):
            manifests = [manifests]

        works = []
        for manifest in manifests:
            chapter_ids = manifest.pop("_chapter_ids", None)
            if chapter_ids is not None:
                work_chapters = [ch for ch in chapters if ch["id"] in chapter_ids]
            else:
                work_chapters = chapters
            works.append({
                "manifest": manifest,
                "chapters": work_chapters,
            })

        return works
