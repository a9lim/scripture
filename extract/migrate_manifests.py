#!/usr/bin/env python3
"""One-time migration: convert manifests to simplified format.

- chapters array → integer count
- Add abbrev per book (from refs.js BOOKS map)
- Add start per book (when first chapter number != 1)
- Add names array per book (when any chapter has a name)
- Remove name field from chapter JSON files
- Remove verses count from manifest chapter entries
"""

import json
import os

DATA = os.path.join(os.path.dirname(__file__), '..', 'data')

# Abbreviations from refs.js BOOKS map — single source during migration
ABBREVS = {
    'gen': 'Gen.', 'ex': 'Ex.', 'lev': 'Lev.', 'num': 'Num.',
    'deut': 'Deut.', 'josh': 'Josh.', 'judg': 'Judg.', 'ruth': 'Ruth',
    '1-sam': '1 Sam.', '2-sam': '2 Sam.', '1-kgs': '1 Kgs.', '2-kgs': '2 Kgs.',
    '1-chr': '1 Chr.', '2-chr': '2 Chr.', 'ezra': 'Ezra', 'neh': 'Neh.',
    'esth': 'Esth.', 'job': 'Job', 'ps': 'Ps.', 'prov': 'Prov.',
    'eccl': 'Eccl.', 'song': 'Song', 'isa': 'Isa.', 'jer': 'Jer.',
    'lam': 'Lam.', 'ezek': 'Ezek.', 'dan': 'Dan.', 'hosea': 'Hosea',
    'joel': 'Joel', 'amos': 'Amos', 'obad': 'Obad.', 'jonah': 'Jonah',
    'micah': 'Micah', 'nahum': 'Nahum', 'hab': 'Hab.', 'zeph': 'Zeph.',
    'hag': 'Hag.', 'zech': 'Zech.', 'mal': 'Mal.',
    'matt': 'Matt.', 'mark': 'Mark', 'luke': 'Luke', 'john': 'John',
    'acts': 'Acts', 'rom': 'Rom.', '1-cor': '1 Cor.', '2-cor': '2 Cor.',
    'gal': 'Gal.', 'eph': 'Eph.', 'philip': 'Philip.', 'col': 'Col.',
    '1-thes': '1 Thes.', '2-thes': '2 Thes.', '1-tim': '1 Tim.',
    '2-tim': '2 Tim.', 'titus': 'Titus', 'philem': 'Philem.',
    'heb': 'Heb.', 'james': 'James', '1-pet': '1 Pet.', '2-pet': '2 Pet.',
    '1-jn': '1 Jn.', '2-jn': '2 Jn.', '3-jn': '3 Jn.', 'jude': 'Jude',
    'rev': 'Rev.',
    '1-ne': '1 Ne.', '2-ne': '2 Ne.', 'jacob': 'Jacob', 'enos': 'Enos',
    'jarom': 'Jarom', 'omni': 'Omni', 'w-of-m': 'W of M',
    'mosiah': 'Mosiah', 'alma': 'Alma', 'hel': 'Hel.', '3-ne': '3 Ne.',
    '4-ne': '4 Ne.', 'morm': 'Morm.', 'ether': 'Ether', 'moro': 'Moro.',
    'dc': 'D&C', 'od': 'OD',
    'moses': 'Moses', 'abr': 'Abr.', 'js-m': 'JS\u2014M',
    'js-h': 'JS\u2014H', 'a-of-f': 'A of F',
    'quran': 'Quran',
    'tobit': 'Tobit', 'judith': 'Judith', 'add-esth': 'Add. Esth.',
    'wis': 'Wis.', 'sir': 'Sir.', 'bar': 'Bar.', 'pr-azar': 'Pr. Azar.',
    'sus': 'Sus.', 'bel': 'Bel', '1-macc': '1 Macc.', '2-macc': '2 Macc.',
    '1-esd': '1 Esd.', 'pr-man': 'Pr. Man.', '2-esd': '2 Esd.',
    'gl': 'G.L.', 'dom': 'D.M.', 'analects': 'Analects', 'mencius': 'Mencius',
    'ttc': 'T.T.C.',
    'kjk': 'Kami.', 'kjn': 'Naka.', 'kjs': 'Shimo.',
    'bund': 'Bund.',
    'lotus': 'Lotus',
}


def migrate():
    works = json.load(open(os.path.join(DATA, 'works.json')))

    for work_id in works:
        work_dir = os.path.join(DATA, work_id)
        manifest_path = os.path.join(work_dir, 'manifest.json')
        manifest = json.load(open(manifest_path))

        new_books = []
        for book in manifest['books']:
            book_id = book['id']
            old_chapters = book['chapters']
            count = len(old_chapters)

            new_book = {
                'id': book_id,
                'name': book['name'],
                'abbrev': ABBREVS.get(book_id, book['name']),
                'chapters': count,
            }

            # Detect start (first chapter number)
            if old_chapters:
                first_id = old_chapters[0]['id']
                first_num = int(first_id.rsplit('-', 1)[-1])
                if first_num != 1:
                    new_book['start'] = first_num

            # Collect names
            names = [ch.get('name') for ch in old_chapters]
            if any(n is not None for n in names):
                new_book['names'] = names

            new_books.append(new_book)

            # Strip name from chapter JSON files
            chapters_dir = os.path.join(work_dir, 'chapters')
            for ch_meta in old_chapters:
                ch_path = os.path.join(chapters_dir, f"{ch_meta['id']}.json")
                if not os.path.exists(ch_path):
                    continue
                ch = json.load(open(ch_path))
                if 'name' in ch:
                    del ch['name']
                    with open(ch_path, 'w', encoding='utf-8') as f:
                        json.dump(ch, f, ensure_ascii=False, indent=2)

        manifest['books'] = new_books
        # Remove translations if empty
        if 'translations' in manifest and not manifest['translations']:
            del manifest['translations']

        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

        print(f"  {work_id}: {sum(b['chapters'] for b in new_books)} chapters")

    print("Done.")


if __name__ == '__main__':
    migrate()
