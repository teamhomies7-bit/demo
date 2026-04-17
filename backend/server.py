from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import httpx
import asyncio
import feedparser
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import tempfile

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# ===========================
# SYSTEM PROMPT
# ===========================
ARIA_SYSTEM_PROMPT = """You are Aria (आरिया), an intelligent AI assistant designed specifically for Indian users aged 14+.

Your personality:
- Warm, helpful, and conversational in both Hindi and English
- Culturally aware of India — festivals, languages, sports, food, politics, entertainment
- Smart like Jarvis but friendly like a personal assistant
- Address users respectfully (use "ji" appropriately in Hindi)

Your capabilities:
- Answer questions about India and the world
- Help with tasks, reminders, and daily planning
- Discuss Bollywood, cricket (IPL, Test), regional cinema
- Travel recommendations across India (trains, tourist places)
- Weather updates and current news
- Study help for students, work help for professionals
- Explain government schemes and services

Rules:
- If the user writes in Hindi (Devanagari or Hinglish), respond in Hindi
- If the user writes in English, respond in English
- Be concise and helpful, not verbose
- Use relevant emojis naturally
- Reference Indian context when relevant"""

# ===========================
# MODELS
# ===========================
class ChatRequest(BaseModel):
    session_id: str
    message: str
    language: str = "en"

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    due_date: Optional[str] = None
    priority: str = "medium"
    recurring: Optional[str] = None
    reminder_time: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    completed: Optional[bool] = None
    recurring: Optional[str] = None
    reminder_time: Optional[str] = None

# ===========================
# AI CHAT
# ===========================
chat_instances: dict = {}

def get_chat_instance(session_id: str, language: str = "en") -> LlmChat:
    if session_id not in chat_instances:
        system_msg = ARIA_SYSTEM_PROMPT
        if language == "hi":
            system_msg += "\n\nUser prefers Hindi. Respond primarily in Hindi (Devanagari script)."
        chat_instances[session_id] = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_msg
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    return chat_instances[session_id]

