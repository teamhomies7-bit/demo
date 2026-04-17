"""Tests for new features: Night Summary, Push Notifications"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', os.environ.get('EXPO_PACKAGER_HOSTNAME', '')).rstrip('/')

@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

# Health check
def test_health(client):
    r = client.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

# Night Summary API
def test_night_summary_english(client):
    r = client.get(f"{BASE_URL}/api/night-summary?user_name=TestUser&language=en")
    assert r.status_code == 200
    data = r.json()
    assert "summary" in data
    assert len(data["summary"]) > 10
    assert "user_name" in data
    print(f"Night summary (EN): {data['summary'][:100]}")

def test_night_summary_hindi(client):
    r = client.get(f"{BASE_URL}/api/night-summary?user_name=Rahul&language=hi")
    assert r.status_code == 200
    data = r.json()
    assert "summary" in data
    assert len(data["summary"]) > 5
    print(f"Night summary (HI): {data['summary'][:100]}")

def test_night_summary_returns_counts(client):
    r = client.get(f"{BASE_URL}/api/night-summary?user_name=Test")
    assert r.status_code == 200
    data = r.json()
    assert "completed_count" in data
    assert "pending_count" in data

# Push Token Registration
def test_register_push_token(client):
    r = client.post(f"{BASE_URL}/api/notifications/register", json={
        "token": "ExponentPushToken[TEST_TOKEN_12345]",
        "user_name": "TestUser",
        "language": "en"
    })
    assert r.status_code == 200
    data = r.json()
    assert "message" in data
    assert "registered" in data["message"].lower()

def test_send_night_summary_endpoint_exists(client):
    """Endpoint should exist and return a valid response"""
    r = client.post(f"{BASE_URL}/api/notifications/send-night-summary")
    assert r.status_code == 200
    data = r.json()
    assert "sent" in data or "message" in data

# Weather with custom city (from profile)
def test_weather_bangalore(client):
    r = client.get(f"{BASE_URL}/api/weather?city=Bangalore")
    assert r.status_code == 200
    data = r.json()
    assert "temperature" in data
    assert "city" in data

def test_briefing_bangalore(client):
    r = client.get(f"{BASE_URL}/api/briefing?city=Bangalore")
    assert r.status_code == 200
    data = r.json()
    assert "weather" in data
    assert data["weather"]["city"] is not None
