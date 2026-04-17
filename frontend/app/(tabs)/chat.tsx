import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { COLORS, FONTS, API_URL } from '../../constants';

type Message = { id: string; role: 'user' | 'assistant'; content: string; timestamp: string };

const SESSION_ID = 'user_default_session';

const QUICK_PROMPTS = [
  { label: '🌤️ Weather', text: 'What\'s the weather in Mumbai today?' },
  { label: '📰 News', text: 'Tell me today\'s top news from India' },
  { label: '🎬 Movies', text: 'Suggest a Bollywood movie to watch tonight' },
  { label: '✈️ Travel', text: 'Best places to visit in India in summer?' },
  { label: '📚 Study', text: 'Help me study for competitive exams' },
  { label: '💼 Work', text: 'Help me write a professional email' },
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const flatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat/history/${SESSION_ID}`);
      const data = await res.json();
      if (data.messages?.length) setMessages(data.messages);
      else addWelcomeMessage();
    } catch {
      addWelcomeMessage();
    }
  };

  const addWelcomeMessage = () => {
    const welcome: Message = {
      id: 'welcome',
      role: 'assistant',
      content: language === 'hi'
        ? 'नमस्ते! मैं Aria हूँ, आपका AI सहायक। आप मुझसे कुछ भी पूछ सकते हैं — समाचार, मौसम, फिल्में, यात्रा, या कोई भी सवाल! 🙏'
        : 'Namaste! I\'m Aria, your intelligent AI assistant for India 🇮🇳\n\nI can help you with:\n• 📰 Today\'s news & current events\n• 🌤️ Weather & AQI updates\n• 🎬 Bollywood & OTT recommendations\n• ✈️ Travel planning across India\n• 📚 Study help & work assistance\n\nWhat can I help you with today?',
      timestamp: new Date().toISOString(),
    };
    setMessages([welcome]);
  };

  const sendMessage = async (text?: string) => {
    const msg = (text || inputText).trim();
    if (!msg || isSending) return;
    setInputText('');
    setIsSending(true);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);

    const typingMsg: Message = {
      id: 'typing',
      role: 'assistant',
      content: '...',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, typingMsg]);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION_ID, message: msg, language }),
      });
      const data = await res.json();
      const aiMsg: Message = {
        id: Date.now().toString() + '_ai',
        role: 'assistant',
        content: data.response || 'Sorry, I could not process that.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => prev.filter(m => m.id !== 'typing').concat(aiMsg));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== 'typing'));
    } finally {
      setIsSending(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const startRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) { alert('Microphone permission required for voice input.'); return; }
      await audioRecorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      audioRecorder.record();
      setIsRecording(true);
    } catch (e) {
      console.error('Recording start error:', e);
    }
  };

  const stopRecording = async () => {
    if (!audioRecorder) return;
    setIsRecording(false);
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (uri) await transcribeAudio(uri);
    } catch (e) {
      console.error('Recording stop error:', e);
    }
  };

  const transcribeAudio = async (uri: string) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('file', { uri, type: 'audio/m4a', name: 'recording.m4a' } as any);
      const res = await fetch(`${API_URL}/api/voice/transcribe`, {
        method: 'POST', body: formData,
      });
      const data = await res.json();
      if (data.text) {
        setInputText(data.text);
      }
    } catch (e) {
      console.error('Transcription error:', e);
    } finally {
      setIsTranscribing(false);
    }
  };

  const clearChat = async () => {
    try {
      await fetch(`${API_URL}/api/chat/history/${SESSION_ID}`, { method: 'DELETE' });
      addWelcomeMessage();
    } catch (e) { console.error(e); }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const isTyping = item.id === 'typing';

    if (isTyping) {
      return (
        <View style={styles.aiBubbleContainer}>
          <View style={styles.ariaAvatarSmall}>
            <LinearGradient colors={[COLORS.cyan, COLORS.indigo]} style={styles.ariaAvatarGrad}>
              <Text style={{ fontSize: 10 }}>A</Text>
            </LinearGradient>
          </View>
          <View style={styles.typingBubble}>
            <Text style={styles.typingDots}>● ● ●</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
        {!isUser && (
          <View style={styles.ariaAvatarSmall}>
            <LinearGradient colors={[COLORS.cyan, COLORS.indigo]} style={styles.ariaAvatarGrad}>
              <Text style={{ fontSize: 10, color: COLORS.bg }}>A</Text>
            </LinearGradient>
          </View>
        )}
        {isUser ? (
          <BlurView intensity={10} tint="dark" style={styles.userBubble}>
            <Text style={styles.userText}>{item.content}</Text>
          </BlurView>
        ) : (
          <View style={styles.aiBubble}>
            <Text style={styles.aiText}>{item.content}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0A0A14', COLORS.bg]} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <BlurView intensity={20} tint="dark" style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient colors={[COLORS.cyan, COLORS.indigo]} style={styles.headerOrb}>
              <Text style={styles.headerOrbText}>A</Text>
            </LinearGradient>
            <View>
              <Text style={styles.headerTitle} testID="aria-title">Aria</Text>
              <Text style={styles.headerSub}>Your AI Assistant</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              testID="language-toggle"
              onPress={() => setLanguage(l => l === 'en' ? 'hi' : 'en')}
              style={[styles.langToggle, { borderColor: language === 'hi' ? COLORS.saffron : COLORS.cyan }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.langText, { color: language === 'hi' ? COLORS.saffron : COLORS.cyan }]}>
                {language === 'hi' ? 'हिं' : 'EN'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity testID="clear-chat-btn" onPress={clearChat} style={styles.clearBtn} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={18} color={COLORS.white40} />
            </TouchableOpacity>
          </View>
        </BlurView>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          testID="messages-list"
        />

        {/* Quick Prompts */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickPromptsRow}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {QUICK_PROMPTS.map((p, i) => (
            <TouchableOpacity
              key={i}
              testID={`quick-prompt-${i}`}
              onPress={() => sendMessage(p.text)}
              style={styles.quickChip}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input Area */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <BlurView intensity={20} tint="dark" style={styles.inputArea}>
            <TextInput
              testID="chat-input"
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder={language === 'hi' ? 'Aria से पूछें...' : 'Ask Aria anything...'}
              placeholderTextColor={COLORS.white40}
              multiline
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage()}
            />
            {isTranscribing ? (
              <ActivityIndicator color={COLORS.cyan} style={styles.iconBtn} />
            ) : (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  testID="voice-btn"
                  onPressIn={startRecording}
                  onPressOut={stopRecording}
                  style={[styles.voiceBtn, isRecording && styles.voiceBtnActive]}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isRecording ? [COLORS.rose, '#FF6B6B'] : [COLORS.cyan, COLORS.indigo]}
                    style={styles.voiceBtnGrad}
                  >
                    <Ionicons name={isRecording ? 'radio' : 'mic'} size={18} color={COLORS.bg} />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}
            <TouchableOpacity
              testID="send-btn"
              onPress={() => sendMessage()}
              disabled={!inputText.trim() || isSending}
              style={[styles.sendBtn, (!inputText.trim() || isSending) && styles.sendBtnDisabled]}
              activeOpacity={0.8}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={COLORS.bg} />
              ) : (
                <Ionicons name="send" size={16} color={inputText.trim() ? COLORS.bg : COLORS.white40} />
              )}
            </TouchableOpacity>
          </BlurView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: 'rgba(10,10,20,0.9)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerOrb: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerOrbText: { fontFamily: FONTS.heading, fontSize: 16, color: COLORS.bg },
  headerTitle: { fontFamily: FONTS.headingSemi, fontSize: 18, color: COLORS.white },
  headerSub: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.white40 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  langToggle: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  langText: { fontFamily: FONTS.bodySemi, fontSize: 12 },
  clearBtn: { padding: 4 },
  messagesList: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  messageRow: { marginBottom: 16 },
  userRow: { alignItems: 'flex-end' },
  aiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  aiBubbleContainer: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  ariaAvatarSmall: { width: 32, height: 32, marginTop: 2 },
  ariaAvatarGrad: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  userBubble: {
    maxWidth: '80%', borderRadius: 20, borderBottomRightRadius: 4,
    padding: 14, borderWidth: 1, borderColor: COLORS.white10,
    backgroundColor: 'rgba(0,240,255,0.08)',
  },
  userText: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.white, lineHeight: 22 },
  aiBubble: {
    flex: 1, borderLeftWidth: 2, borderLeftColor: COLORS.cyan,
    paddingLeft: 14, paddingVertical: 4,
  },
  aiText: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.white, lineHeight: 24 },
  typingBubble: { paddingLeft: 14, paddingVertical: 8 },
  typingDots: { color: COLORS.cyan, fontSize: 16, letterSpacing: 4 },
  quickPromptsRow: { maxHeight: 44, marginBottom: 4 },
  quickChip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: COLORS.cyanGlow, borderWidth: 1, borderColor: COLORS.borderActive,
  },
  quickChipText: { fontFamily: FONTS.bodySemi, fontSize: 12, color: COLORS.cyan },
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16,
    paddingVertical: 10, gap: 10, borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: 'rgba(10,10,20,0.9)',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  input: {
    flex: 1, backgroundColor: COLORS.white05, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    color: COLORS.white, fontFamily: FONTS.body, fontSize: 15, maxHeight: 100,
  },
  iconBtn: { width: 44, height: 44 },
  voiceBtn: { width: 44, height: 44 },
  voiceBtnActive: { shadowColor: COLORS.rose, shadowRadius: 8, shadowOpacity: 0.6 },
  voiceBtnGrad: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.cyan, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.white10 },
});
