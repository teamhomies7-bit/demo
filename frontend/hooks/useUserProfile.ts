import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

export type UserProfile = {
  name: string;
  city: string;
  language: 'en' | 'hi';
  pushToken?: string;
  nightSummaryEnabled: boolean;
};

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  city: 'Mumbai',
  language: 'en',
  pushToken: undefined,
  nightSummaryEnabled: true,
};

const STORAGE_KEY = 'aria_user_profile_v1';

// Cross-platform storage helpers
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      return;
    }
    return AsyncStorage.setItem(key, value);
  },
};

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const stored = await storage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setProfile({ ...DEFAULT_PROFILE, ...parsed });
      }
    } catch (e) {
      console.error('Profile load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveProfile = useCallback(async (updates: Partial<UserProfile>) => {
    setProfile(prev => {
      const newProfile = { ...prev, ...updates };
      storage.setItem(STORAGE_KEY, JSON.stringify(newProfile)).catch(console.error);
      return newProfile;
    });
  }, []);

  return { profile, loading, saveProfile, loadProfile };
}
