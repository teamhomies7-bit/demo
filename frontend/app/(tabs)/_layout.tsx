import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Platform, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants';

type TabInfo = { route: string; icon: string; label: string };

const TABS: TabInfo[] = [
  { route: 'dashboard', icon: 'home', label: 'Home' },
  { route: 'chat', icon: 'chatbubble-ellipses', label: 'Aria' },
  { route: 'tasks', icon: 'checkmark-circle', label: 'Tasks' },
  { route: 'entertainment', icon: 'film', label: 'Movies' },
  { route: 'travel', icon: 'map', label: 'Travel' },
];

function CustomTabBar({ state, navigation }: any) {
  return (
    <View style={styles.container} pointerEvents="box-none">
      <BlurView intensity={30} tint="dark" style={styles.blurContainer}>
        <View style={styles.tabBarInner}>
          {state.routes.map((route: any, index: number) => {
            const tab = TABS.find(t => t.route === route.name);
            const isFocused = state.index === index;
            const iconName = (isFocused ? tab?.icon : `${tab?.icon}-outline`) as any;

            return (
              <TouchableOpacity
                key={route.key}
                testID={`tab-${route.name}`}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
                style={styles.tabItem}
                activeOpacity={0.7}
              >
                <Ionicons name={iconName} size={22} color={isFocused ? COLORS.cyan : COLORS.white40} />
                <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                  {tab?.label}
                </Text>
                {isFocused && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 20,
    right: 20,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    shadowColor: COLORS.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  blurContainer: {
    flex: 1,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tabBarInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(12,12,20,0.85)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: 10,
    color: COLORS.white40,
    marginTop: 2,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  tabLabelActive: {
    color: COLORS.cyan,
  },
  activeDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.cyan,
  },
});

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="entertainment" />
      <Tabs.Screen name="travel" />
    </Tabs>
  );
}
