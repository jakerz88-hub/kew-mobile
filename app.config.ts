import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Kew",
  slug: "kew",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#F5F0E8",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.kew.app",
    infoPlist: {
      NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#F5F0E8",
    },
    package: "com.kew.app",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
  ],
  scheme: "kew",
  extra: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    API_BASE_URL: process.env.API_BASE_URL,
  },
});