#!/usr/bin/env python3
"""
Скрипт для обновления базы данных - добавление колонки time в таблицу events
"""
import sqlite3
import os
from pathlib import Path

# Путь к базе данных
DB_PATH = Path(__file__).parent / "events.db"

def update_database():
    """Добавляет колонку time в таблицу events, если её нет"""
    if not DB_PATH.exists():
        print("❌ База данных не найдена. Запустите сервер для создания базы.")
        return False
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    try:
        # Проверяем, существует ли колонка time
        cursor.execute("PRAGMA table_info(events)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'time' not in columns:
            print("🔧 Добавляем колонку 'time' в таблицу 'events'...")
            cursor.execute("ALTER TABLE events ADD COLUMN time VARCHAR")
            conn.commit()
            print("✅ Колонка 'time' успешно добавлена!")
        else:
            print("✅ Колонка 'time' уже существует в таблице 'events'")
        
        return True
    except Exception as e:
        print(f"❌ Ошибка при обновлении базы данных: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    print("🚀 Обновление базы данных...")
    success = update_database()
    if success:
        print("✅ База данных успешно обновлена!")
    else:
        print("❌ Ошибка при обновлении базы данных")


