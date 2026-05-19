import "react-native-url-polyfill/auto";
import React, { useEffect, useRef, useState } from "react";
import { AppState, View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_400Regular_Italic,
  DMSans_500Medium,
} from "@expo-google-fonts/dm-sans";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./src/services/supabase";
import { api } from "./src/services/api";
import { configurePurchases, logoutPurchases } from "./src/services/revenuecat";
import { useStore } from "./src/store";
import { Colors, FontFamily, FontSize } from "./src/types/theme";
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { QueueTabIcon, BrowseTabIcon, ExploreTabIcon, HistoryTabIcon, JournalTabIcon, LogoMark } from "./src/components/TabIcons";
import { KewLogo } from "./src/components/UI";
import { KewPlusSheet } from "./src/components/KewPlusSheet";

// Screens
import LoginScreen from "./src/screens/LoginScreen";
import NUXScreen from "./src/screens/NUXScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import QueueScreen from "./src/screens/QueueScreen";
import BrowseScreen from "./src/screens/BrowseScreen";
import JournalScreen from "./src/screens/JournalScreen";
import PlayerScreen from "./src/screens/PlayerScreen";
import CompletionScreen from "./src/screens/CompletionScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import ChannelScreen from "./src/screens/ChannelScreen";
import RecentUploadsScreen from "./src/screens/RecentUploadsScreen";
import PlaylistListScreen from "./src/screens/PlaylistListScreen";
import PlaylistVideoPickerScreen from "./src/screens/PlaylistVideoPickerScreen";
import ExploreScreen from "./src/screens/ExploreScreen";
import HelpScreen from "./src/screens/HelpScreen";
import AllQueuesScreen from "./src/screens/AllQueuesScreen";
import NewQueueScreen from "./src/screens/NewQueueScreen";
import InsightsScreen from "./src/screens/InsightsScreen";
import BenefitsScreen from "./src/screens/BenefitsScreen";
import AppIconScreen from "./src/screens/AppIconScreen";
import TabletNavigator from "./src/navigation/TabletNavigator";
import { useIsTablet } from "./src/hooks/useIsTablet";

const NUX_KEY         = "kew_nux_done";
const ONBOARDING_KEY  = "kew_onboarding_done";

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

export const navigationRef = createNavigationContainerRef<any>();

function GlobalKewPlusSheet() {
  const { kewPlusUpsell, hideKewPlusUpsell } = useStore();
  return (
    <KewPlusSheet
      visible={!!kewPlusUpsell}
      onClose={hideKewPlusUpsell}
      headline={kewPlusUpsell?.headline ?? ""}
      body={kewPlusUpsell?.body ?? ""}
      onExplore={() => {
        if (navigationRef.isReady()) navigationRef.navigate("Benefits");
      }}
    />
  );
}