@api_router.post("/chat")
async def chat(request: ChatRequest):
    try:
        user_msg_doc = {
            "id": str(uuid.uuid4()),
            "session_id": request.session_id,
            "role": "user",
            "content": request.message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.chat_messages.insert_one(user_msg_doc)

        chat_instance = get_chat_instance(request.session_id, request.language)
        user_message = UserMessage(text=request.message)
        response_text = await chat_instance.send_message(user_message)

        ai_msg_doc = {
            "id": str(uuid.uuid4()),
            "session_id": request.session_id,
            "role": "assistant",
            "content": response_text,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.chat_messages.insert_one(ai_msg_doc)

        return {"response": response_text, "session_id": request.session_id}
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str):
    messages = await db.chat_messages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("timestamp", 1).to_list(200)
    return {"messages": messages}

@api_router.delete("/chat/history/{session_id}")
async def clear_chat_history(session_id: str):
    await db.chat_messages.delete_many({"session_id": session_id})
    if session_id in chat_instances:
        del chat_instances[session_id]
    return {"message": "Chat history cleared"}

# ===========================
# VOICE TRANSCRIPTION
# ===========================
@api_router.post("/voice/transcribe")
async def transcribe_voice(file: UploadFile = File(...)):
    try:
        content = await file.read()
        fname = file.filename or "audio.m4a"
        suffix = os.path.splitext(fname)[1] or ".m4a"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
            with open(tmp_path, 'rb') as audio_file:
                response = await stt.transcribe(
                    file=audio_file,
                    model="whisper-1",
                    response_format="json"
                )
            return {"text": response.text}
        finally:
            os.unlink(tmp_path)
    except Exception as e:
        logger.error(f"Voice transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===========================
# NEWS (RSS Feeds)
# ===========================
_news_cache: dict = {"data": [], "last_fetch": None}
NEWS_CACHE_TTL = 3600

RSS_FEEDS = [
    ("Times of India", "https://timesofindia.indiatimes.com/rssfeedstopstories.cms"),
    ("NDTV", "https://feeds.feedburner.com/ndtvnews-top-stories"),
    ("The Hindu", "https://www.thehindu.com/news/national/feeder/default.rss"),
    ("India Today", "https://www.indiatoday.in/rss/1206550"),
    ("Hindustan Times", "https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml"),
]

async def _fetch_one_feed(name: str, url: str) -> List[dict]:
    try:
        loop = asyncio.get_event_loop()
        feed = await asyncio.wait_for(
            loop.run_in_executor(None, feedparser.parse, url),
            timeout=8
        )
        articles = []
        for entry in feed.entries[:6]:
            title = entry.get("title", "").strip()
            summary = entry.get("summary", "") or entry.get("description", "") or ""
            if len(summary) > 200:
                summary = summary[:200] + "..."
            if title:
                articles.append({
                    "source": name,
                    "title": title,
                    "summary": summary,
                    "url": entry.get("link", ""),
                    "published": entry.get("published", ""),
                    "category": "India"
                })
        return articles
    except Exception as e:
        logger.warning(f"RSS feed error [{name}]: {e}")
        return []

@api_router.get("/news")
async def get_news(limit: int = 20):
    now = datetime.now(timezone.utc)
    if _news_cache["data"] and _news_cache["last_fetch"]:
        elapsed = (now - _news_cache["last_fetch"]).seconds
        if elapsed < NEWS_CACHE_TTL:
            return {"articles": _news_cache["data"][:limit], "source": "cache"}

    tasks = [_fetch_one_feed(name, url) for name, url in RSS_FEEDS]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    articles = []
    for result in results:
        if isinstance(result, list):
            articles.extend(result)

    if not articles:
        articles = _seed_news()

    _news_cache["data"] = articles
    _news_cache["last_fetch"] = now
    return {"articles": articles[:limit], "source": "rss" if articles else "seed"}

def _seed_news() -> List[dict]:
    return [
        {"source": "India Today", "title": "India's GDP grows at 7.8% in Q3 2024-25", "summary": "India's economy shows strong growth with 7.8% GDP expansion, driven by manufacturing and services sectors.", "url": "", "published": "", "category": "Economy"},
        {"source": "NDTV", "title": "ISRO launches GSAT-N2 communication satellite", "summary": "Indian Space Research Organisation successfully launches new broadband satellite to boost internet connectivity.", "url": "", "published": "", "category": "Science"},
        {"source": "Times of India", "title": "IPL 2025: Mumbai Indians vs Chennai Super Kings — Match Preview", "summary": "The much-anticipated clash between MI and CSK kicks off the IPL season with explosive batting lineups.", "url": "", "published": "", "category": "Sports"},
        {"source": "The Hindu", "title": "IMD forecasts normal monsoon for most states this year", "summary": "India Meteorological Department predicts normal rainfall across major agricultural states in upcoming monsoon season.", "url": "", "published": "", "category": "Weather"},
        {"source": "Hindustan Times", "title": "NEP 2020 implementation: Key milestones achieved across states", "summary": "Government reviews progress of National Education Policy across 28 states with positive outcomes reported.", "url": "", "published": "", "category": "Education"},
        {"source": "LiveMint", "title": "Sensex rises 400 points; Nifty crosses 24,500", "summary": "Indian stock markets surge on strong FII inflows and positive global cues. IT and banking stocks lead gains.", "url": "", "published": "", "category": "Finance"},
    ]

# ===========================
# WEATHER (Open-Meteo — Free, No Key)
# ===========================
_weather_cache: dict = {}

WEATHER_CODES = {
    0: ("Clear Sky", "☀️"), 1: ("Mostly Clear", "🌤️"), 2: ("Partly Cloudy", "⛅"),
    3: ("Overcast", "☁️"), 45: ("Foggy", "🌫️"), 48: ("Icy Fog", "🌫️"),
    51: ("Light Drizzle", "🌦️"), 53: ("Drizzle", "🌦️"), 55: ("Heavy Drizzle", "🌧️"),
    61: ("Light Rain", "🌧️"), 63: ("Rain", "🌧️"), 65: ("Heavy Rain", "⛈️"),
    71: ("Light Snow", "🌨️"), 73: ("Snow", "❄️"), 75: ("Heavy Snow", "❄️"),
    80: ("Rain Showers", "🌦️"), 81: ("Moderate Showers", "🌧️"), 82: ("Heavy Showers", "⛈️"),
    95: ("Thunderstorm", "⛈️"), 96: ("Hail Storm", "⛈️"), 99: ("Heavy Hail", "⛈️"),
}

def _weather_desc(code: int):
    return WEATHER_CODES.get(code, ("Cloudy", "☁️"))

def _aqi_label(aqi: int) -> str:
    if aqi <= 50: return "Good"
    elif aqi <= 100: return "Moderate"
    elif aqi <= 150: return "Unhealthy for Sensitive"
    elif aqi <= 200: return "Unhealthy"
    elif aqi <= 300: return "Very Unhealthy"
    return "Hazardous"

@api_router.get("/weather")
async def get_weather(city: str = "Mumbai"):
    cache_key = city.lower()
    now_ts = datetime.now(timezone.utc).timestamp()
    if cache_key in _weather_cache and now_ts - _weather_cache[cache_key]["ts"] < 1800:
        return _weather_cache[cache_key]["data"]

    try:
        async with httpx.AsyncClient(timeout=12) as hc:
            geo = await hc.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": city, "count": 1, "language": "en", "format": "json"}
            )
            geo_data = geo.json()

            if geo_data.get("results"):
                r = geo_data["results"][0]
                lat, lon = r["latitude"], r["longitude"]
                city_name = r.get("name", city)
            else:
                lat, lon, city_name = 19.0760, 72.8777, city

            weather_resp = await hc.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat, "longitude": lon,
                    "current": "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m",
                    "daily": "temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum",
                    "timezone": "Asia/Kolkata", "forecast_days": 5
                }
            )
            wd = weather_resp.json()

            aqi_resp = await hc.get(
                "https://air-quality-api.open-meteo.com/v1/air-quality",
                params={"latitude": lat, "longitude": lon, "current": "pm10,pm2_5,us_aqi"}
            )
            ad = aqi_resp.json()

            cur = wd.get("current", {})
            aqi_cur = ad.get("current", {})
            daily = wd.get("daily", {})
            code = cur.get("weather_code", 0)
            desc, icon = _weather_desc(code)
            aqi_val = aqi_cur.get("us_aqi", 80)

            result = {
                "city": city_name,
                "temperature": round(cur.get("temperature_2m", 30)),
                "feels_like": round(cur.get("apparent_temperature", 28)),
                "description": desc,
                "icon": icon,
                "humidity": cur.get("relative_humidity_2m", 60),
                "wind_speed": round(cur.get("wind_speed_10m", 10), 1),
                "aqi": aqi_val,
                "aqi_label": _aqi_label(aqi_val),
                "pm25": round(aqi_cur.get("pm2_5", 35), 1),
                "forecast": [
                    {
                        "date": (daily.get("time") or [])[i] if i < len(daily.get("time") or []) else "",
                        "max_temp": round((daily.get("temperature_2m_max") or [])[i]) if i < len(daily.get("temperature_2m_max") or []) else 35,
                        "min_temp": round((daily.get("temperature_2m_min") or [])[i]) if i < len(daily.get("temperature_2m_min") or []) else 25,
                        "icon": _weather_desc((daily.get("weather_code") or [])[i] if i < len(daily.get("weather_code") or []) else 0)[1],
                        "description": _weather_desc((daily.get("weather_code") or [])[i] if i < len(daily.get("weather_code") or []) else 0)[0],
                    }
                    for i in range(min(5, len(daily.get("time") or [])))
                ]
            }
            _weather_cache[cache_key] = {"data": result, "ts": now_ts}
            return result
    except Exception as e:
        logger.error(f"Weather error: {e}")
        return _seed_weather(city)

