import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Tabs, useRouter, useSegments } from "expo-router";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_300Light,
} from "@expo-google-fonts/dm-sans";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../src/services/supabase";
import { api } from "../src/services/api";
import { useStore } from "../src/store";
import { Colors } from "../src/types/theme";
import { SansText } from "../src/components/UI";

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const router   = useRouter();
  const segments = useSegments();
  const { fetchUser, fetchQueue } = useStore();

  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_300Light,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, sess) => {
      setSession(sess);

      if (event === "SIGNED_IN" && sess) {
        try {
          const providerToken = sess.provider_token;
          const providerRefreshToken = sess.provider_refresh_token;
          const expiresAt = sess.expires_at;

          if (providerToken) {
            await api.saveYouTubeToken({
              access_token: providerToken,
              refresh_token: providerRefreshToken ?? undefined,
              expires_at: expiresAt,
            });
          }

          api.syncSubscriptions().catch(console.warn);
        } catch (e) {
          console.warn("Post-signin setup error:", e);
        }
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
      fetchUser();
      fetchQueue();
    }
  }, [session, segments]);

  if (!fontsLoaded || session === undefined) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.cream }}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.cardBg,
          borderTopColor: Colors.divider,
          borderTopWidth: 1,
          height: 64,
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
      <Tabs.Screen
        name="(tabs)/index"
        options={{ title: "Queue", tabBarIcon: () => <SansText>Q</SansText> }}
      />
      <Tabs.Screen
        name="(tabs)/browse"
        options={{ title: "Browse", tabBarIcon: () => <SansText>+</SansText> }}
      />
      <Tabs.Screen
        name="(tabs)/history"
        options={{ title: "History", tabBarIcon: () => <SansText>H</SansText> }}
      />
      <Tabs.Screen name="player"          options={{ href: null }} />
      <Tabs.Screen name="completion"      options={{ href: null }} />
      <Tabs.Screen name="(auth)/login"    options={{ href: null }} />
    </Tabs>
  );
}