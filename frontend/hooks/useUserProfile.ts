import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

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

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
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
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile)).catch(console.error);
      return newProfile;
    });
  }, []);

  return { profile, loading, saveProfile, loadProfile };
}