def _seed_weather(city: str) -> dict:
    return {
        "city": city, "temperature": 32, "feels_like": 36,
        "description": "Partly Cloudy", "icon": "⛅",
        "humidity": 65, "wind_speed": 12.5,
        "aqi": 145, "aqi_label": "Unhealthy for Sensitive", "pm25": 45.2,
        "forecast": [
            {"date": "Today", "max_temp": 35, "min_temp": 26, "icon": "⛅", "description": "Partly Cloudy"},
            {"date": "Tomorrow", "max_temp": 33, "min_temp": 25, "icon": "🌧️", "description": "Rainy"},
            {"date": "Day 3", "max_temp": 30, "min_temp": 24, "icon": "🌦️", "description": "Showers"},
            {"date": "Day 4", "max_temp": 32, "min_temp": 25, "icon": "⛅", "description": "Partly Cloudy"},
            {"date": "Day 5", "max_temp": 34, "min_temp": 26, "icon": "☀️", "description": "Clear Sky"},
        ]
    }

# ===========================
# ENTERTAINMENT (Bollywood + OTT)
# ===========================
MOVIES = [
    {"id": "1", "title": "Stree 2", "year": 2024, "genre": "Horror Comedy", "rating": 8.5, "language": "Hindi", "platform": "Prime Video", "emoji": "👻", "cast": "Shraddha Kapoor, Rajkummar Rao"},
    {"id": "2", "title": "Kalki 2898 AD", "year": 2024, "genre": "Sci-Fi Action", "rating": 7.8, "language": "Telugu", "platform": "Netflix", "emoji": "🚀", "cast": "Prabhas, Deepika Padukone"},
    {"id": "3", "title": "12th Fail", "year": 2023, "genre": "Biographical Drama", "rating": 9.0, "language": "Hindi", "platform": "Disney+Hotstar", "emoji": "📚", "cast": "Vikrant Massey"},
    {"id": "4", "title": "Animal", "year": 2023, "genre": "Action Thriller", "rating": 7.5, "language": "Hindi", "platform": "Netflix", "emoji": "🦁", "cast": "Ranbir Kapoor, Anil Kapoor"},
    {"id": "5", "title": "Jawan", "year": 2023, "genre": "Action Thriller", "rating": 7.2, "language": "Hindi", "platform": "Netflix", "emoji": "⚡", "cast": "Shah Rukh Khan, Nayanthara"},
    {"id": "6", "title": "Rocky Aur Rani Ki Prem Kahani", "year": 2023, "genre": "Romance Drama", "rating": 7.8, "language": "Hindi", "platform": "Prime Video", "emoji": "❤️", "cast": "Ranveer Singh, Alia Bhatt"},
    {"id": "7", "title": "Gadar 2", "year": 2023, "genre": "Action Drama", "rating": 7.3, "language": "Hindi", "platform": "ZEE5", "emoji": "🇮🇳", "cast": "Sunny Deol, Ameesha Patel"},
    {"id": "8", "title": "Fighter", "year": 2024, "genre": "Action", "rating": 7.2, "language": "Hindi", "platform": "JioHotstar", "emoji": "✈️", "cast": "Hrithik Roshan, Deepika Padukone"},
    {"id": "9", "title": "RRR", "year": 2022, "genre": "Period Action", "rating": 8.0, "language": "Telugu", "platform": "Netflix", "emoji": "🔥", "cast": "Ram Charan, Jr. NTR"},
    {"id": "10", "title": "Pushpa 2", "year": 2024, "genre": "Action Thriller", "rating": 8.1, "language": "Telugu", "platform": "Prime Video", "emoji": "🌹", "cast": "Allu Arjun, Rashmika Mandanna"},
]

