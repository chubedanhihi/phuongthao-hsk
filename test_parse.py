import os, re, json

BASE = r"d:\taiChinh\New HSK (2025)"

# Check Anki files
anki_data = {}
for lv in range(1, 7):
    path = os.path.join(BASE, "Anki xiehanzi", f"HSK_Level_{lv}.txt")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) >= 6:
                    hanzi = parts[0].strip()
                    pinyin = parts[2].strip()
                    word_type = parts[5].strip() if len(parts) > 5 else ""
                    # extract meanings from <li>...</li>
                    meanings = []
                    if len(parts) >= 8:
                        html = parts[7]
                        meanings = re.findall(r"<li>(.*?)</li>", html)
                    meaning_str = "; ".join(meanings[:3]) if meanings else ""
                    if hanzi not in anki_data:
                        anki_data[hanzi] = {
                            "pinyin": pinyin,
                            "type": word_type,
                            "meaning": meaning_str
                        }

# Check temp files
temp_data = {}
for lv in range(1, 7):
    path = os.path.join(BASE, "HSK Words", "temp", f"HSK_Level_{lv}_words.txt")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) >= 4:
                    hanzi = parts[2].strip()
                    pinyin = parts[3].strip()
                    wtype = parts[4].strip() if len(parts) >= 5 else ""
                    clean_hanzi = re.sub(r"\d+$", "", hanzi)
                    if clean_hanzi not in temp_data:
                        temp_data[clean_hanzi] = {
                            "pinyin": pinyin,
                            "type": wtype
                        }

print(f"Anki words loaded: {len(anki_data)}")
print(f"Temp words loaded: {len(temp_data)}")

# Test sample
for test in ["爱", "你好", "我们", "苹果", "电脑", "发展", "宏观", "斟酌"]:
    info = anki_data.get(test) or temp_data.get(test)
    print(f"{test}: {info}")
