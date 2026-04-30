import requests
from typing import Optional

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

WMO_DESCRIPTIONS = {
    0: "Ясно", 1: "Преимущественно ясно", 2: "Переменная облачность", 3: "Пасмурно",
    45: "Туман", 48: "Иней",
    51: "Слабая морось", 53: "Морось", 55: "Сильная морось",
    61: "Слабый дождь", 63: "Дождь", 65: "Сильный дождь",
    71: "Слабый снег", 73: "Снег", 75: "Сильный снег",
    80: "Кратковременный дождь", 81: "Ливень", 82: "Сильный ливень",
    95: "Гроза", 96: "Гроза с градом", 99: "Сильная гроза с градом",
}


def get_weather(city: str) -> Optional[dict]:
    try:
        geo_resp = requests.get(
            GEOCODING_URL,
            params={"name": city, "count": 1, "language": "ru", "format": "json"},
            timeout=5,
        )
        geo_resp.raise_for_status()
        results = geo_resp.json().get("results", [])
        if not results:
            return None

        lat = results[0]["latitude"]
        lon = results[0]["longitude"]
        city_name = results[0].get("name", city)
        country = results[0].get("country", "")

        weather_resp = requests.get(
            WEATHER_URL,
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,wind_speed_10m,weather_code,relative_humidity_2m",
                "wind_speed_unit": "ms",
            },
            timeout=5,
        )
        weather_resp.raise_for_status()
        current = weather_resp.json().get("current", {})
        code = current.get("weather_code", 0)

        return {
            "city": city_name,
            "country": country,
            "temperature": current.get("temperature_2m"),
            "wind_speed": current.get("wind_speed_10m"),
            "humidity": current.get("relative_humidity_2m"),
            "description": WMO_DESCRIPTIONS.get(code, "Нет данных"),
            "weather_code": code,
        }
    except Exception:
        return None
