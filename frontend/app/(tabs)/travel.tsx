import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, API_URL } from '../../constants';

type Place = {
  id: string; name: string; city: string; state: string;
  category: string; description: string; emoji: string; best_time: string;
};

type Train = {
  number: string; name: string; from: string; to: string;
  departure: string; arrival: string; duration: string; classes: string[]; days: string;
};

const CATEGORIES = ['All', 'Monument', 'Nature', 'Heritage', 'Beach', 'Spiritual', 'Adventure'];
const CATEGORY_COLORS: Record<string, string> = {
  Monument: '#FF9933', Nature: '#00E676', Heritage: '#FFD700',
  Beach: '#00BCD4', Spiritual: '#9C27B0', Adventure: COLORS.rose, All: COLORS.cyan,
};

export default function TravelScreen() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [fromCity, setFromCity] = useState('Mumbai');
  const [toCity, setToCity] = useState('Delhi');
  const [searchingTrains, setSearchingTrains] = useState(false);
  const [activeTab, setActiveTab] = useState<'places' | 'trains'>('places');

  useEffect(() => {
    fetchPlaces();
    fetchTrains();
  }, []);

  const fetchPlaces = async (category?: string) => {
    try {
      const params = category && category !== 'All' ? `?category=${category}` : '';
      const res = await fetch(`${API_URL}/api/travel/places${params}`);
      const data = await res.json();
      setPlaces(data.places || []);
    } catch (e) {
      console.error('Places fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrains = async () => {
    setSearchingTrains(true);
    try {
      const res = await fetch(`${API_URL}/api/travel/trains?from_city=${fromCity}&to_city=${toCity}`);
      const data = await res.json();
      setTrains(data.trains || []);
    } catch (e) {
      console.error('Trains fetch error:', e);
    } finally {
      setSearchingTrains(false);
    }
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    fetchPlaces(cat);
  };

  if (loading) {
    return (
      <LinearGradient colors={['#0A0A14', COLORS.bg]} style={styles.gradient}>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.cyan} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0A0A14', COLORS.bg]} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header} testID="travel-header">
            <View>
              <Text style={styles.headerTitle}>🗺️ Travel India</Text>
              <Text style={styles.headerSub}>Tourist Places · Indian Railways</Text>
            </View>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabRow}>
            {(['places', 'trains'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                testID={`travel-tab-${tab}`}
                onPress={() => setActiveTab(tab)}
                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'places' ? '🏛️ Places' : '🚆 Trains'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'places' ? (
            <>
              {/* Category Filter */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    testID={`category-${cat}`}
                    onPress={() => handleCategoryChange(cat)}
                    style={[styles.catChip, selectedCategory === cat && {
                      borderColor: CATEGORY_COLORS[cat], backgroundColor: CATEGORY_COLORS[cat] + '22',
                    }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.catText, selectedCategory === cat && { color: CATEGORY_COLORS[cat] }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Tourist Places */}
              <View testID="places-list">
                {places.map((place) => (
                  <TouchableOpacity key={place.id} testID={`place-${place.id}`} activeOpacity={0.85} style={styles.placeCard}>
                    <BlurView intensity={12} tint="dark" style={styles.placeCardInner}>
                      <LinearGradient
                        colors={[CATEGORY_COLORS[place.category] + '44' || COLORS.indigo + '44', COLORS.surface]}
                        style={styles.placeEmojiBg}
                      >
                        <Text style={styles.placeEmoji}>{place.emoji}</Text>
                      </LinearGradient>
                      <View style={styles.placeInfo}>
                        <Text style={styles.placeName}>{place.name}</Text>
                        <Text style={styles.placeLocation}>📍 {place.city}, {place.state}</Text>
                        <Text style={styles.placeDesc} numberOfLines={2}>{place.description}</Text>
                        <View style={styles.placeMeta}>
                          <View style={[styles.catBadge, { backgroundColor: (CATEGORY_COLORS[place.category] || COLORS.cyan) + '22', borderColor: (CATEGORY_COLORS[place.category] || COLORS.cyan) + '66' }]}>
                            <Text style={[styles.catBadgeText, { color: CATEGORY_COLORS[place.category] || COLORS.cyan }]}>
                              {place.category}
                            </Text>
                          </View>
                          <Text style={styles.bestTime}>🗓️ {place.best_time}</Text>
                        </View>
                      </View>
                    </BlurView>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              {/* Train Search */}
              <BlurView intensity={12} tint="dark" style={styles.searchCard} testID="train-search">
                <Text style={styles.searchTitle}>Search Trains</Text>
                <View style={styles.searchRow}>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="location" size={16} color={COLORS.cyan} style={styles.inputIcon} />
                    <TextInput
                      testID="from-city-input"
                      style={styles.searchInput}
                      value={fromCity}
                      onChangeText={setFromCity}
                      placeholder="From city"
                      placeholderTextColor={COLORS.white40}
                    />
                  </View>
                  <TouchableOpacity
                    testID="swap-cities-btn"
                    onPress={() => { const t = fromCity; setFromCity(toCity); setToCity(t); }}
                    style={styles.swapBtn}
                  >
                    <Ionicons name="swap-horizontal" size={20} color={COLORS.cyan} />
                  </TouchableOpacity>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="flag" size={16} color={COLORS.saffron} style={styles.inputIcon} />
                    <TextInput
                      testID="to-city-input"
                      style={styles.searchInput}
                      value={toCity}
                      onChangeText={setToCity}
                      placeholder="To city"
                      placeholderTextColor={COLORS.white40}
                    />
                  </View>
                </View>
                <TouchableOpacity testID="search-trains-btn" onPress={fetchTrains} activeOpacity={0.85} style={styles.searchBtn}>
                  <LinearGradient colors={[COLORS.cyan, COLORS.indigo]} style={styles.searchBtnGrad}>
                    {searchingTrains ? (
                      <ActivityIndicator color={COLORS.bg} size="small" />
                    ) : (
                      <Text style={styles.searchBtnText}>Search Trains 🚆</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </BlurView>

              {/* Train Results */}
              <View testID="trains-list">
                {trains.map((train, i) => (
                  <BlurView key={i} intensity={12} tint="dark" style={styles.trainCard} testID={`train-${train.number}`}>
                    <View style={styles.trainHeader}>
                      <Text style={styles.trainNumber}>{train.number}</Text>
                      <Text style={styles.trainName}>{train.name}</Text>
                      <View style={styles.trainDays}>
                        <Text style={styles.trainDaysText}>{train.days}</Text>
                      </View>
                    </View>
                    <View style={styles.trainRoute}>
                      <View style={styles.trainStop}>
                        <Text style={styles.trainTime}>{train.departure}</Text>
                        <Text style={styles.trainStation} numberOfLines={1}>{train.from}</Text>
                      </View>
                      <View style={styles.trainMiddle}>
                        <Ionicons name="arrow-forward" size={16} color={COLORS.cyan} />
                        <Text style={styles.trainDuration}>{train.duration}</Text>
                      </View>
                      <View style={styles.trainStop}>
                        <Text style={styles.trainTime}>{train.arrival}</Text>
                        <Text style={styles.trainStation} numberOfLines={1}>{train.to}</Text>
                      </View>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                      {train.classes.map((cls, j) => (
                        <View key={j} style={styles.classBadge}>
                          <Text style={styles.classText}>{cls}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </BlurView>
                ))}
              </View>

              <BlurView intensity={12} tint="dark" style={styles.irctcNote}>
                <Ionicons name="information-circle" size={16} color={COLORS.saffron} />
                <Text style={styles.irctcText}>Book tickets at IRCTC.co.in or IRCTC Rail Connect app</Text>
              </BlurView>
            </>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  header: { marginBottom: 16 },
  headerTitle: { fontFamily: FONTS.heading, fontSize: 26, color: COLORS.white, letterSpacing: -0.5 },
  headerSub: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.white40, marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  tabBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white05 },
  tabBtnActive: { borderColor: COLORS.cyan, backgroundColor: COLORS.cyanGlow },
  tabText: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.white40 },
  tabTextActive: { color: COLORS.cyan },
  catRow: { marginBottom: 16 },
  catChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white05 },
  catText: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.white40 },
  placeCard: { marginBottom: 12 },
  placeCardInner: { flexDirection: 'row', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(18,18,26,0.8)' },
  placeEmojiBg: { width: 90, alignItems: 'center', justifyContent: 'center', minHeight: 120 },
  placeEmoji: { fontSize: 36 },
  placeInfo: { flex: 1, padding: 14 },
  placeName: { fontFamily: FONTS.headingSemi, fontSize: 15, color: COLORS.white },
  placeLocation: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.white40, marginTop: 2 },
  placeDesc: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.white70, marginTop: 4, lineHeight: 18 },
  placeMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  catBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  catBadgeText: { fontFamily: FONTS.bodySemi, fontSize: 11 },
  bestTime: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.white40 },
  searchCard: { borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(18,18,26,0.8)' },
  searchTitle: { fontFamily: FONTS.headingSemi, fontSize: 16, color: COLORS.white, marginBottom: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white05, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 10 },
  inputIcon: { marginRight: 6 },
  searchInput: { flex: 1, height: 44, color: COLORS.white, fontFamily: FONTS.body, fontSize: 14 },
  swapBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchBtn: { borderRadius: 12, overflow: 'hidden' },
  searchBtnGrad: { height: 46, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { fontFamily: FONTS.headingSemi, fontSize: 15, color: COLORS.bg },
  trainCard: { borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(18,18,26,0.8)' },
  trainHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  trainNumber: { fontFamily: FONTS.bodySemi, fontSize: 12, color: COLORS.cyan },
  trainName: { fontFamily: FONTS.headingSemi, fontSize: 13, color: COLORS.white, flex: 1 },
  trainDays: { backgroundColor: COLORS.white05, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  trainDaysText: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.white40 },
  trainRoute: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trainStop: { flex: 1 },
  trainTime: { fontFamily: FONTS.heading, fontSize: 18, color: COLORS.white },
  trainStation: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.white40, marginTop: 2 },
  trainMiddle: { alignItems: 'center', gap: 4 },
  trainDuration: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.white40 },
  classBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLORS.white05, marginRight: 6 },
  classText: { fontFamily: FONTS.bodySemi, fontSize: 11, color: COLORS.white70 },
  irctcNote: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 12, marginTop: 8, borderWidth: 1, borderColor: COLORS.saffron + '33', backgroundColor: COLORS.saffron + '11' },
  irctcText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.white70, flex: 1 },
});
