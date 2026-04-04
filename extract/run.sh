#!/usr/bin/env bash
# All-in-one helper for the scripture extraction pipeline.
#
# Usage:
#   ./run.sh scrape <sacred-texts-index-url>
#   ./run.sh extract-raw
#   ./run.sh json2txt
#   ./run.sh txt2json
#   ./run.sh verify
#   ./run.sh reindex
#   ./run.sh concordance
#   ./run.sh similarity
#   ./run.sh enrich

set -euo pipefail
cd "$(dirname "$0")"

DATA=../data
TEXT=../text
RAW=../raw

case "${1:-}" in

scrape)
    [ -z "${2:-}" ] && { echo "Usage: $0 scrape <sacred-texts-index-url>"; exit 1; }
    url="$2"
    # Derive filename from the URL path: /cfu/menc/index.htm → menc
    slug=$(echo "$url" | sed -E 's|.*/([^/]+)/index\.htm.*|\1|')
    out="$RAW/${slug}_raw.txt"
    echo "Scraping $url → $out"
    python3 scrape_sacred_texts.py "$url" "$out"
    ;;

extract-raw)
    echo "=== PDF: Quad → bom, dc, pgp, ot, nt ==="
    python3 extract.py "$RAW/quad_regular_simulated_black_unindexed.pdf" --parser quad --output "$DATA"

    echo "=== TXT: Quran (Pickthall) ==="
    python3 extract.py "$RAW/pick-quran.txt" --parser quran --output "$DATA"

    echo "=== Plaintext: Apocrypha (KJV VPL) ==="
    python3 extract.py "$RAW/eng-kjv_vpl.txt" --parser kjv-vpl --output "$DATA"

    echo "=== Plaintext: Four Books (GL, DM, Analects) ==="
    python3 extract.py "$RAW" --parser fourbooks --output "$DATA"

    echo "=== Plaintext: Tao Te Ching ==="
    python3 extract.py "$RAW/ttc.txt" --parser ttc --output "$DATA"

    echo "=== Plaintext: Kojiki ==="
    python3 extract.py "$RAW/kj.txt" --parser kojiki --output "$DATA"

    echo "=== Plaintext: Bundahishn ==="
    python3 extract.py "$RAW/bundraw.txt" --parser bundahis --output "$DATA"

    echo "=== Scraped: Mencius → fourbooks ==="
    python3 parse_scraped.py "$RAW/mencius_raw.txt" --output "$DATA" \
        --work-id fourbooks --book-id mencius --book-name Mencius

    echo "=== Scraped: Lotus Sutra ==="
    python3 parse_scraped.py "$RAW/lotus_raw.txt" --output "$DATA" \
        --work-id lotus --work-title "Lotus Sutra" --book-id lotus --book-name "Lotus Sutra"

    echo "=== Plaintext: Arda Viraf ==="
    python3 extract.py "$RAW/virafraw.txt" --parser viraf --output "$DATA"

    echo "=== Plaintext: Book of Poetry ==="
    python3 extract.py "$RAW/bop.txt" --parser bop --output "$DATA"

    echo "=== Plaintext: Kalevala ==="
    python3 extract.py "$RAW/kv.txt" --parser kalevala --output "$DATA"

    echo "=== Plaintext: Poetic Edda ==="
    python3 extract.py "$RAW/poe.txt" --parser edda --output "$DATA"

    echo "=== Rebuilding search index ==="
    python3 search_index.py "$DATA"
    ;;

json2txt)
    echo "Converting JSON → text"
    python3 json_to_txt.py "$DATA" "$TEXT"
    ;;

txt2json)
    echo "Converting text → JSON"
    for f in "$TEXT"/*.txt; do
        work=$(basename "$f" .txt)
        echo "  $work"
        python3 txt_to_json.py "$f" --output "$DATA"
    done
    echo "Rebuilding search index"
    python3 search_index.py "$DATA"
    echo "Building concordance index"
    python3 concordance.py "$DATA"
    echo "Building similarity index (requires scikit-learn)"
    python3 similarity.py "$DATA" || echo "  (skipped — install scikit-learn)"
    ;;

verify)
    python3 verify_data.py "$DATA"
    ;;

reindex)
    python3 search_index.py "$DATA"
    ;;

concordance)
    echo "Building concordance index"
    python3 concordance.py "$DATA"
    ;;

similarity)
    echo "Building similarity index"
    python3 similarity.py "$DATA"
    ;;

enrich)
    echo "Building concordance index"
    python3 concordance.py "$DATA"
    echo "Building similarity index"
    python3 similarity.py "$DATA"
    ;;

pipeline)
    "$0" extract-raw
    "$0" json2txt
    "$0" enrich
    "$0" verify
    ;;

*)
    echo "Usage: $0 {scrape <url>|extract-raw|json2txt|txt2json|verify|reindex|concordance|similarity|enrich|pipeline}"
    exit 1
    ;;

esac