OTT_PLATFORMS = [
    {"name": "Netflix", "color": "#E50914", "emoji": "🎬"},
    {"name": "Prime Video", "color": "#00A8E0", "emoji": "📦"},
    {"name": "JioHotstar", "color": "#1F6CF9", "emoji": "⭐"},
    {"name": "SonyLIV", "color": "#002EDB", "emoji": "📺"},
    {"name": "ZEE5", "color": "#6C27DB", "emoji": "🎭"},
    {"name": "MX Player", "color": "#FF4444", "emoji": "▶️"},
]

@api_router.get("/entertainment/movies")
async def get_movies(genre: str = None):
    movies = MOVIES
    if genre:
        movies = [m for m in movies if genre.lower() in m["genre"].lower()]
    return {"movies": movies}

@api_router.get("/entertainment/ott")
async def get_ott():
    return {"platforms": OTT_PLATFORMS}

# ===========================
# TRAVEL (Tourist Places + Trains)
# ===========================
TOURIST_PLACES = [
    {"id": "1", "name": "Taj Mahal", "city": "Agra", "state": "Uttar Pradesh", "category": "Monument", "description": "Iconic white marble mausoleum, UNESCO World Heritage Site built by Shah Jahan", "emoji": "🕌", "best_time": "Oct-Mar"},
    {"id": "2", "name": "Kerala Backwaters", "city": "Alleppey", "state": "Kerala", "category": "Nature", "description": "Serene network of canals, rivers and lakes — houseboat experience is a must", "emoji": "🌿", "best_time": "Sep-Mar"},
    {"id": "3", "name": "Jaipur — Pink City", "city": "Jaipur", "state": "Rajasthan", "category": "Heritage", "description": "Royal palaces, Amer Fort, and vibrant bazaars in the Pink City of India", "emoji": "🏰", "best_time": "Oct-Feb"},
    {"id": "4", "name": "Goa Beaches", "city": "Panaji", "state": "Goa", "category": "Beach", "description": "Golden beaches, Portuguese heritage, seafood, and vibrant nightlife", "emoji": "🏖️", "best_time": "Nov-Feb"},
    {"id": "5", "name": "Varanasi Ghats", "city": "Varanasi", "state": "Uttar Pradesh", "category": "Spiritual", "description": "Ancient city on Ganges — Ganga Aarti at Dashashwamedh Ghat is mesmerizing", "emoji": "🪔", "best_time": "Oct-Mar"},
    {"id": "6", "name": "Mysore Palace", "city": "Mysore", "state": "Karnataka", "category": "Monument", "description": "Magnificent royal palace illuminated with 100,000 bulbs on Sundays", "emoji": "👑", "best_time": "Sep-Feb"},
    {"id": "7", "name": "Ladakh", "city": "Leh", "state": "Ladakh", "category": "Adventure", "description": "High-altitude desert landscape with Buddhist monasteries and Pangong Lake", "emoji": "⛰️", "best_time": "Jun-Sep"},
    {"id": "8", "name": "Andaman Islands", "city": "Port Blair", "state": "A&N Islands", "category": "Beach", "description": "Crystal clear waters, pristine coral reefs, and Radhanagar beach", "emoji": "🏝️", "best_time": "Oct-May"},
    {"id": "9", "name": "Hampi Ruins", "city": "Hampi", "state": "Karnataka", "category": "Heritage", "description": "Ancient ruins of Vijayanagara Empire — surreal boulder landscapes", "emoji": "🗿", "best_time": "Oct-Feb"},
    {"id": "10", "name": "Munnar Tea Gardens", "city": "Munnar", "state": "Kerala", "category": "Nature", "description": "Rolling hills covered in emerald green tea estates, cool misty weather", "emoji": "🍃", "best_time": "Sep-Mar"},
]

