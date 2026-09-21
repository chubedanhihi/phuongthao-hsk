#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_all_levels.py — Tích hợp đầy đủ HSK 1, 2, 3, 4, 5, 6 và HSK 7-9 (Tổng hơn 11.000 từ)
với Pinyin chuẩn, Nghĩa Tiếng Việt, Loại từ.
"""

import json, os, re, html, time, urllib.request, urllib.parse

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
        if k in raw_type:
            res.append(v)
    return "/".join(res) if res else raw_type.strip()

# ── 1. Đọc Anki cho HSK 1..6 và 7-9 ──
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
                    meanings = []
                    if len(parts) >= 8:
                        raw_meanings = re.findall(r"<li>(.*?)</li>", parts[7])
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
                            "meaning": meaning_str,
                            "level": lv
                        }

# ── 2. Đọc Temp cho HSK 1..6 và 7-9 ──
temp_dict = {}
temp_files = [(i, f"HSK_Level_{i}_words.txt") for i in range(1, 7)] + [(7, "HSK_Level_7-9_words.txt")]
level_words = {i: [] for i in range(1, 8)}

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
                    if h not in level_words[lv]:
                        level_words[lv].append(h)
                    if h not in temp_dict:
                        temp_dict[h] = {"pinyin": p, "type": t, "level": lv}

# Bổ sung từ hsk_all_words.json cho 1..6
with open(os.path.join(SRC, "hsk_all_words.json"), encoding="utf-8") as f:
    raw_levels = json.load(f)
for key, words in raw_levels.items():
    m = re.match(r"hsk(\d+)$", key)
    if m:
        lv = int(m.group(1))
        if 1 <= lv <= 6:
            for w in words:
                if w not in level_words[lv]:
                    level_words[lv].append(w)

for lv in range(1, 8):
    print(f"Level {lv} (HSK {lv if lv <= 6 else '7-9'}): {len(level_words[lv])} words")

# ── 3. Tải cache dịch Tiếng Việt ──
vi_cache = {}
if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            vi_cache = json.load(f)
    except:
        pass

# Tìm các từ chưa được dịch
words_to_translate = []
for lv in range(1, 8):
    for w in level_words[lv]:
        clean_w = re.sub(r"\d+$", "", w)
        if clean_w not in vi_cache and clean_w not in words_to_translate:
            words_to_translate.append(clean_w)

print(f"Total words needing translation: {len(words_to_translate)} (Already cached: {len(vi_cache)})")

def translate_batch(batch):
    query = "\n".join(batch)
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=vi&dt=t&q=" + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        res = urllib.request.urlopen(req, timeout=12).read().decode("utf-8")
        data = json.loads(res)
        translated_text = "".join([x[0] for x in data[0] if x[0]])
        lines = translated_text.split("\n")
        results = {}
        for i, word in enumerate(batch):
            if i < len(lines):
                val = lines[i].strip().lower()
                results[word] = val
            else:
                results[word] = ""
        return results
    except Exception as e:
        print(f"Error translating batch: {e}")
        return {}

BATCH_SIZE = 60
if words_to_translate:
    for i in range(0, len(words_to_translate), BATCH_SIZE):
        batch = words_to_translate[i:i+BATCH_SIZE]
        print(f"Translating {i+1} - {min(i+BATCH_SIZE, len(words_to_translate))} / {len(words_to_translate)}...")
        res = translate_batch(batch)
        vi_cache.update(res)
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(vi_cache, f, ensure_ascii=False, indent=2)
        time.sleep(0.2)

# ── 4. Xuất file hsk_data.js đầy đủ 1 đến 7 (7 = HSK 7-9) ──
header = """/**
 * hsk_data.js — Tự động tạo bởi build_all_levels.py
 * Nguồn: New HSK (2025) đầy đủ từ HSK 1 đến HSK 7-9
 * Cấp độ: 1 = HSK1, 2 = HSK2, ..., 6 = HSK6, 7 = HSK 7-9
 */

const HSK_DATA = {
"""

lines = [header]
total_words = 0

for lv in range(1, 8):
    words = level_words[lv]
    lines.append(f"  {lv}: [\n")
    for idx, hanzi in enumerate(words, 1):
        clean_h = re.sub(r"\d+$", "", hanzi)
        info = anki_dict.get(hanzi) or temp_dict.get(hanzi) or anki_dict.get(clean_h) or temp_dict.get(clean_h) or {}
        pinyin = info.get("pinyin", "")
        wtype = info.get("type", "")
        meaning_vi = vi_cache.get(clean_h) or vi_cache.get(hanzi) or info.get("meaning", "")

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

print(f"\n==========================================")
print(f"SUCCESS: Generated {OUT}")
print(f"Total vocabulary across all levels: {total_words}")
print(f"==========================================")
