# 🚀 Быстрый запуск

## Что нужно для работы

### 1. Python 3.8+ ✅
Проверка:
```bash
python3 --version
```

### 2. Node.js 14+ ✅
Проверка:
```bash
node --version
npm --version
```

### 3. Tesseract OCR (для парсера) ⚠️
**Это нужно установить!**

**macOS:**
```bash
brew install tesseract tesseract-lang
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-rus
```

**Windows:**
Скачайте установщик с https://github.com/UB-Mannheim/tesseract/wiki

## Первый запуск (один раз)

### 1. Установка зависимостей бэкенда
```bash
cd backend
pip3 install -r requirements.txt
```

### 2. Установка зависимостей фронтенда
```bash
cd ../frontend  # или afisha-frontend (выберите нужный)
npm install
```

## Запуск проекта

### 1. Запустите бэкенд (терминал 1)
```bash
cd backend
python3 run.py
```

Должно появиться:
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 2. Запустите фронтенд (терминал 2)
```bash
cd frontend  # или afisha-frontend
npm start
```

Должно открыться в браузере: http://localhost:3000

## Готово! 🎉

Откройте в браузере:
- **Фронтенд**: http://localhost:3000
- **API документация**: http://localhost:8000/docs
- **API**: http://localhost:8000

## Учетные данные для входа

**Админ:**
- Логин: `admin`
- Пароль: `admin`

Создается автоматически при первом запуске бэкенда.

## Возможные проблемы

### ❌ Ошибка: Tesseract не найден
**Решение**: Установите Tesseract OCR (см. выше)

### ❌ Ошибка: Порт 8000 занят
**Решение**: Измените порт в `backend/run.py` или остановите другой сервис

### ❌ Ошибка: Порт 3000 занят
**Решение**: React автоматически предложит другой порт (например, 3001)

### ❌ Ошибка при парсинге изображений
**Решение**: 
1. Убедитесь что Tesseract установлен
2. Проверьте что языки установлены (rus+eng)

## Структура проекта

```
event-parser/
├── backend/          # Python FastAPI сервер
│   ├── app/
│   ├── run.py        # Запуск бэкенда
│   └── requirements.txt
└── frontend/         # React фронтенд
    ├── src/
    └── package.json
```

## После первого запуска

В следующий раз просто запускайте:
1. `python3 backend/run.py` (бэкенд)
2. `npm start` в папке frontend (фронтенд)

Все остальное уже настроено! ✅



