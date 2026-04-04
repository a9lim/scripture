"""Parser registry — maps parser names to their classes."""

from parsers.bundahis import BundahisParser
from parsers.quran import QuranParser
from parsers.quad import QuadParser
from parsers.kjv_vpl import KjvVplParser
from parsers.fourbooks import FourBooksParser
from parsers.ttc import TtcParser
from parsers.kojiki import KojikiParser
from parsers.viraf import VirafParser
from parsers.bop import BopParser
from parsers.kalevala import KalevalaParser
from parsers.edda import EddaParser

PARSERS: dict[str, type] = {
    "bundahis": BundahisParser,
    "quran": QuranParser,
    "quad": QuadParser,
    "kjv-vpl": KjvVplParser,
    "fourbooks": FourBooksParser,
    "ttc": TtcParser,
    "kojiki": KojikiParser,
    "viraf": VirafParser,
    "bop": BopParser,
    "kalevala": KalevalaParser,
    "edda": EddaParser,
}
