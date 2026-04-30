from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import os
import logging
import tempfile

from app.ai.phi_parser import parse_url as phi_parse_url, parse_file as phi_parse_file
from app.schemas.schemas import ImageParseRequest, ImageParseResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/parse-image", response_model=ImageParseResponse)
async def parse_image(request: ImageParseRequest):
    """
    Парсинг афиши по URL изображения (OCR + rule-based структурирование)
    """
    try:
        if not request.image_url or not request.image_url.startswith(("http://", "https://")):
            raise HTTPException(400, "Некорректный URL изображения")

        logger.info("🔍 Парсим изображение по URL (OCR + rules)")
        result = phi_parse_url(request.image_url)

        if not result or not result.get("success"):
            error_msg = result.get("error", "Неизвестная ошибка") if result else "Не удалось распарсить изображение"
            logger.error(f"❌ Ошибка парсинга: {error_msg}")
            raise HTTPException(500, f"Ошибка парсинга изображения: {error_msg}")

        return ImageParseResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Неожиданная ошибка парсинга: {str(e)}")
        raise HTTPException(500, f"Ошибка анализа афиши: {str(e)}")


@router.post("/upload-parse", response_model=ImageParseResponse)
async def upload_and_parse(file: UploadFile = File(...)):
    """
    Загрузка файла изображения и парсинг (OCR + rule-based структурирование)
    """
    temp_file_path = None
    try:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(400, "Файл должен быть изображением")

        suffix = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            temp_file_path = tmp_file.name
            shutil.copyfileobj(file.file, tmp_file)

        logger.info(f"📁 Файл загружен: {file.filename} ({temp_file_path})")
        result = phi_parse_file(temp_file_path)

        if not result or not result.get("success"):
            error_msg = result.get("error", "Неизвестная ошибка") if result else "Не удалось распарсить изображение"
            logger.error(f"❌ Ошибка парсинга: {error_msg}")
            raise HTTPException(500, f"Ошибка парсинга изображения: {error_msg}")

        return ImageParseResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Неожиданная ошибка загрузки и парсинга: {str(e)}")
        raise HTTPException(500, f"Ошибка обработки афиши: {str(e)}")
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass


@router.get("/parser-status")
async def get_parser_status():
    """Статус парсера (OCR + rule-based)"""
    return {
        "status": "active",
        "parser_type": "ocr_rules",
        "llm_used": False,
        "features": [
            "url_parsing",
            "file_upload",
            "ocr_text_extraction",
            "rule_based_structuring",
        ],
        "supported_formats": [".jpg", ".jpeg", ".png", ".bmp", ".tiff"],
        "supported_languages": ["rus", "eng"],
        "note": "Без загрузки LLM моделей. OCR + правила."
    }