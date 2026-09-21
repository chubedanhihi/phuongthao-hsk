#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_data.py — Nạp đầy đủ Pinyin, Loại từ, và Nghĩa từ bộ New HSK (2025)
Nguồn:
  1. "New HSK (2025)/Anki xiehanzi/HSK_Level_X.txt" (Pinyin chuẩn, Nghĩa, Loại từ)
  2. "New HSK (2025)/HSK Words/temp/HSK_Level_X_words.txt" (Pinyin, Loại từ)
  3. "New HSK (2025)/hsk_all_words.json" (Cấp độ)
"""

import json, os, re, html

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "New HSK (2025)")
OUT = os.path.join(BASE, "data", "hsk_data.js")

# Mapping word types to readable abbreviations
TYPE_MAP = {
    "动": "v", "名": "n", "形": "adj", "副": "adv", "代": "pron",
    "数": "num", "量": "mw", "介": "prep", "连": "conj", "助": "part",
    "叹": "interj", "缀": "affix", "拟": "onom", "语素": "morpheme"
}

def clean_type(raw_type):
    if not raw_type:
        return ""
    res = []
    for k, v in TYPE_MAP.items():
        if k in raw_type:
            res.append(v)
    return "/".join(res) if res else raw_type.strip()

# ── 1. Đọc dữ liệu Anki (có Pinyin và Nghĩa đầy đủ) ──
anki_dict = {}
for lv in range(1, 7):
    path = os.path.join(SRC, "Anki xiehanzi", f"HSK_Level_{lv}.txt")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) >= 3:
                    hanzi = parts[0].strip()
                    pinyin = parts[2].strip()
                    wtype = clean_type(parts[5].strip()) if len(parts) > 5 else ""
                    meanings = []
                    if len(parts) >= 8:
                        raw_meanings = re.findall(r"<li>(.*?)</li>", parts[7])
                        # Lọc bỏ các ghi chú rác
                        for m in raw_meanings:
                            m_clean = re.sub(r"<[^>]+>", "", m).strip()
                            m_clean = html.unescape(m_clean)
                            if m_clean and not m_clean.startswith("CL:") and not m_clean.startswith("also pr."):
                                meanings.append(m_clean)
                    meaning_str = "; ".join(meanings[:2]) if meanings else ""
                    if hanzi not in anki_dict:
                        anki_dict[hanzi] = {
                            "pinyin": pinyin,
                            "type": wtype,
                            "meaning": meaning_str
                        }

# ── 2. Đọc dữ liệu Temp (bổ sung Pinyin cho những từ thiếu) ──
temp_dict = {}
for lv in range(1, 7):
    path = os.path.join(SRC, "HSK Words", "temp", f"HSK_Level_{lv}_words.txt")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) >= 4:
                    raw_h = parts[2].strip()
                    h = re.sub(r"\d+$", "", raw_h).strip()
                    p = parts[3].strip()
                    t = clean_type(parts[4].strip()) if len(parts) >= 5 else ""
                    if h not in temp_dict:
                        temp_dict[h] = {"pinyin": p, "type": t}

# ── 3. Đọc danh sách phân bổ cấp độ từ hsk_all_words.json ──
with open(os.path.join(SRC, "hsk_all_words.json"), encoding="utf-8") as f:
    raw_levels = json.load(f)

level_words = {}
for key, words in raw_levels.items():
    m = re.match(r"hsk(\d+)$", key)
    if m:
        lv = int(m.group(1))
        if 1 <= lv <= 6:
            level_words[lv] = words

# ── 4. Tạo file data/hsk_data.js ──
header = """/**
 * hsk_data.js — Tự động tạo bởi build_data.py
 * Nguồn: New HSK (2025) với đầy đủ Pinyin, Nghĩa, Loại từ
 */

const HSK_DATA = {
"""

lines = [header]
total_words = 0
with_pinyin = 0
with_meaning = 0

for lv in range(1, 7):
    words = level_words.get(lv, [])
    lines.append(f"  {lv}: [\n")
    for idx, hanzi in enumerate(words, 1):
        # Lấy thông tin từ Anki hoặc Temp
        info = anki_dict.get(hanzi) or temp_dict.get(hanzi) or {}
        # Thử tìm dạng bỏ số nếu chưa thấy
        if not info:
            clean_h = re.sub(r"\d+$", "", hanzi)
            info = anki_dict.get(clean_h) or temp_dict.get(clean_h) or {}
        
        pinyin = info.get("pinyin", "")
        meaning = info.get("meaning", "")
        wtype = info.get("type", "")

        if pinyin:
            with_pinyin += 1
        if meaning:
            with_meaning += 1

        # Escape cho JS
        h_esc = hanzi.replace("'", "\\'")
        p_esc = pinyin.replace("'", "\\'")
        m_esc = meaning.replace("'", "\\'")
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

os.makedirs(os.path.join(BASE, "data"), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.writelines(lines)

print(f"Build finished successfully.")
print(f"Total words: {total_words}")
print(f"Words with pinyin: {with_pinyin} / {total_words}")
print(f"Words with meaning: {with_meaning} / {total_words}")
