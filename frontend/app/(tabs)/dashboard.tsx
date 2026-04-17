import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, FONTS, API_URL } from '../../constants';
import { useUserProfile } from '../../hooks/useUserProfile';

type WeatherData = {
  city: string; temperature: number; feels_like: number;
  description: string; icon: string; humidity: number;
  wind_speed: number; aqi: number; aqi_label: string; pm25: number;
  forecast: Array<{ date: string; max_temp: number; min_temp: number; icon: string; description: string }>;
};

type NewsItem = { source: string; title: string; summary: string; url: string; category: string };
type TaskItem = { id: string; title: string; priority: string; completed: boolean; due_date: string };

export default function DashboardScreen() {
  const router = useRouter();
  const { profile } = useUserProfile();
  const [briefing, setBriefing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBriefing = useCallback(async (city?: string) => {
    try {
      const cityToUse = city || profile.city || 'Mumbai';
      const res = await fetch(`${API_URL}/api/briefing?city=${encodeURIComponent(cityToUse)}`);
      const data = await res.json();
      setBriefing(data);
    } catch (e) {
      console.error('Briefing fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile.city]);

  useEffect(() => { fetchBriefing(); }, [profile.city]);

  const onRefresh = () => { setRefreshing(true); fetchBriefing(); };

  const getAqiColor = (aqi: number) => {
    if (aqi <= 50) return '#00E676';
    if (aqi <= 100) return '#FFEB3B';
    if (aqi <= 150) return COLORS.saffron;
    return COLORS.rose;
  };

  const getPriorityColor = (p: string) => {
    if (p === 'high') return COLORS.rose;
    if (p === 'medium') return COLORS.saffron;
    return COLORS.cyan;
  };

  const QUICK_ACTIONS = [
    { icon: 'chatbubble-ellipses', label: 'Ask Aria', route: '/(tabs)/chat', color: COLORS.cyan },
    { icon: 'add-circle', label: 'Add Task', route: '/(tabs)/tasks', color: COLORS.saffron },
    { icon: 'film', label: 'Movies', route: '/(tabs)/entertainment', color: '#9C27B0' },
    { icon: 'train', label: 'Travel', route: '/(tabs)/travel', color: '#00BCD4' },
  ];

  if (loading) {
    return (
      <LinearGradient colors={[COLORS.surface, COLORS.bg]} style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.cyan} />
        <Text style={styles.loadingText}>Loading your briefing...</Text>
      </LinearGradient>
    );
  }

  const weather: WeatherData = briefing?.weather;
  const news: NewsItem[] = briefing?.top_news || [];
  const tasks: TaskItem[] = briefing?.pending_tasks || [];

  return (
    <LinearGradient colors={['#0A0A14', COLORS.bg]} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.cyan} />}
        >
          {/* Header */}
          <View style={styles.header} testID="dashboard-header">
            <View>
              <Text style={styles.greeting}>
                {briefing?.greeting || 'Good Morning! 🌅'}{profile.name ? `, ${profile.name.split(' ')[0]}` : ''}
              </Text>
              <Text style={styles.date}>{briefing?.date || new Date().toDateString()}</Text>
            </View>
            <TouchableOpacity testID="profile-btn" style={styles.avatarBtn} activeOpacity={0.8}
              onPress={() => router.push('/profile')}
            >
              <LinearGradient colors={[COLORS.cyan, COLORS.indigo]} style={styles.avatar}>
                <Text style={styles.avatarText}>{profile.name ? profile.name.charAt(0).toUpperCase() : '👤'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Aria Quick Chat Strip */}
          <TouchableOpacity
            testID="quick-chat-aria"
            onPress={() => router.push('/(tabs)/chat')}
            activeOpacity={0.85}
          >
            <BlurView intensity={15} tint="dark" style={styles.ariaChatStrip}>
              <View style={styles.ariaOrb}>
                <LinearGradient colors={[COLORS.cyan, COLORS.indigo]} style={styles.ariaOrbInner}>
                  <Text style={{ fontSize: 14 }}>✨</Text>
                </LinearGradient>
              </View>
              <Text style={styles.ariaChatText}>Ask Aria anything... "What's the news today?"</Text>
              <Ionicons name="arrow-forward-circle" size={22} color={COLORS.cyan} />
            </BlurView>
          </TouchableOpacity>

          {/* Weather Card */}
          {weather && (
            <View style={styles.weatherCard} testID="weather-card">
              <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1737842827966-a265d8908509?w=800&q=80' }}
                style={styles.weatherBg}
                imageStyle={{ borderRadius: 24 }}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(5,5,5,0.95)']}
                  style={styles.weatherGradient}
                >
                  <View style={styles.weatherTop}>
                    <View>
                      <Text style={styles.weatherCity}>{weather.city}</Text>
                      <Text style={styles.weatherTemp}>{weather.temperature}°C</Text>
                      <Text style={styles.weatherDesc}>{weather.icon} {weather.description}</Text>
                    </View>
                    <View style={styles.weatherStats}>
                      <View style={styles.weatherStat}>
                        <Ionicons name="water" size={14} color={COLORS.cyan} />
                        <Text style={styles.weatherStatText}>{weather.humidity}%</Text>
                      </View>
                      <View style={styles.weatherStat}>
                        <Ionicons name="speedometer" size={14} color={COLORS.cyan} />
                        <Text style={styles.weatherStatText}>{weather.wind_speed} km/h</Text>
                      </View>
                      <View style={[styles.aqiBadge, { backgroundColor: getAqiColor(weather.aqi) + '22' }]}>
                        <Text style={[styles.aqiText, { color: getAqiColor(weather.aqi) }]}>
                          AQI {weather.aqi}
                        </Text>
                        <Text style={[styles.aqiLabel, { color: getAqiColor(weather.aqi) }]}>
                          {weather.aqi_label}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {/* 5-day forecast */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.forecastRow}>
                    {weather.forecast.map((f, i) => (
                      <View key={i} style={styles.forecastItem}>
                        <Text style={styles.forecastDate}>{f.date?.split('-').slice(1).join('/')}</Text>
                        <Text style={styles.forecastIcon}>{f.icon}</Text>
                        <Text style={styles.forecastTemp}>{f.max_temp}°</Text>
                      </View>
                    ))}
                  </ScrollView>
                </LinearGradient>
              </ImageBackground>
            </View>
          )}

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((action, i) => (
              <TouchableOpacity
                key={i}
                testID={`quick-action-${i}`}
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.8}
                style={styles.quickAction}
              >
                <BlurView intensity={12} tint="dark" style={styles.quickActionInner}>
                  <View style={[styles.qaIconBg, { backgroundColor: action.color + '22' }]}>
                    <Ionicons name={action.icon as any} size={22} color={action.color} />
                  </View>
                  <Text style={styles.qaLabel}>{action.label}</Text>
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>

          {/* News Section */}
          {news.length > 0 && (
            <View testID="news-section">
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🇮🇳 Today's Headlines</Text>
                <Text style={styles.sectionSub}>India News</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.newsScroll}>
                {news.map((item, i) => (
                  <BlurView key={i} intensity={12} tint="dark" style={styles.newsCard} testID={`news-card-${i}`}>
                    <View style={styles.newsCardTop}>
                      <Text style={styles.newsSource}>{item.source}</Text>
                      <Text style={styles.newsCategory}>{item.category}</Text>
                    </View>
                    <Text style={styles.newsTitle} numberOfLines={3}>{item.title}</Text>
                    <Text style={styles.newsSummary} numberOfLines={2}>{item.summary}</Text>
                  </BlurView>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Pending Tasks */}
          {tasks.length > 0 && (
            <View testID="tasks-section">
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📋 Pending Tasks</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/tasks')}>
                  <Text style={styles.seeAll}>See all →</Text>
                </TouchableOpacity>
              </View>
              {tasks.slice(0, 3).map((task, i) => (
                <BlurView key={i} intensity={10} tint="dark" style={styles.taskCard} testID={`task-item-${i}`}>
                  <View style={[styles.taskPriority, { backgroundColor: getPriorityColor(task.priority) }]} />
                  <View style={styles.taskInfo}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    {task.due_date && <Text style={styles.taskDue}>{task.due_date}</Text>}
                  </View>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) + '22' }]}>
                    <Text style={[styles.priorityText, { color: getPriorityColor(task.priority) }]}>
                      {task.priority}
                    </Text>
                  </View>
                </BlurView>
              ))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: COLORS.white70, fontFamily: FONTS.body, fontSize: 16 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greeting: { fontFamily: FONTS.heading, fontSize: 26, color: COLORS.white, letterSpacing: -0.5 },
  date: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.white40, marginTop: 2 },
  avatarBtn: { width: 44, height: 44 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, color: COLORS.bg, fontFamily: FONTS.heading },
  ariaChatStrip: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.borderActive, gap: 10,
    backgroundColor: 'rgba(0,240,255,0.04)',
  },
  ariaOrb: { width: 34, height: 34 },
  ariaOrbInner: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  ariaChatText: { flex: 1, fontFamily: FONTS.body, fontSize: 13, color: COLORS.white70 },
  weatherCard: { borderRadius: 24, overflow: 'hidden', marginBottom: 20, height: 220 },
  weatherBg: { flex: 1, height: 220 },
  weatherGradient: { flex: 1, padding: 20, justifyContent: 'space-between' },
  weatherTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  weatherCity: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.white70 },
  weatherTemp: { fontFamily: FONTS.heading, fontSize: 48, color: COLORS.white, lineHeight: 56 },
  weatherDesc: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.white70 },
  weatherStats: { alignItems: 'flex-end', gap: 8 },
  weatherStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weatherStatText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.white70 },
  aqiBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  aqiText: { fontFamily: FONTS.headingSemi, fontSize: 14 },
  aqiLabel: { fontFamily: FONTS.body, fontSize: 10 },
  forecastRow: { marginTop: 4 },
  forecastItem: { alignItems: 'center', marginRight: 16, gap: 2 },
  forecastDate: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.white40 },
  forecastIcon: { fontSize: 16 },
  forecastTemp: { fontFamily: FONTS.headingSemi, fontSize: 13, color: COLORS.white },
  sectionTitle: { fontFamily: FONTS.headingSemi, fontSize: 17, color: COLORS.white, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionSub: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.white40 },
  seeAll: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.cyan },
  quickActionsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  quickAction: { flex: 1 },
  quickActionInner: {
    borderRadius: 16, padding: 14, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(26,26,36,0.5)',
  },
  qaIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qaLabel: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.white70, textAlign: 'center' },
  newsScroll: { marginBottom: 24 },
  newsCard: {
    width: 240, marginRight: 12, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(18,18,26,0.8)',
  },
  newsCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  newsSource: { fontFamily: FONTS.bodySemi, fontSize: 11, color: COLORS.cyan },
  newsCategory: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.white40 },
  newsTitle: { fontFamily: FONTS.headingSemi, fontSize: 14, color: COLORS.white, lineHeight: 20, marginBottom: 6 },
  newsSummary: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.white40, lineHeight: 16 },
  taskCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border, gap: 12,
    backgroundColor: 'rgba(18,18,26,0.7)',
  },
  taskPriority: { width: 3, height: 40, borderRadius: 2 },
  taskInfo: { flex: 1 },
  taskTitle: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.white },
  taskDue: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.white40, marginTop: 2 },
  priorityBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  priorityText: { fontFamily: FONTS.bodySemi, fontSize: 11, textTransform: 'capitalize' },
});
