import { Camera } from 'expo-camera';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WebViewMessageEvent } from 'react-native-webview';
import { WebView } from 'react-native-webview';

/** Must match the string posted from the web app after “Got it” on the AI consent sheet (`app/page.tsx`). */
const NATIVE_AI_CONSENT_MSG = 'goshed-native-ai-consent-accepted';

const DEFAULT_PRODUCTION_WEB_APP_URL = 'https://goshed.app';

function productionWebAppUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim();
  const raw = fromEnv || DEFAULT_PRODUCTION_WEB_APP_URL;
  return raw.replace(/\/+$/, '');
}

export default function App() {
  const candidateUrls = useMemo(() => {
    if (__DEV__) {
      const baseHost = Platform.OS === 'ios' ? '127.0.0.1' : '10.0.2.2';
      return [3000, 3001, 3002, 3003, 3004, 3005].map((port) => `http://${baseHost}:${port}`);
    }
    return [productionWebAppUrl()];
  }, []);

  const [urlIndex, setUrlIndex] = useState(0);
  const appUrl = candidateUrls[urlIndex]!;

  const tryNextUrl = () => {
    setUrlIndex((prev) => (prev < candidateUrls.length - 1 ? prev + 1 : prev));
  };

  const onWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    if (event.nativeEvent.data !== NATIVE_AI_CONSENT_MSG) return;
    void (async () => {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Camera.requestCameraPermissionsAsync();
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <WebView
        source={{ uri: appUrl }}
        originWhitelist={['*']}
        startInLoadingState
        onMessage={onWebViewMessage}
        onHttpError={tryNextUrl}
        onError={tryNextUrl}
        renderError={() => (
          <View style={styles.errorWrap}>
            <Text style={styles.title}>GoShed Web App Not Reachable</Text>
            {__DEV__ ? (
              <Text style={styles.body}>
                Start your web app with `npm run dev` in the goshed project root.
              </Text>
            ) : (
              <Text style={styles.body}>
                Check your connection and try again. If the problem continues, visit goshed.app in Safari.
              </Text>
            )}
            <Pressable style={styles.badge}>
              <Text style={styles.badgeText}>{appUrl}</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  errorWrap: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827',
  },
  body: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#374151',
  },
  badge: {
    marginTop: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 12,
    color: '#475569',
  },
});
