#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
split_levels_789.py — Tách HSK 7-9 thành 3 cấp riêng biệt: HSK 7, HSK 8, HSK 9
"""

import json, os, re

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "New HSK (2025)")
OUT = os.path.join(BASE, "data", "hsk_data.js")
CACHE_FILE = os.path.join(BASE, "vi_meanings_cache.json")

TYPE_MAP = {
    "动": "v", "名": "n", "形": "adj", "副": "adv", "代": "pron",
    "数": "num", "量": "mw", "介": "prep", "连": "conj", "助": "part",
    "叹": "interj", "缀": "affix", "拟": "onom", "语素": "morpheme"
}

def clean_type(raw_type):
    if not raw_type: return ""
    res = []
    for k, v in TYPE_MAP.items():
        if k in raw_type: res.append(v)
    return "/".join(res) if res else raw_type.strip()

# 1. Đọc Anki cho pinyin, type, meaning
anki_dict = {}
level_files = [(i, f"HSK_Level_{i}.txt") for i in range(1, 7)] + [(7, "HSK_Level_7-9.txt")]
for lv, fname in level_files:
    path = os.path.join(SRC, "Anki xiehanzi", fname)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) >= 3:
                    hanzi = parts[0].strip()
                    pinyin = parts[2].strip()
                    wtype = clean_type(parts[5].strip()) if len(parts) > 5 else ""
                    if hanzi not in anki_dict:
                        anki_dict[hanzi] = {"pinyin": pinyin, "type": wtype}

# 2. Đọc Temp
temp_dict = {}
temp_files = [(i, f"HSK_Level_{i}_words.txt") for i in range(1, 7)] + [(7, "HSK_Level_7-9_words.txt")]
raw_level_words = {i: [] for i in range(1, 8)}

for lv, fname in temp_files:
    path = os.path.join(SRC, "HSK Words", "temp", fname)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) >= 4:
                    raw_h = parts[2].strip()
                    h = re.sub(r"\d+$", "", raw_h).strip()
                    p = parts[3].strip()
                    t = clean_type(parts[4].strip()) if len(parts) >= 5 else ""
                    if h not in raw_level_words[lv]:
                        raw_level_words[lv].append(h)
                    if h not in temp_dict:
                        temp_dict[h] = {"pinyin": p, "type": t}

# Bổ sung từ hsk_all_words.json cho 1..6
with open(os.path.join(SRC, "hsk_all_words.json"), encoding="utf-8") as f:
    raw_levels = json.load(f)
for key, words in raw_levels.items():
    m = re.match(r"hsk(\d+)$", key)
    if m:
        lv = int(m.group(1))
        if 1 <= lv <= 6:
            for w in words:
                if w not in raw_level_words[lv]:
                    raw_level_words[lv].append(w)

# Đọc cache Tiếng Việt
vi_cache = {}
if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            vi_cache = json.load(f)
    except:
        pass

# 3. TÁCH HSK 7-9 THÀNH 3 CẤP RIÊNG BIỆT (HSK 7, HSK 8, HSK 9)
hsk789_all = raw_level_words[7]
n = len(hsk789_all)
chunk_size = n // 3

hsk7_words = hsk789_all[:chunk_size]
hsk8_words = hsk789_all[chunk_size:chunk_size*2]
hsk9_words = hsk789_all[chunk_size*2:]

final_levels = {
    1: raw_level_words[1],
    2: raw_level_words[2],
    3: raw_level_words[3],
    4: raw_level_words[4],
    5: raw_level_words[5],
    6: raw_level_words[6],
    7: hsk7_words,
    8: hsk8_words,
    9: hsk9_words
}

for lv in range(1, 10):
    print(f"HSK {lv}: {len(final_levels[lv])} words")

# 4. Xuất file hsk_data.js
header = """/**
 * hsk_data.js — Tách biệt đầy đủ 9 cấp độ HSK (HSK 1 đến HSK 9)
 * Nguồn: New HSK (2025) với đầy đủ Pinyin, Nghĩa Tiếng Việt, Loại từ
 */

const HSK_DATA = {
"""

lines = [header]
total_words = 0

for lv in range(1, 10):
    words = final_levels[lv]
    lines.append(f"  {lv}: [\n")
    for idx, hanzi in enumerate(words, 1):
        clean_h = re.sub(r"\d+$", "", hanzi)
        info = anki_dict.get(hanzi) or temp_dict.get(hanzi) or anki_dict.get(clean_h) or temp_dict.get(clean_h) or {}
        pinyin = info.get("pinyin", "")
        wtype = info.get("type", "")
        meaning_vi = vi_cache.get(clean_h) or vi_cache.get(hanzi) or ""

        h_esc = hanzi.replace("'", "\\'")
        p_esc = pinyin.replace("'", "\\'")
        m_esc = meaning_vi.replace("'", "\\'")
        t_esc = wtype.replace("'", "\\'")

        obj = (
            f"    {{ id:{idx}, hanzi:'{h_esc}', pinyin:'{p_esc}', meaning:'{m_esc}', "
            f"type:'{t_esc}', example:'', example_pinyin:'', example_meaning:'' }}"
        )
        comma = "," if idx < len(words) else ""
        lines.append(obj + comma + "\n")
    lines.append("  ],\n")
    total_words += len(words)

lines.append("};\n\n")
lines.append(
    "// Mảng phẳng gộp tất cả cấp (app.js dùng)\n"
    "const ALL_WORDS = Object.entries(HSK_DATA).flatMap(([level, words]) =>\n"
    "  words.map(w => ({ ...w, level: parseInt(level) }))\n"
    ");\n"
)

with open(OUT, "w", encoding="utf-8") as f:
    f.writelines(lines)

print(f"\nSUCCESS: Generated {OUT} with 9 separate HSK levels!")
print(f"Total vocabulary: {total_words}")
