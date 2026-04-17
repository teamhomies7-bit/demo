# Aria AI — Product Requirements Document

## Overview
**Aria AI** is a production-grade mobile AI assistant app built with Expo React Native + FastAPI + MongoDB, specifically designed for Indian users aged 14+. It functions as a daily-use assistant — not just a chatbot.

**App URL**: https://daily-ai-assistant-7.preview.emergentagent.com

---

## Architecture

### Tech Stack
- **Frontend**: Expo React Native SDK 54 (expo-router file-based navigation)
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **AI**: Claude Sonnet 4.5 via Emergent Universal Key (emergentintegrations library)
- **Voice**: OpenAI Whisper-1 via Emergent Universal Key
- **Weather**: Open-Meteo (free, no API key)
- **News**: RSS feeds (Times of India, NDTV, The Hindu, India Today, HT)
- **Design**: Electric & Neon theme (Jarvis-style), Outfit + PlusJakartaSans fonts

### Backend Endpoints
- `GET /api/health` - Health check
- `POST /api/chat` - AI chat (Claude Sonnet 4.5)
- `GET /api/chat/history/{session_id}` - Chat history
- `DELETE /api/chat/history/{session_id}` - Clear chat
- `POST /api/voice/transcribe` - Whisper voice transcription
- `GET /api/news` - Indian news (RSS feeds)
- `GET /api/weather?city=Mumbai` - Weather + AQI (Open-Meteo)
- `GET /api/briefing` - Daily briefing (weather + news + tasks)
- `GET /api/entertainment/movies` - Bollywood movies
- `GET /api/entertainment/ott` - OTT platforms
- `GET /api/travel/places` - Indian tourist places
- `GET /api/travel/trains` - Popular train routes
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task

### Frontend Screens (5 tabs)
1. **Dashboard** — Greeting, live weather card, 5-day forecast, live news from RSS, task summary, quick actions
2. **Chat (Aria)** — AI chat with Claude Sonnet 4.5, voice input (Whisper), Hindi/English toggle, quick prompts
3. **Tasks** — Task CRUD with priority, due dates, local notifications (expo-notifications), recurring options
4. **Entertainment** — Bollywood/regional movies, OTT platforms, genre filtering
5. **Travel** — Tourist places (category filter), train search (Mumbai↔Delhi etc.)

---

## User Personas
1. **Students** (14-22) — Study help, news, entertainment
2. **Working Professionals** (22-35) — Task management, weather, travel
3. **General Users** (35+) — News, weather, family planning

---

## Core Requirements (Static)
- [ ] AI Chat must work in Hindi and English
- [ ] Weather shows real-time data for Indian cities
- [ ] News fetches from Indian RSS feeds (TOI, NDTV, etc.)
- [ ] Tasks support priority (low/medium/high) and local notifications
- [ ] Entertainment shows Indian films across languages
- [ ] Travel shows tourist places and train routes
- [ ] Dark mode is permanent (no light mode)

---

## What's Been Implemented (April 2026)

### MVP v1.0 - April 18, 2026
- ✅ Complete Expo React Native frontend with 5 tabs
- ✅ Floating BlurView tab bar (Jarvis-style dark design)
- ✅ AI Chat with Claude Sonnet 4.5 + session management + MongoDB persistence
- ✅ Voice input with Whisper-1 (expo-audio recording → backend transcription)
- ✅ Hindi/English toggle for AI responses
- ✅ Live Indian news from RSS feeds (TOI, NDTV, The Hindu, India Today, HT) with 1-hour cache
- ✅ Live weather + AQI from Open-Meteo (completely free, no key) with 30-min cache
- ✅ 5-day weather forecast
- ✅ Daily briefing endpoint combining weather + news + tasks
- ✅ Tasks CRUD with MongoDB persistence, priority colors, local notifications
- ✅ Entertainment: 10 trending Bollywood/regional movies + 6 OTT platforms + genre filter
- ✅ Travel: 10 Indian tourist places (category filter) + 5 popular train routes
- ✅ Outfit + PlusJakartaSans Google Fonts loaded
- ✅ Electric & Neon design system (Jarvis-style, #050505 base, #00F0FF cyan)
- ✅ All backend APIs tested and working

---

## Prioritized Backlog

### P0 (Critical - Must Fix)
- None currently

### P1 (High Priority - Next Sprint)
- Add city selection for weather (currently hardcoded to Mumbai)
- Add user onboarding/profile screen with name, city, language preference
- Implement persistent session ID using AsyncStorage
- Add pull-to-refresh on all screens

### P2 (Nice to Have)
- IPL scores integration (free API)
- Government scheme search (india.gov.in RSS)
- Calendar integration for meeting management
- Push notifications via Firebase FCM
- Hindi language news (Amar Ujala, Dainik Bhaskar RSS)
- Share news articles / tasks

---

## Next Tasks List
1. Add city picker in settings/profile
2. AsyncStorage for session ID persistence
3. User profile screen with preferences
4. Onboarding flow for new users
5. FCM push notifications (needs Firebase project setup)
6. Add more RSS feeds (regional/vernacular)
