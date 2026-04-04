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

## Surah letter names hebraized (in `_postprocess`, regex-based)
| Arabic Letter | Hebrew Letter | Example |
|--------------|---------------|---------|
| Alif / Alim | Aleph | 2:1 |
| Lam | Lamed | 2:1 |
| Mim | Mem | 2:1 |
| Ra | Resh | 10:1 |
| Kaf | Kaph | 19:1 |
| Ha | Heh | 19:1 |
| Ya | Yod | 19:1 |
| A'in | Ayin | 19:1 |
| Sad | Zadeh | 38:1 |
| Ta | Teth | 20:1 |
| Sin | Shin | 26:1 |
| Qaf | Qoph | 50:1 |
| Nun | Nun | 68:1 |

## Surah titles updated (in `_surah_names.py`)
| Surah | Original Title | Updated Title | Source |
|------:|----------------|---------------|--------|
| 3 | The Family of Imran | The Family of Amram | translated ('Imran→Amram) |
| 11 | Hud | Lehi | translated (Hud→Lehi; Hamblin 2002) |
| 20 | Ta Ha | Teth Heh | hebraized letter names |
| 27 | The Naml | The Nemal | speculative (Naml→Nemal) |
| 31 | Luqman | Achiacharus | translated (Luqman→Achiacharus) |
| 34 | The Saba | Sheba | translated (Saba→Sheba) |
| 36 | Ya Sin | Yod Shin | hebraized letter names |
| 38 | Sad | Zadeh | hebraized letter name |
| 41 | Ha Mim | Heh Mem | hebraized letter names |
| 47 | Muhammad | Mahemod | speculative (Muhammad→Mahemod) |
| 50 | Qaf | Qoph | hebraized letter name |
| 72 | The Jinn | Ginn | speculative (jinn→ginn, j→g) |
| 106 | The Quraish | The Coresh | speculative (Quraish→Coresh) |

## Speculative translations (pseudo-Hebrew coinages, replaced by parser)

Arabic terms run through the Proto-Semitic consonant/vowel pipeline to produce KJV/Book of Mormon-style pseudo-Hebrew names. See `word-correspondence.md` Part VII for full derivations. **NOT scholarly identifications.**

| Original | Replacement | Pipeline highlights |
|----------|-------------|---------------------|
| Islam / Al-Islam | Hashlamah | s→sh (s-path), Form IV→Hiphil VN (Heb. *hashlamah* "completion" attested) |
| jinn / Jinn | ginn / Ginn | j→g (PS *g); root G-N-N "to protect/cover" attested in Hebrew |
| mosque / mosques | misgad / misgadim | masjid: ma→mi (pretonic), s→s, j→g, d→d; Hebrew place-noun pattern |
| Muslims / Muslim | Meshallim / Meshallem | Form II: mu→me, s→sh (s-path), l→l; Heb. *meshallem* "one who pays/completes" |
| Muhajirin | Mehagrim | mu→me, h preserved, j→g, -in→-im |
| Ansar | Nozrim | root N-S-R→N-Ts-R; Heb. *notser* "guard" attested; plural -im |
| Thamud | Shamod | th→sh |
| A'ad | Od | '→silent, a→o |
| Qureysh / Quraish | Coresh | q→c, ai→e (= Hebrew "Cyrus") |
| Salih | Zoleah | s→z, fa'il→qotel |
| Muhammad / MUhammad | Mahemod | mu→me, Piel pp; epenthetic hatef under guttural, Canaanite shift (Heb. *mahmad* attested) |
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
| qiblah / Qiblah | ciblah / Ciblah | q→c |
| Ramadan | Ramazon | d→z, -an→-on |
| Bahirah | Behirah | h→h (Heb. *behirah* "chosen" attested) |
| Sa'ibah | Shoevah | s→sh |
| Wasilah | Vezilah | w→v, s→z |
| Hami | Homeh | h→h, fa'il→qotel (lamed-he: final -eh) |
| Salsabil | Shalshabil | s→sh (s-path, both sins) |
| Tasnim | Tashnim | s→sh (s-path) |
| Zaqqum | Zaccom | qq→cc, u→o |