function TabNavigator() {
  const { colors } = useTheme();
  // Plan-aware label + icon for the fourth tab slot. Free users see
  // "History" with the clock icon (legacy Watch History). Paid users see
  // "Journal" with the book-open icon (the new Lora-headed journal feed).
  // The screen component is the same JournalScreen either way — its
  // internal gate renders HistoryScreen for free users.
  const user = useStore(s => s.user);
  const isFree = (user?.plan ?? "free") === "free";
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.cardBg,
          borderTopColor: colors.divider,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.warmMid,
        tabBarLabelStyle: {
          fontFamily: FontFamily.sansMedium,
          fontSize: FontSize.xxs,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
      }}
    >
      <Tab.Screen
        name="Queue"
        component={QueueScreen}
        options={{ tabBarIcon: ({ color }) => <QueueTabIcon color={color} /> }}
      />
      <Tab.Screen
        name="Browse"
        component={BrowseScreen}
        options={{ tabBarIcon: ({ color }) => <BrowseTabIcon color={color} /> }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{ tabBarIcon: ({ color }) => <ExploreTabIcon color={color} /> }}
      />
      <Tab.Screen
        name="Journal"
        component={JournalScreen}
        options={{
          tabBarLabel: isFree ? "History" : "Journal",
          tabBarIcon: ({ color }) =>
            isFree
              ? <HistoryTabIcon color={color} />
              : <JournalTabIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

function TabsOrTablet() {
  const isTablet = useIsTablet();
  return isTablet ? <TabletNavigator /> : <TabNavigator />;
}

function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"       component={TabsOrTablet} />
      <Stack.Screen name="Player"     component={PlayerScreen} />
      <Stack.Screen name="Completion" component={CompletionScreen} />
      <Stack.Screen name="Channel"       component={ChannelScreen} />
      <Stack.Screen name="RecentUploads" component={RecentUploadsScreen} />
      <Stack.Screen name="Profile"              component={ProfileScreen} />
      <Stack.Screen name="Help"                 component={HelpScreen} />
      <Stack.Screen name="PlaylistList"         component={PlaylistListScreen} />
      <Stack.Screen name="PlaylistVideoPicker"  component={PlaylistVideoPickerScreen} />
      <Stack.Screen name="AllQueues"            component={AllQueuesScreen} />
      <Stack.Screen name="NewQueue"             component={NewQueueScreen} />
      <Stack.Screen name="Insights"             component={InsightsScreen} />
      <Stack.Screen name="Benefits"             component={BenefitsScreen} />
      <Stack.Screen name="AppIcon"              component={AppIconScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [nuxDone, setNuxDone] = useState<boolean | undefined>(undefined);
  const [onboardingDone, setOnboardingDone] = useState<boolean | undefined>(undefined);
  const { fetchUser, fetchQueue, fetchQueues, user, isLoadingUser } = useStore();

  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_400Regular_Italic,
    DMSans_500Medium,
  });

  // Re-sync subscriptions whenever the app comes back to the foreground
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) api.syncSubscriptions().catch(console.warn);
        });
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const fallback = setTimeout(() => setSession(null), 5000);
    supabase.auth.getSession().then(({ data }) => {
      clearTimeout(fallback);
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);

      if (sess && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        // Fire-and-forget — do NOT await here. Supabase awaits all onAuthStateChange
        // callbacks before resolving setSession(), and fetchUser() calls getSession()
        // which tries to acquire the same internal lock — causing a deadlock.
        fetchUser();
        fetchQueue();
        fetchQueues();
      }

      if (event === "SIGNED_OUT") {
        // Wipe user-scoped store + per-user AsyncStorage so a different account
        // signing in on the same device doesn't inherit the previous user's
        // queue, activeQueueId, or onboarding-skip state.
        useStore.getState().reset();
        AsyncStorage.removeItem(NUX_KEY).catch(() => {});
        AsyncStorage.removeItem(ONBOARDING_KEY).catch(() => {});
        setNuxDone(undefined);
        setOnboardingDone(undefined);
        logoutPurchases();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Configure RevenueCat once the Supabase user is loaded.
  useEffect(() => {
    if (!user?.id) return;
    configurePurchases(user.id);
  }, [user?.id]);

  // Once user is loaded, check whether to skip NUX + onboarding.
  // Existing users (hasYoutube === true) skip both: they've already linked
  // their account and don't need to see the welcome carousel or playlist
  // import flow again.
  useEffect(() => {
    if (!user) return;
    Promise.all([
      AsyncStorage.getItem(NUX_KEY),
      AsyncStorage.getItem(ONBOARDING_KEY),
    ]).then(([nuxVal, onbVal]) => {
      if (user.hasYoutube) {
        // Existing user — mark both done so they go straight to the app
        if (nuxVal !== "true") AsyncStorage.setItem(NUX_KEY, "true");
        if (onbVal !== "true") AsyncStorage.setItem(ONBOARDING_KEY, "true");
        setNuxDone(true);
        setOnboardingDone(true);
      } else {
        setNuxDone(nuxVal === "true");
        setOnboardingDone(onbVal === "true");
      }
    });
  }, [user]);

  const markNuxDone = () => {
    AsyncStorage.setItem(NUX_KEY, "true");
    setNuxDone(true);
  };

  const markOnboardingDone = () => {
    AsyncStorage.setItem(ONBOARDING_KEY, "true");
    setOnboardingDone(true);
  };

  const isLoading =
    (!fontsLoaded && !fontError) ||
    session === undefined ||
    (session !== null && user !== null && (nuxDone === undefined || onboardingDone === undefined));

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.cream, gap: 32 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <LogoMark size={44} />
          <KewLogo size={44} plus={false} />
        </View>
        <ActivityIndicator color={Colors.accent} size="small" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <NavigationContainer ref={navigationRef}>
        {!session ? (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        ) : (user === null && isLoadingUser) ? (
          // fetchUser in-flight — show splash
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.cream, gap: 32 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <LogoMark size={44} />
              <KewLogo size={44} plus={false} />
            </View>
            <ActivityIndicator color={Colors.accent} size="small" />
          </View>
        ) : user === null ? (
          // fetchUser failed (expired token, 403, network error) — send to Login
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        ) : !nuxDone ? (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="NUX">
              {() => <NUXScreen onDone={markNuxDone} />}
            </Stack.Screen>
          </Stack.Navigator>
        ) : !onboardingDone ? (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Onboarding">
              {() => <OnboardingScreen onDone={markOnboardingDone} />}
            </Stack.Screen>
          </Stack.Navigator>
        ) : (
          <AppNavigator />
        )}
        <GlobalKewPlusSheet />
      </NavigationContainer>
    </ThemeProvider>
  );
}
