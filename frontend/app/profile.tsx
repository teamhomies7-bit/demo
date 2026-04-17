import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput,
  Modal, FlatList, Switch, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { COLORS, FONTS, API_URL } from '../constants';
import { useUserProfile } from '../hooks/useUserProfile';

const INDIAN_CITIES = [
  'Agra', 'Ahmedabad', 'Allahabad', 'Amritsar', 'Aurangabad', 'Bangalore', 'Bareilly',
  'Bhopal', 'Bhubaneswar', 'Chandigarh', 'Chennai', 'Coimbatore', 'Dehradun', 'Delhi',
  'Dhanbad', 'Faridabad', 'Ghaziabad', 'Guwahati', 'Gwalior', 'Howrah', 'Hubli',
  'Hyderabad', 'Indore', 'Jabalpur', 'Jaipur', 'Jodhpur', 'Kanpur', 'Kochi',
  'Kolkata', 'Kota', 'Kozhikode', 'Lucknow', 'Ludhiana', 'Madurai', 'Mangalore',
  'Meerut', 'Mumbai', 'Mysore', 'Nagpur', 'Nashik', 'Noida', 'Patna', 'Pune',
  'Raipur', 'Rajkot', 'Ranchi', 'Salem', 'Solapur', 'Srinagar', 'Surat',
  'Thane', 'Thiruvananthapuram', 'Tiruchirappalli', 'Vadodara', 'Varanasi',
  'Vijayawada', 'Visakhapatnam', 'Warangal',
];

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, loading, saveProfile } = useUserProfile();
  const [name, setName] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [nightSummary, setNightSummary] = useState(true);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);
  const [pushToken, setPushToken] = useState('');
  const [nightSummaryText, setNightSummaryText] = useState('');
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  useEffect(() => {
    if (!loading) {
      setName(profile.name);
      setCity(profile.city);
      setLanguage(profile.language);
      setNightSummary(profile.nightSummaryEnabled);
    }
  }, [loading, profile]);

  useEffect(() => {
    registerForPushNotifications();
  }, []);

  const registerForPushNotifications = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;
      setPushToken(token);
    } catch (e) {
      console.log('Push token error (web not supported):', e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile({ name, city, language, nightSummaryEnabled: nightSummary, pushToken });

      // Register push token with backend
      if (pushToken) {
        await fetch(`${API_URL}/api/notifications/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: pushToken, user_name: name || 'User', language }),
        });
      }

      // Schedule night summary notification at 9 PM
      if (nightSummary) {
        await scheduleNightSummaryNotification();
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
      }

      Alert.alert('Saved! ✅', 'Your preferences have been updated.');
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const scheduleNightSummaryNotification = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = new Date();
    const tonight9PM = new Date();
    tonight9PM.setHours(21, 0, 0, 0);
    if (tonight9PM <= now) {
      tonight9PM.setDate(tonight9PM.getDate() + 1);
    }
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌙 Aria Night Summary',
          body: `Good night, ${name || 'friend'}! Tap to see today's recap and tomorrow's plan.`,
          sound: true,
          data: { screen: 'dashboard', type: 'night_summary' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 21, minute: 0 },
      });
    } catch (e) {
      console.log('Schedule notification error:', e);
    }
  };

  const testNightSummary = async () => {
    setTestingNotif(true);
    try {
      const res = await fetch(`${API_URL}/api/night-summary?user_name=${encodeURIComponent(name || 'User')}&language=${language}`);
      const data = await res.json();
      setNightSummaryText(data.summary || 'Unable to generate summary');
      setShowSummaryModal(true);
    } catch (e) {
      Alert.alert('Error', 'Failed to generate night summary');
    } finally {
      setTestingNotif(false);
    }
  };

  const filteredCities = citySearch
    ? INDIAN_CITIES.filter(c => c.toLowerCase().startsWith(citySearch.toLowerCase()))
    : INDIAN_CITIES;

  if (loading) {
    return (
      <LinearGradient colors={['#0A0A14', COLORS.bg]} style={styles.gradient}>
        <ActivityIndicator color={COLORS.cyan} style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  const initials = name ? name.charAt(0).toUpperCase() : '👤';

  return (
    <LinearGradient colors={['#0A0A14', COLORS.bg]} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile & Settings</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Avatar */}
            <View style={styles.avatarSection}>
              <LinearGradient colors={[COLORS.cyan, COLORS.indigo]} style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>{initials}</Text>
              </LinearGradient>
              <Text style={styles.avatarCaption}>Tap below to set your name</Text>
            </View>

            {/* Name */}
            <View style={styles.section} testID="name-section">
              <Text style={styles.sectionLabel}>Your Name</Text>
              <TextInput
                testID="name-input"
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={COLORS.white40}
              />
            </View>

            {/* City Picker */}
            <View style={styles.section} testID="city-section">
              <Text style={styles.sectionLabel}>Your City</Text>
              <TouchableOpacity
                testID="city-picker-btn"
                onPress={() => setCityModalVisible(true)}
                style={styles.pickerBtn}
                activeOpacity={0.8}
              >
                <Ionicons name="location" size={18} color={COLORS.cyan} />
                <Text style={styles.pickerBtnText}>{city}</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.white40} />
              </TouchableOpacity>
            </View>

            {/* Language Toggle */}
            <View style={styles.section} testID="language-section">
              <Text style={styles.sectionLabel}>App Language</Text>
              <View style={styles.langRow}>
                {(['en', 'hi'] as const).map(lang => (
                  <TouchableOpacity
                    key={lang}
                    testID={`lang-btn-${lang}`}
                    onPress={() => setLanguage(lang)}
                    style={[styles.langBtn, language === lang && styles.langBtnActive]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.langBtnText, language === lang && styles.langBtnTextActive]}>
                      {lang === 'en' ? '🇬🇧 English' : '🇮🇳 हिंदी'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Night Summary Settings */}
            <BlurView intensity={12} tint="dark" style={styles.nightSummaryCard} testID="night-summary-section">
              <View style={styles.nsHeader}>
                <View>
                  <Text style={styles.nsTitle}>🌙 Night Summary</Text>
                  <Text style={styles.nsSub}>Daily recap at 9:00 PM</Text>
                </View>
                <Switch
                  testID="night-summary-toggle"
                  value={nightSummary}
                  onValueChange={setNightSummary}
                  trackColor={{ false: COLORS.white10, true: COLORS.cyanGlow40 }}
                  thumbColor={nightSummary ? COLORS.cyan : COLORS.white40}
                />
              </View>
              <Text style={styles.nsDesc}>
                Aria will send you a personalized end-of-day recap with your completed tasks and tomorrow's plan every evening at 9 PM.
              </Text>
              <TouchableOpacity
                testID="test-night-summary-btn"
                onPress={testNightSummary}
                disabled={testingNotif}
                style={styles.testBtn}
                activeOpacity={0.8}
              >
                {testingNotif ? (
                  <ActivityIndicator size="small" color={COLORS.bg} />
                ) : (
                  <Text style={styles.testBtnText}>✨ Preview Tonight's Summary</Text>
                )}
              </TouchableOpacity>
            </BlurView>

            {/* Push Token Info */}
            {pushToken ? (
              <BlurView intensity={10} tint="dark" style={styles.tokenCard}>
                <Ionicons name="notifications" size={16} color={COLORS.cyan} />
                <Text style={styles.tokenText}>Push notifications enabled ✅</Text>
              </BlurView>
            ) : (
              <BlurView intensity={10} tint="dark" style={styles.tokenCard}>
                <Ionicons name="notifications-off" size={16} color={COLORS.white40} />
                <Text style={styles.tokenText}>Push notifications not available on web preview</Text>
              </BlurView>
            )}

            {/* Save Button */}
            <TouchableOpacity testID="save-profile-btn" onPress={handleSave} disabled={saving} style={styles.saveBtn} activeOpacity={0.85}>
              <LinearGradient colors={[COLORS.cyan, COLORS.indigo]} style={styles.saveBtnGrad}>
                {saving ? (
                  <ActivityIndicator color={COLORS.bg} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Preferences</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* City Picker Modal */}
      <Modal visible={cityModalVisible} transparent animationType="slide" onRequestClose={() => setCityModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <BlurView intensity={30} tint="dark" style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select City</Text>
              <TouchableOpacity onPress={() => setCityModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.white70} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color={COLORS.white40} />
              <TextInput
                testID="city-search-input"
                style={styles.searchInput}
                value={citySearch}
                onChangeText={setCitySearch}
                placeholder="Search city..."
                placeholderTextColor={COLORS.white40}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredCities}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  testID={`city-option-${item}`}
                  onPress={() => { setCity(item); setCitySearch(''); setCityModalVisible(false); }}
                  style={[styles.cityItem, city === item && styles.cityItemActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cityItemText, city === item && styles.cityItemTextActive]}>
                    📍 {item}
                  </Text>
                  {city === item && <Ionicons name="checkmark" size={18} color={COLORS.cyan} />}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 350 }}
            />
          </BlurView>
        </View>
      </Modal>

      {/* Night Summary Preview Modal */}
      <Modal visible={showSummaryModal} transparent animationType="fade" onRequestClose={() => setShowSummaryModal(false)}>
        <View style={styles.modalOverlay}>
          <BlurView intensity={30} tint="dark" style={styles.summaryModal}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>🌙 Tonight's Summary Preview</Text>
              <TouchableOpacity onPress={() => setShowSummaryModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.white70} />
              </TouchableOpacity>
            </View>
            <View style={styles.summaryBody}>
              <Text style={styles.summaryText}>{nightSummaryText}</Text>
            </View>
            <Text style={styles.summaryNote}>This is what Aria will send you every night at 9 PM 🌙</Text>
          </BlurView>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FONTS.headingSemi, fontSize: 18, color: COLORS.white },
  scrollContent: { paddingHorizontal: 20 },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarInitial: { fontFamily: FONTS.heading, fontSize: 32, color: COLORS.bg },
  avatarCaption: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.white40 },
  section: { marginBottom: 20 },
  sectionLabel: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.white40, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  textInput: {
    backgroundColor: COLORS.white05, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 16, height: 52,
    color: COLORS.white, fontFamily: FONTS.body, fontSize: 15,
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white05, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 16, height: 52,
  },
  pickerBtnText: { flex: 1, fontFamily: FONTS.body, fontSize: 15, color: COLORS.white },
  langRow: { flexDirection: 'row', gap: 12 },
  langBtn: {
    flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white05,
  },
  langBtnActive: { borderColor: COLORS.cyan, backgroundColor: COLORS.cyanGlow },
  langBtnText: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.white40 },
  langBtnTextActive: { color: COLORS.cyan },
  nightSummaryCard: {
    borderRadius: 20, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(18,18,26,0.85)',
  },
  nsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  nsTitle: { fontFamily: FONTS.headingSemi, fontSize: 16, color: COLORS.white },
  nsSub: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.white40, marginTop: 2 },
  nsDesc: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.white70, lineHeight: 20, marginBottom: 14 },
  testBtn: { borderRadius: 12, backgroundColor: COLORS.cyanGlow, borderWidth: 1, borderColor: COLORS.borderActive, paddingVertical: 12, alignItems: 'center' },
  testBtnText: { fontFamily: FONTS.bodySemi, fontSize: 14, color: COLORS.cyan },
  tokenCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(18,18,26,0.6)',
  },
  tokenText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.white70, flex: 1 },
  saveBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  saveBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontFamily: FONTS.headingSemi, fontSize: 16, color: COLORS.bg },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,12,20,0.95)', maxHeight: '70%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontFamily: FONTS.headingSemi, fontSize: 18, color: COLORS.white },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white05, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 12,
  },
  searchInput: { flex: 1, color: COLORS.white, fontFamily: FONTS.body, fontSize: 14 },
  cityItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  cityItemActive: { backgroundColor: COLORS.cyanGlow, borderRadius: 10, paddingHorizontal: 8, borderBottomWidth: 0 },
  cityItemText: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.white70 },
  cityItemTextActive: { color: COLORS.cyan, fontFamily: FONTS.bodySemi },
  summaryModal: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(12,12,20,0.95)',
  },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  summaryTitle: { fontFamily: FONTS.headingSemi, fontSize: 16, color: COLORS.white },
  summaryBody: { backgroundColor: COLORS.white05, borderRadius: 16, padding: 16, marginBottom: 12 },
  summaryText: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.white, lineHeight: 24 },
  summaryNote: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.white40, textAlign: 'center' },
});
