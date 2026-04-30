# Event Parser Backend

Бэкенд для парсера афиш и событий с AI модулем для извлечения данных из изображений.

##  Функциональность

- Парсинг афиш и создание событий через AI
- Модерация событий
- Генерация билетов с QR-кодами
- JWT аутентификация
- CRUD операции для событий, пользователей, билетов

##  Технологии

- Python 3.8+
- FastAPI
- SQLAlchemy
- JWT
- OpenCV + Tesseract OCR (AI модуль)
- PostgreSQL/SQLite

##  Установка и запуск

1. Клонировать репозиторий:
```bash
git clone <repository-url>
cd event-parser-backend