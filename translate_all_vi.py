#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
translate_all_vi.py — Dịch toàn bộ nghĩa từ vựng HSK sang Tiếng Việt
"""

import json, os, re, time, urllib.request, urllib.parse

BASE = os.path.dirname(os.path.abspath(__file__))
CACHE_FILE = os.path.join(BASE, "vi_meanings_cache.json")
OUT_DATA = os.path.join(BASE, "data", "hsk_data.js")

# Special common grammar particles manual overrides for high precision
MANUAL_VI = {
    "的": "của (trợ từ sở hữu); mà",
    "了": "rồi (trợ từ ngữ khí / hoàn thành)",
    "在": "ở, tại, đang (hành động đang diễn ra)",
    "是": "là, đúng, phải",
    "我": "tôi, mình, ta",
    "你": "bạn, anh, chị, cậu",
    "他": "anh ấy, cậu ấy, ông ấy",
    "她": "cô ấy, chị ấy, bà ấy",
    "它": "nó (chỉ đồ vật, con vật)",
    "我们": "chúng tôi, chúng ta",
    "你们": "các bạn, các anh/chị",
    "他们": "họ, bọn họ (nam)",
    "她们": "họ, bọn họ (nữ)",
    "它们": "chúng nó (đồ vật/động vật)",
    "这": "đây, này",
    "这个": "cái này",
    "这里": "ở đây, nơi đây",
    "这儿": "chỗ này, ở đây",
    "这些": "những cái này, những người này",
    "那": "kia, đó",
    "那个": "cái kia, cái đó",
    "那里": "ở đó, nơi đó",
    "那儿": "chỗ đó, đằng kia",
    "那些": "những cái kia, những người kia",
    "哪": "nào, đâu",
    "哪个": "cái nào",
    "哪里": "ở đâu, đâu",
    "哪儿": "đâu, chỗ nào",
    "哪些": "những cái nào",
    "什么": "gì, cái gì",
    "怎么": "làm sao, như thế nào",
    "怎么样": "thế nào, ra sao",
    "多少": "bao nhiêu",
    "几": "mấy, bao nhiêu",
    "谁": "ai",
    "吗": "sao, hả, không (trợ từ nghi vấn)",
    "呢": "thế, nhỉ, đang... (trợ từ)",
    "吧": "nhé, đi, thôi (trợ từ ngữ khí)",
    "不": "không, chẳng",
    "没": "chưa, không có",
    "没有": "không có, chưa",
    "很": "rất, lắm",
    "太": "quá, lắm",
    "都": "đều, tất cả",
    "也": "cũng",
    "和": "và, cùng với",
    "个": "cái, chiếc, con (lượng từ phổ biến)",
    "本": "quyển, cuốn (sách)",
    "岁": "tuổi",
    "点": "giờ, chút, điểm",
    "块": "đồng (tiền tệ), miếng, cục",
    "件": "chiếc, vụ, cái (áo, việc)",
    "些": "một số, vài",
    "一点儿": "một chút, một ít",
    "有点儿": "hơi hơi, có chút",
    "你好": "xin chào",
    "再见": "tạm biệt",
    "谢谢": "cảm ơn",
    "不客气": "không có gì, đừng khách sáo",
    "对不起": "xin lỗi",
    "没关系": "không sao, không có gì",
    "没事": "không có chuyện gì, không sao",
    "请问": "xin hỏi",
    "请": "xin, mời",
    "喂": "alo (nghe điện thoại), này"
}

# 1. Đọc cache hiện có
vi_cache = {}
if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            vi_cache = json.load(f)
    except:
        vi_cache = {}

# Merge manual overrides
vi_cache.update(MANUAL_VI)

# 2. Đọc tất cả từ vựng từ New HSK (2025)
from build_data import level_words, anki_dict, temp_dict

words_to_translate = []
for lv, words in level_words.items():
    for w in words:
        if w not in vi_cache and w not in words_to_translate:
            words_to_translate.append(w)

print(f"Total words to translate: {len(words_to_translate)} (Already cached: {len(vi_cache)})")

def translate_batch(batch):
    query = "\n".join(batch)
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=vi&dt=t&q=" + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        res = urllib.request.urlopen(req, timeout=10).read().decode("utf-8")
        data = json.loads(res)
        translated_text = "".join([x[0] for x in data[0] if x[0]])
        lines = translated_text.split("\n")
        
        # Match lines
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

# Translate in chunks of 50
BATCH_SIZE = 50
for i in range(0, len(words_to_translate), BATCH_SIZE):
    batch = words_to_translate[i:i+BATCH_SIZE]
    print(f"Translating {i+1} - {min(i+BATCH_SIZE, len(words_to_translate))} / {len(words_to_translate)}...")
    res = translate_batch(batch)
    vi_cache.update(res)
    # Save cache periodically
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(vi_cache, f, ensure_ascii=False, indent=2)
    time.sleep(0.3)

print("All translations completed!")

# 3. Tạo lại data/hsk_data.js với Tiếng Việt
header = """/**
 * hsk_data.js — Tự động tạo bởi build_data.py & translate_all_vi.py
 * Nguồn: New HSK (2025) với đầy đủ Pinyin, Nghĩa Tiếng Việt chuẩn, Loại từ
 */

const HSK_DATA = {
"""

lines = [header]
total_words = 0

for lv in range(1, 7):
    words = level_words.get(lv, [])
    lines.append(f"  {lv}: [\n")
    for idx, hanzi in enumerate(words, 1):
        info = anki_dict.get(hanzi) or temp_dict.get(hanzi) or {}
        if not info:
            clean_h = re.sub(r"\d+$", "", hanzi)
            info = anki_dict.get(clean_h) or temp_dict.get(clean_h) or {}
        
        pinyin = info.get("pinyin", "")
        wtype = info.get("type", "")
        
        # Get Vietnamese meaning
        meaning_vi = vi_cache.get(hanzi) or vi_cache.get(re.sub(r"\d+$", "", hanzi)) or ""
        # Fallback to English if somehow empty
        if not meaning_vi:
            meaning_vi = info.get("meaning", "")

        # Escape cho JS
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

with open(OUT_DATA, "w", encoding="utf-8") as f:
    f.writelines(lines)

print(f"Updated {OUT_DATA} successfully with Vietnamese meanings!")
