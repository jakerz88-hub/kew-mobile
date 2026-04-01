/**
 * YouTubePlayer component.
 *
 * Replaces react-native-youtube-iframe with a pure WebView approach.
 * Works in Expo Go without any native module requirements.
 *
 * Supports:
 * - Playback state callbacks (playing, paused, ended)
 * - Current time polling via postMessage
 * - Minimal YouTube branding
 */

import React, { useRef, forwardRef, useImperativeHandle } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

interface YouTubePlayerProps {
  videoId: string;
  height?: number;
  play?: boolean;
  onChangeState?: (state: string) => void;
  onCurrentTime?: (time: number) => void;
}

export interface YouTubePlayerRef {
  getCurrentTime: () => Promise<number>;
}

const YouTubePlayer = forwardRef<YouTubePlayerRef, YouTubePlayerProps>(
  ({ videoId, height = 210, play = false, onChangeState, onCurrentTime }, ref) => {
    const webViewRef = useRef<WebView>(null);
    const currentTimeResolvers = useRef<((t: number) => void)[]>([]);

    useImperativeHandle(ref, () => ({
      getCurrentTime: () =>
        new Promise<number>((resolve) => {
          currentTimeResolvers.current.push(resolve);
          webViewRef.current?.injectJavaScript(
            `window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'currentTime', value: player.getCurrentTime() }));`
          );
        }),
    }));

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1A1714; overflow: hidden; }
    #player { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <div id="player"></div>
  <script>
    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    var player;
    function onYouTubeIframeAPIReady() {
      player = new YT.Player('player', {
        videoId: '${videoId}',
        playerVars: {
          autoplay: ${play ? 1 : 0},
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onStateChange: function(e) {
            var states = { '-1': 'unstarted', '0': 'ended', '1': 'playing', '2': 'paused', '3': 'buffering', '5': 'cued' };
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'stateChange', value: states[e.data] || 'unknown' }));
          }
        }
      });
    }
  </script>
</body>
</html>`;

    const onMessage = (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "stateChange") {
          onChangeState?.(data.value);
        } else if (data.type === "currentTime") {
          const resolver = currentTimeResolvers.current.shift();
          if (resolver) resolver(data.value);
          onCurrentTime?.(data.value);
        }
      } catch {}
    };

    return (
      <View style={{ height }}>
        <WebView
          ref={webViewRef}
          source={{ html }}
          style={styles.webview}
          onMessage={onMessage}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
        />
      </View>
    );
  }
);

export default YouTubePlayer;

const styles = StyleSheet.create({
  webview: { flex: 1, backgroundColor: "#1A1714" },
});
