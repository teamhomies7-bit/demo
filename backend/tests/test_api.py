import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://daily-ai-assistant-7.preview.emergentagent.com').rstrip('/')

@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

# Health
def test_health(client):
    r = client.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200

# News
def test_news(client):
    r = client.get(f"{BASE_URL}/api/news")
    assert r.status_code == 200
    data = r.json()
    assert "articles" in data
    assert len(data["articles"]) > 0

# Weather
def test_weather_default(client):
    r = client.get(f"{BASE_URL}/api/weather")
    assert r.status_code == 200
    data = r.json()
    assert "temperature" in data or "city" in data

def test_weather_mumbai(client):
    r = client.get(f"{BASE_URL}/api/weather?city=Mumbai")
    assert r.status_code == 200
    data = r.json()
    assert "temperature" in data

# Entertainment
def test_movies(client):
    r = client.get(f"{BASE_URL}/api/entertainment/movies")
    assert r.status_code == 200
    data = r.json()
    assert "movies" in data
    assert len(data["movies"]) > 0

# Travel
def test_places(client):
    r = client.get(f"{BASE_URL}/api/travel/places")
    assert r.status_code == 200
    data = r.json()
    assert "places" in data

def test_trains(client):
    r = client.get(f"{BASE_URL}/api/travel/trains")
    assert r.status_code == 200
    data = r.json()
    assert "trains" in data or "routes" in data

# Tasks CRUD
def test_tasks_create_and_get(client):
    payload = {"title": "TEST_task_pytest", "priority": "medium", "description": "test"}
    r = client.post(f"{BASE_URL}/api/tasks", json=payload)
    assert r.status_code == 200 or r.status_code == 201
    created = r.json()
    task_id = created.get("id") or created.get("_id")
    assert task_id

    r2 = client.get(f"{BASE_URL}/api/tasks")
    assert r2.status_code == 200
    tasks_data = r2.json()
    tasks = tasks_data.get("tasks", tasks_data) if isinstance(tasks_data, dict) else tasks_data
    titles = [t.get("title") for t in tasks]
    assert "TEST_task_pytest" in titles

# Briefing
def test_briefing(client):
    r = client.get(f"{BASE_URL}/api/briefing")
    assert r.status_code == 200

# Chat
def test_chat(client):
    import uuid
    session_id = f"TEST_{uuid.uuid4().hex[:8]}"
    r = client.post(f"{BASE_URL}/api/chat", json={
        "session_id": session_id,
        "message": "What is the capital of India?",
        "language": "en"
    })
    assert r.status_code == 200
    data = r.json()
    assert "response" in data
    assert len(data["response"]) > 0
    # cleanup
    client.delete(f"{BASE_URL}/api/chat/history/{session_id}")
