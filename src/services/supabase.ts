import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// Final fallback: a clean prod OTA shipped 2026-05-06 stalled forever on the splash because
// Constants.expoConfig.extra returned null, leaving the client with undefined URL/key and
// hanging getSession(). Hardcoding prod values prevents the broken-client failure mode.
const PROD_SUPABASE_URL = "https://piedqhsglgpzcdrvvihk.supabase.co";
const PROD_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZWRxaHNnbGdwemNkcnZ2aWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTcyMzAsImV4cCI6MjA5MDAzMzIzMH0.D1kWc41oNiDV-aM1cAwnDDDnzSwfQwxWB0nZDqrIjPw";

const SUPABASE_URL      = (process.env.EXPO_PUBLIC_SUPABASE_URL      || Constants.expoConfig?.extra?.SUPABASE_URL      || PROD_SUPABASE_URL) as string;
const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.SUPABASE_ANON_KEY || PROD_SUPABASE_ANON_KEY) as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