POPULAR_TRAINS = [
    {"number": "12951", "name": "Mumbai Rajdhani Express", "from": "Mumbai Central", "to": "New Delhi", "departure": "17:00", "arrival": "08:35+1", "duration": "15h 35m", "classes": ["1A", "2A", "3A"], "days": "Daily"},
    {"number": "12301", "name": "Howrah Rajdhani Express", "from": "Howrah", "to": "New Delhi", "departure": "14:05", "arrival": "09:55+1", "duration": "17h 50m", "classes": ["1A", "2A", "3A"], "days": "Daily"},
    {"number": "12009", "name": "Mumbai Shatabdi Express", "from": "Mumbai Central", "to": "Ahmedabad", "departure": "06:25", "arrival": "12:55", "duration": "6h 30m", "classes": ["CC", "EC"], "days": "Daily"},
    {"number": "12621", "name": "Tamil Nadu Express", "from": "New Delhi", "to": "Chennai", "departure": "22:30", "arrival": "07:40+2", "duration": "33h 10m", "classes": ["SL", "3A", "2A", "1A"], "days": "Daily"},
    {"number": "12025", "name": "Pune Shatabdi Express", "from": "Pune", "to": "Mumbai CST", "departure": "07:10", "arrival": "10:05", "duration": "2h 55m", "classes": ["CC", "EC"], "days": "Daily"},
]

