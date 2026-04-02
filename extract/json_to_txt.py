#!/usr/bin/env python3
"""Convert extracted JSON scripture data to self-contained text files.

Usage:
    python3 json_to_txt.py [data_dir] [output_dir]

Defaults:
    data_dir   = ../data
    output_dir = ../text

Produces per work:
    {workId}.txt — verses, sections, intros, metadata
"""

import json
import os
import sys


def main():
    data_dir = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data'))
    output_dir = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'text'))
    os.makedirs(output_dir, exist_ok=True)

    with open(os.path.join(data_dir, 'works.json')) as f:
        works = json.load(f)

    for work_id in works:
        work_dir = os.path.join(data_dir, work_id)
        with open(os.path.join(work_dir, 'manifest.json')) as f:
            manifest = json.load(f)

        lines = []

        # Work header
        lines.append(f'WORK: {manifest["id"]} | {manifest["title"]}')

        for book in manifest['books']:
            lines.append(f'BOOK: {book["id"]} | {book["name"]}')

            for ch_meta in book['chapters']:
                ch_id = ch_meta['id']
                ch_path = os.path.join(work_dir, 'chapters', f'{ch_id}.json')
                with open(ch_path) as f:
                    ch = json.load(f)

                # Chapter header — name only when descriptive
                header = f'CHAPTER: {ch["id"]}'
                if ch.get('name'):
                    header += f' | {ch["name"]}'
                lines.append(header)

                # Intro
                if ch.get('intro'):
                    lines.append(f'> {ch["intro"]}')

                # Sections and verses
                num_sections = len(ch['sections'])
                next_verse = 1
                for si, section in enumerate(ch['sections']):
                    start = section['startVerse']
                    if si == 0:
                        if start != 1:
                            lines.append(f'@ {start}')
                    elif num_sections > 1:
                        if start == 1:
                            lines.append('~ @')
                        elif start != next_verse:
                            lines.append(f'~ @ {start}')
                        else:
                            lines.append('~')

                    for verse in section['verses']:
                        lines.append(verse['text'])
                        next_verse = verse['number'] + 1

        # Write text file
        txt_path = os.path.join(output_dir, f'{work_id}.txt')
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines) + '\n')
        print(f'  {txt_path}')


if __name__ == '__main__':
    main()
