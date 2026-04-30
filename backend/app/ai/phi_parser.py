import os
import re
import json
import tempfile
import logging
from typing import Dict, Optional

import requests
from PIL import Image

_easyocr_reader = None

logger = logging.getLogger(__name__)


def _ensure_ocr():
    global _easyocr_reader
    if _easyocr_reader is None:
        import easyocr
        _easyocr_reader = easyocr.Reader(['ru', 'en'])
        logger.info("EasyOCR reader initialized (ru+en)")
    return _easyocr_reader


def _ocr_image_to_text(image_path: str) -> str:
    reader = _ensure_ocr()
    results = reader.readtext(image_path)
    ocr_text = "\n".join([text for (_, text, conf) in results])
    logger.info(f"OCR extracted {len(ocr_text)} characters")
    return ocr_text


def _extract_performer(text: str, lines: list) -> Optional[str]:
    quote_pattern = r"[\"'“”‘’]([A-ZА-ЯЁ][^\"'“”‘’\n]{2,})[\"'“”‘’]"
    m = re.search(quote_pattern, text)
    if m:
        candidate = m.group(1).strip()
        if len(candidate) > 2 and any(c.isalpha() for c in candidate):
            return candidate
    
    keywords = [
        r"группа\s+([A-ZА-ЯЁ][^,\n]{2,})",
        r"band\s+([A-Z][^,\n]{2,})",
        r"оркестр\s+([A-ZА-ЯЁ][^,\n]{2,})",
        r"dj\s+([A-Z][^,\n]{2,})",
        r"artist\s+([A-Z][^,\n]{2,})",
    ]
    lowtext = text.lower()
    for kp in keywords:
        m = re.search(kp, text, flags=re.IGNORECASE)
        if m:
            candidate = m.group(1).strip()
            if len(candidate) > 2:
                return candidate
    
    for line in lines[:10]:
        clean = line.strip()
        if len(clean) >= 4 and sum(ch.isalpha() for ch in clean) >= 4:
            caps_ratio = sum(1 for ch in clean if ch.isupper()) / max(1, sum(1 for ch in clean if ch.isalpha()))
            if caps_ratio >= 0.5:
                return clean
    return None


