"""Parser registry — maps parser names to their classes."""

from parsers.bundahis import BundahisParser
from parsers.quran import QuranParser
from parsers.quad import QuadParser
from parsers.kjv_vpl import KjvVplParser
from parsers.fourbooks import FourBooksParser
from parsers.ttc import TtcParser
from parsers.kojiki import KojikiParser

PARSERS: dict[str, type] = {
    "bundahis": BundahisParser,
    "quran": QuranParser,
    "quad": QuadParser,
    "kjv-vpl": KjvVplParser,
    "fourbooks": FourBooksParser,
    "ttc": TtcParser,
    "kojiki": KojikiParser,
}
