import "react-native-url-polyfill/auto";
import React, { useEffect, useRef, useState } from "react";
import { AppState, View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  useFonts,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_400Regular,
} from "@expo-google-fonts/playfair-display";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_300Light,
} from "@expo-google-fonts/dm-sans";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./src/services/supabase";
import { api } from "./src/services/api";
import { useStore } from "./src/store";
import { Colors } from "./src/types/theme";
import { QueueTabIcon, BrowseTabIcon, HistoryTabIcon, LogoMark } from "./src/components/TabIcons";
import { KewLogo } from "./src/components/UI";

// Screens
import LoginScreen from "./src/screens/LoginScreen";
import QueueScreen from "./src/screens/QueueScreen";
import BrowseScreen from "./src/screens/BrowseScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import PlayerScreen from "./src/screens/PlayerScreen";
import CompletionScreen from "./src/screens/CompletionScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import ChannelScreen from "./src/screens/ChannelScreen";
import RecentUploadsScreen from "./src/screens/RecentUploadsScreen";
import PlaylistListScreen from "./src/screens/PlaylistListScreen";
import PlaylistVideoPickerScreen from "./src/screens/PlaylistVideoPickerScreen";

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.cardBg,
          borderTopColor: Colors.divider,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.warmMid,
        tabBarLabelStyle: {
          fontFamily: "DMSans_500Medium",
          fontSize: 10,
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
        name="History"
        component={HistoryScreen}
        options={{ tabBarIcon: ({ color }) => <HistoryTabIcon color={color} /> }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"       component={TabNavigator} />
      <Stack.Screen name="Player"     component={PlayerScreen} />
      <Stack.Screen name="Completion" component={CompletionScreen} />
      <Stack.Screen name="Channel"       component={ChannelScreen} />
      <Stack.Screen name="RecentUploads" component={RecentUploadsScreen} />
      <Stack.Screen name="Profile"              component={ProfileScreen} />
      <Stack.Screen name="PlaylistList"         component={PlaylistListScreen} />
      <Stack.Screen name="PlaylistVideoPicker"  component={PlaylistVideoPickerScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const { fetchUser, fetchQueue } = useStore();

  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_300Light,
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

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, sess) => {
      setSession(sess);

      if (sess && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        // On fresh sign-in, save the YouTube OAuth token and sync subscriptions
        if (event === "SIGNED_IN") {
          try {
            const providerToken        = sess.provider_token;
            const providerRefreshToken = sess.provider_refresh_token;
            const expiresAt            = sess.expires_at;

            if (providerToken) {
              await api.saveYouTubeToken({
                access_token:  providerToken,
                refresh_token: providerRefreshToken ?? undefined,
                expires_at:    expiresAt,
              });
            }

            api.syncSubscriptions().catch(console.warn);
          } catch (e) {
            console.warn("Post-signin setup error:", e);
          }
        }

        // Always load user profile and queue when a valid session is present
        fetchUser();
        fetchQueue();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if ((!fontsLoaded && !fontError) || session === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.cream, gap: 32 }}>
        <View style={{ alignItems: "center", gap: 10 }}>
          <LogoMark size={44} />
          <KewLogo size={44} />
        </View>
        <ActivityIndicator color={Colors.accent} size="small" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <AppNavigator /> : <Stack.Navigator screenOptions={{ headerShown: false }}><Stack.Screen name="Login" component={LoginScreen} /></Stack.Navigator>}
    </NavigationContainer>
  );
}