def _structure_text_rules(text: str) -> Dict:
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    performer = _extract_performer(text, lines)

    title = None
    for line in lines[:15]:
        if len(line) > 5 and any(c.isalpha() for c in line):
            if not re.search(r'^\d+[\.:]', line) and not re.search(r'\d{1,2}[\./\-]\d{1,2}', line) and not re.search(r'\d{1,2}:\d{2}', line):
                title = line
                break
    if not title and lines:
        title = max(lines[:10], key=len)

    months_ru = {
        'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
        'мая': '05', 'июня': '06', 'июля': '07', 'августа': '08',
        'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12'
    }
    date = None
    m = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{4})', text)
    if m:
        d, mo, y = m.groups()
        date = f"{d.zfill(2)}.{mo.zfill(2)}.{y}"
    else:
        m = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', text)
        if m:
            d, mo, y = m.groups()
            date = f"{d.zfill(2)}.{mo.zfill(2)}.{y}"
        else:
            m = re.search(r'(\d{1,2})\s+([а-яА-ЯёЁ]+)\s+(\d{4})', text)
            if m:
                d, mon, y = m.groups()
                mon_num = months_ru.get(mon.lower())
                if mon_num:
                    date = f"{d.zfill(2)}.{mon_num}.{y}"

    time = None
    mt = re.search(r'(\d{1,2}):(\d{2})', text)
    if mt:
        h, mi = mt.groups()
        time = f"{h.zfill(2)}:{mi}"
    else:
        mt = re.search(r'(\d{1,2})\s*ч\s*(\d{1,2})', text)
        if mt:
            h, mi = mt.groups()
            time = f"{h.zfill(2)}:{mi.zfill(2)}"

    location = None
    place_keywords = [
        'клуб', 'ресторан', 'театр', 'зал', 'центр', 'дворец', 'стадион', 'парк', 'музей', 'галерея', 'кинотеатр',
        'arena', 'club', 'hall', 'theatre', 'theater', 'bar', 'pub', 'cafe'
    ]
    for line in lines:
        low = line.lower()
        if any(k in low for k in place_keywords):
            location = line
            break

    age_limit = None
    ma = re.search(r'(\d{1,2})\s*\+', text)
    if ma:
        age_limit = f"{ma.group(1)}+"

    price = None
    mp = re.search(r'(\d+[\s\u00A0]?\d*)\s*руб', text, re.I)
    if mp:
        raw_num = mp.group(1)
        sanitized_num = raw_num.replace(' ', '').replace('\u00A0', '')
        price = f"{sanitized_num} руб."
    else:
        mp = re.search(r'от\s*(\d+)', text, re.I)
        if mp:
            price = f"от {mp.group(1)} руб."

    t = text.lower()
    if any(x in t for x in ['концерт', 'concert', 'live', 'dj', 'party']):
        category = 'концерт'
    elif any(x in t for x in ['театр', 'спектакль', 'theatre', 'theater']):
        category = 'театр'
    elif any(x in t for x in ['выставка', 'exhibition', 'галерея']):
        category = 'выставка'
    elif any(x in t for x in ['лекция', 'семинар', 'форум', 'lecture']):
        category = 'лекция'
    elif any(x in t for x in ['кино', 'фильм', 'movie', 'film']):
        category = 'кино'
    else:
        category = 'другое'

    description = None
    desc_lines = []
    for line in lines:
        if len(line) > 20 and not re.search(r'\d{1,2}[\./\-]\d{1,2}', line) and not re.search(r'\d{1,2}:\d{2}', line):
            if not re.search(r'\d+\s*руб', line, re.I) and not re.search(r'http|www|@|\+7', line, re.I):
                desc_lines.append(line)
                if len(desc_lines) >= 3:
                    break
    if desc_lines:
        description = ' '.join(desc_lines)

    if performer and title:
        if performer.lower() not in title.lower():
            title_final = f"{performer} — {title}"
        else:
            title_final = title
    else:
        title_final = performer or title or 'Событие'

    if not location:
        location = 'Место не указано'
    if not price:
        price = 'Цена не указана'
    if not description:
        description = 'Описание отсутствует'

    return {
        "title": title_final,
        "description": description,
        "date": date,
        "time": time,
        "location": location,
        "place": location,
        "price": price,
        "category": category,
        "age_limit": age_limit,
        "event_type": category,
    }


def parse_file(image_path: str) -> Dict:
    try:
        if not os.path.exists(image_path):
            return _error("Файл не найден")
        ocr_text = _ocr_image_to_text(image_path)
        data = _structure_text_rules(ocr_text)
        return {
            "success": True,
            "data": data,
            "raw_text": ocr_text,
            "confidence": "средняя" if ocr_text and len(ocr_text) > 30 else "низкая",
            "source": "ocr+rules",
            "llm_used": False,
            "corrections": []
        }
    except Exception as e:
        logger.exception("phi_parser error")
        return _error(str(e))


def parse_url(image_url: str) -> Dict:
    temp_path = None
    try:
        resp = requests.get(image_url, timeout=30)
        resp.raise_for_status()
        if not resp.headers.get('content-type', '').startswith('image/'):
            return _error("URL не указывает на изображение")
        suffix = ".jpg"
        temp_fd, temp_path = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(temp_fd, 'wb') as f:
            f.write(resp.content)
        return parse_file(temp_path)
    except Exception as e:
        logger.exception("phi_parser url error")
        return _error(str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


def _error(msg: str) -> Dict:
    return {
        "success": False,
        "error": msg,
        "data": {
            "title": None,
            "description": None,
            "date": None,
            "time": None,
            "location": None,
            "place": None,
            "price": None,
            "category": None,
            "age_limit": None,
            "event_type": None,
        },
        "raw_text": "",
        "confidence": "низкая",
        "source": "ocr+rules",
        "llm_used": False,
        "corrections": []
    }