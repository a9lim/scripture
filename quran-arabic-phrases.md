# Arabic Transliterations in Quran (Pickthall 1930)

## Translated (replaced by parser)
| Original | Replacement |
|----------|-------------|
| Allah | God |
| Qur'an / Quran | record |
| surah | chapter |
| Arabic | native |
| Shu'eyb | Jethro |
| Iblis | the Devil |
| Dhu'l-Qarneyn | Cyrus |
| Dhu'n-Nun | Jonah |
| Idris | Enoch |
| Azar | Terah |
| 'Imran | Amram |
| Saba | Sheba |
| Dhu'l-Kifl | Ezekiel |
| Luqman | Achiacharus |
| Bakkah | Baca |
| Al-Judi | Ararat |
| As-Samiri / Samiri | the Samaritan |
| Al-Mu'tafikah | Sodom and Gomorrah |
| 'Iram / Iram | Aram |
| 'Illiyin | Exaltation |
| Shebaeans | Sabians |
| Zanjabil | ginger |
| Kafur | camphor |
| Al-Hijr | the Rock |
| Sijjin | Perdition |
| Hud | Lehi |
| Muhammad | Mohammed |
| jinn / Jinn | genies / Genies |
| Muhajirin | emigrants |
| Ansar | helpers |
| qiblah / Qiblah | direction of prayer |
| Ka'bah | see Speculative → Cabah |

## Already English in Pickthall (no parser action needed)
| Arabic | English in Text | Count | References |
|--------|----------------|------:|------------|
| Qarun | Korah | 5 | 28:76-79, 29:39, 40:24 |
| Ya'juj / Ma'juj | Gog / Magog | 3 | 18:94, 21:96 |
| Madyan | Midian | 10 | 7:85, 9:70, 11:84-95, 20:40, 22:44, 28:22-45, 29:36 |
| Majus | Magians | 1 | 22:17 |
| Ilyas | Elias | 2 | 37:123, 37:130 |
| Zachariah | Zachariah | 2 | 19:2, 19:7 |
| Ezra | Ezra | 1 | 9:30 |
| Baal | Baal | 1 | 37:125 |
| Babel | Babel | 1 | 2:102 |

## Surah titles updated (in `_surah_names.py`)
| Surah | Original Title | Updated Title | Source |
|------:|----------------|---------------|--------|
| 3 | The Family of Imran | The Family of Amram | translated ('Imran→Amram) |
| 11 | Hud | Lehi | translated (Hud→Lehi; Hamblin 2002) |
| 27 | The Naml | The Nemal | speculative (Naml→Nemal) |
| 31 | Luqman | Achiacharus | translated (Luqman→Achiacharus) |
| 34 | The Saba | Sheba | translated (Saba→Sheba) |
| 47 | Muhammad | Mohammed | translated (Muhammad→Mohammed) |
| 72 | The Jinn | The Genies | translated (jinn→genies) |
| 106 | The Quraish | The Coresh | speculative (Quraish→Coresh) |

## Speculative translations (pseudo-Hebrew coinages, replaced by parser)

Arabic terms run through the Proto-Semitic consonant/vowel pipeline to produce KJV/Book of Mormon-style pseudo-Hebrew names. See `word-correspondence.md` Part VII for full derivations. **NOT scholarly identifications.**

| Original | Replacement | Pipeline highlights |
|----------|-------------|---------------------|
| Thamud | Shamod | th→sh |
| A'ad | Od | '→silent, a→o |
| Qureysh / Quraish | Coresh | q→c, ai→e (= Hebrew "Cyrus") |
| Salih | Zoleah | s→z, fa'il→qotel |
| Abu Lahab | Abi-Lahav | construct + Heb. *lahav* "flame" attested |
| Tubb'a | Tobba | u→o, '→silent |
| Harut / Marut | Horot / Morot | a→o, u→o (Avestan loan) |
| Zeyd | Zed | ai→e |
| Mecca | Maccah | cc geminate |
| Makka | Maccah | kk→cc |
| Al-Madinah / Madinah | Medinah | pretonic reduction (Heb. *medinah* attested) |
| Badr | Beder | segolate CeCeC |
| Uhud | Ohod | u→o, h→h |
| Yathrib | Yashrib | th→sh |
| 'Arafat / Arafat | Araphoth | f→ph, a→o, -at→-oth |
| Tabuk | Taboc | u→o, k→c |
| Ar-Rass | Rass | *s-path, unchanged |
| As-Safa | Zapho | s→z, f→ph, a→o |
| Al-Marwah | Marvah | w→v |
| Tuwa | Tuvah | t→t, w→v, -a preserved (glide-adjacent exception), -ah |
| Huneyn | Honen | h→h, ai→e (Heb. *honen* "showing grace" attested) |
| Ka'bah | Cabah | k→c, '→silent |
| Al-Lat | Elath | fem. of *'el* (KJV 2 Kgs 14:22 attested) |
| Al-'Uzza | Ozzoh | '→silent, a→o |
| Lat | Elath | fem. of *'el* |
| Uzza | Ozzoh | '→silent, a→o |
| Manat | Menoth | a→e (pretonic), a→o, t→th |
| Wadd | Vad | w→v |
| Suwa' | Shovah | s→sh (s-path), u→o, w→v, a preserved (glide-adjacent), '→silent |
| Yaghuth | Yaosh | gh→silent, th→sh |
| Ya'uq | Yaoc | '→silent, u→o, q→c |
| Nasr | Nesher | s→sh, segolate (Heb. *nesher* "eagle" attested) |
| Ramadan | Ramazon | d→z, -an→-on |
| Bahirah | Behirah | h→h (Heb. *behirah* "chosen" attested) |
| Sa'ibah | Shoevah | s→sh |
| Wasilah | Vezilah | w→v, s→z |
| Hami | Homeh | h→h, fa'il→qotel (lamed-he: final -eh) |
| Salsabil | Shalshabil | s→sh (s-path, both sins) |
| Tasnim | Tashnim | s→sh (s-path) |
| Zaqqum | Zaccom | qq→cc, u→o |
