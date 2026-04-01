/**
 * YouTubePlayer component.
 *
 * Loads the YouTube embed URL directly (no IFrame JS API) with a Safari
 * user agent so YouTube treats the WebView as a real mobile browser.
 *
 * getCurrentTime returns elapsed wall-clock seconds since the player mounted,
 * which is used for progress reporting in PlayerScreen.
 */

import React, { useRef, forwardRef, useImperativeHandle } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

const SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

interface YouTubePlayerProps {
  videoId: string;
  height?: number;
}

export interface YouTubePlayerRef {
  getCurrentTime: () => Promise<number>;
}

const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(
  ({ videoId, height = 210 }, ref) => {
    const mountedAt = useRef(Date.now());

    useImperativeHandle(ref, () => ({
      getCurrentTime: () =>
        Promise.resolve(Math.floor((Date.now() - mountedAt.current) / 1000)),
    }));

    const uri = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&rel=0&playsinline=1&modestbranding=1`;

    return (
      <View style={{ height }}>
        <WebView
          source={{ uri }}
          style={styles.webview}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          originWhitelist={["*"]}
          userAgent={SAFARI_UA}
        />
      </View>
    );
  }
);

export default YouTubePlayer;

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: "#1A1714" },
});
