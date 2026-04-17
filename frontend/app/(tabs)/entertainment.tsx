import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, ImageBackground, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, API_URL } from '../../constants';

type Movie = {
  id: string; title: string; year: number; genre: string;
  rating: number; language: string; platform: string; emoji: string; cast: string;
};

type OTTPlatform = { name: string; color: string; emoji: string };

export default function EntertainmentScreen() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [platforms, setPlatforms] = useState<OTTPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState('All');

  const GENRES = ['All', 'Action', 'Drama', 'Comedy', 'Horror', 'Sci-Fi', 'Romance'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [moviesRes, ottRes] = await Promise.all([
        fetch(`${API_URL}/api/entertainment/movies`),
        fetch(`${API_URL}/api/entertainment/ott`),
      ]);
      const moviesData = await moviesRes.json();
      const ottData = await ottRes.json();
      setMovies(moviesData.movies || []);
      setPlatforms(ottData.platforms || []);
    } catch (e) {
      console.error('Entertainment fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredMovies = selectedGenre === 'All'
    ? movies
    : movies.filter(m => m.genre.toLowerCase().includes(selectedGenre.toLowerCase()));

  const renderStars = (rating: number) => {
    const stars = Math.round(rating / 2);
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
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
          <View style={styles.header} testID="entertainment-header">
            <View>
              <Text style={styles.headerTitle}>🎬 Entertainment</Text>
              <Text style={styles.headerSub}>Bollywood · Regional · OTT India</Text>
            </View>
          </View>

          {/* OTT Platforms */}
          <Text style={styles.sectionTitle}>📺 Streaming Platforms</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ottRow}>
            {platforms.map((p, i) => (
              <TouchableOpacity
                key={i}
                testID={`ott-${p.name}`}
                activeOpacity={0.8}
                style={styles.ottCard}
              >
                <BlurView intensity={12} tint="dark" style={styles.ottCardInner}>
                  <View style={[styles.ottIcon, { backgroundColor: p.color + '33', borderColor: p.color + '66' }]}>
                    <Text style={styles.ottEmoji}>{p.emoji}</Text>
                  </View>
                  <Text style={styles.ottName}>{p.name}</Text>
                </BlurView>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Genre Filter */}
          <Text style={styles.sectionTitle}>🍿 Trending Indian Films</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreRow} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            {GENRES.map(g => (
              <TouchableOpacity
                key={g}
                testID={`genre-${g}`}
                onPress={() => setSelectedGenre(g)}
                style={[styles.genreChip, selectedGenre === g && styles.genreChipActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.genreText, selectedGenre === g && styles.genreTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Movie Cards Grid */}
          <View style={styles.moviesGrid} testID="movies-grid">
            {filteredMovies.map((movie, i) => (
              <TouchableOpacity key={movie.id} testID={`movie-${movie.id}`} activeOpacity={0.85} style={styles.movieCard}>
                <BlurView intensity={12} tint="dark" style={styles.movieCardInner}>
                  {/* Poster */}
                  <LinearGradient
                    colors={[COLORS.indigo + '88', COLORS.surface]}
                    style={styles.moviePoster}
                  >
                    <Text style={styles.movieEmoji}>{movie.emoji}</Text>
                  </LinearGradient>
                  {/* Info */}
                  <View style={styles.movieInfo}>
                    <Text style={styles.movieTitle} numberOfLines={2}>{movie.title}</Text>
                    <Text style={styles.movieYear}>{movie.year} · {movie.language}</Text>
                    <Text style={styles.movieGenre}>{movie.genre}</Text>
                    <View style={styles.movieFooter}>
                      <Text style={styles.movieRating}>{movie.rating}⭐</Text>
                      <View style={[styles.platformBadge, { backgroundColor: COLORS.cyan + '22' }]}>
                        <Text style={[styles.platformText, { color: COLORS.cyan }]}>{movie.platform}</Text>
                      </View>
                    </View>
                    <Text style={styles.movieCast} numberOfLines={1}>👥 {movie.cast}</Text>
                  </View>
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>

          {filteredMovies.length === 0 && (
            <View style={styles.emptyState} testID="no-movies">
              <Text style={styles.emptyText}>No movies in this genre</Text>
            </View>
          )}

          {/* Bollywood Trivia */}
          <BlurView intensity={12} tint="dark" style={styles.triviaCard} testID="trivia-card">
            <Text style={styles.triviaTitle}>🎭 Did you know?</Text>
            <Text style={styles.triviaText}>
              India is the world's largest film producer, making over 1,800+ films per year across Bollywood, Tollywood, Kollywood and more!
            </Text>
          </BlurView>

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
  header: { marginBottom: 20 },
  headerTitle: { fontFamily: FONTS.heading, fontSize: 26, color: COLORS.white, letterSpacing: -0.5 },
  headerSub: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.white40, marginTop: 2 },
  sectionTitle: { fontFamily: FONTS.headingSemi, fontSize: 17, color: COLORS.white, marginBottom: 12 },
  ottRow: { marginBottom: 24 },
  ottCard: { marginRight: 12 },
  ottCardInner: { borderRadius: 16, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(18,18,26,0.8)', width: 80 },
  ottIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  ottEmoji: { fontSize: 22 },
  ottName: { fontFamily: FONTS.bodySemi, fontSize: 11, color: COLORS.white70, textAlign: 'center' },
  genreRow: { marginBottom: 16 },
  genreChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white05 },
  genreChipActive: { borderColor: COLORS.cyan, backgroundColor: COLORS.cyanGlow },
  genreText: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.white40 },
  genreTextActive: { color: COLORS.cyan },
  moviesGrid: { gap: 12 },
  movieCard: {},
  movieCardInner: { flexDirection: 'row', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(18,18,26,0.8)' },
  moviePoster: { width: 90, height: 120, alignItems: 'center', justifyContent: 'center' },
  movieEmoji: { fontSize: 36 },
  movieInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
  movieTitle: { fontFamily: FONTS.headingSemi, fontSize: 15, color: COLORS.white, lineHeight: 20 },
  movieYear: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.white40, marginTop: 2 },
  movieGenre: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.white70 },
  movieFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  movieRating: { fontFamily: FONTS.bodySemi, fontSize: 13, color: COLORS.saffron },
  platformBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  platformText: { fontFamily: FONTS.bodySemi, fontSize: 10 },
  movieCast: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.white40, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.white40 },
  triviaCard: { borderRadius: 20, padding: 18, marginTop: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(18,18,26,0.8)' },
  triviaTitle: { fontFamily: FONTS.headingSemi, fontSize: 15, color: COLORS.white, marginBottom: 8 },
  triviaText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.white70, lineHeight: 20 },
});