@api_router.get("/travel/places")
async def get_tourist_places(category: str = None):
    places = TOURIST_PLACES
    if category:
        places = [p for p in places if p["category"].lower() == category.lower()]
    return {"places": places}

@api_router.get("/travel/trains")
async def search_trains(from_city: str = "Mumbai", to_city: str = "Delhi"):
    return {
        "trains": POPULAR_TRAINS,
        "from": from_city, "to": to_city,
        "note": "Showing popular express trains. Book at railwayenquiry.in or IRCTC."
    }

# ===========================
# TASKS CRUD
# ===========================
@api_router.get("/tasks")
async def get_tasks():
    tasks = await db.tasks.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"tasks": tasks}

@api_router.post("/tasks")
async def create_task(task: TaskCreate):
    doc = {
        "id": str(uuid.uuid4()),
        "title": task.title,
        "description": task.description or "",
        "due_date": task.due_date,
        "priority": task.priority,
        "completed": False,
        "recurring": task.recurring,
        "reminder_time": task.reminder_time,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tasks.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/tasks/{task_id}")
async def update_task(task_id: str, task: TaskUpdate):
    update_data = {k: v for k, v in task.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    updated = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return updated

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}

# ===========================
# DAILY BRIEFING
# ===========================
@api_router.get("/briefing")
async def get_daily_briefing(city: str = "Mumbai"):
    weather = await get_weather(city)
    news_data = await get_news(limit=4)
    pending_tasks_cursor = await db.tasks.find(
        {"completed": False}, {"_id": 0}
    ).to_list(5)

    ist_hour = (datetime.now(timezone.utc).hour + 5) % 24
    if ist_hour < 12:
        greeting, greeting_hi = "Good Morning! 🌅", "सुप्रभात! 🌅"
        period = "morning"
    elif ist_hour < 17:
        greeting, greeting_hi = "Good Afternoon! ☀️", "नमस्कार! ☀️"
        period = "afternoon"
    else:
        greeting, greeting_hi = "Good Evening! 🌙", "शुभ संध्या! 🌙"
        period = "evening"

    return {
        "greeting": greeting,
        "greeting_hi": greeting_hi,
        "period": period,
        "weather": weather,
        "top_news": news_data.get("articles", [])[:4],
        "pending_tasks_count": len(pending_tasks_cursor),
        "pending_tasks": pending_tasks_cursor,
        "date": datetime.now(timezone.utc).strftime("%A, %d %B %Y")
    }

# ===========================
# APP SETUP
# ===========================
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
