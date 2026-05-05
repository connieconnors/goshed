import { Camera } from 'expo-camera';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { WebView as WebViewType, WebViewMessageEvent } from 'react-native-webview';
import { WebView } from 'react-native-webview';
import Purchases, { type PurchasesPackage, type PurchasesOfferings } from 'react-native-purchases';

/** Must match the string posted from the web app after “Got it” on the AI consent sheet (`app/page.tsx`). */
const NATIVE_AI_CONSENT_MSG = 'goshed-native-ai-consent-accepted';

const DEFAULT_PRODUCTION_WEB_APP_URL = 'https://www.goshed.app';
const WEBVIEW_LOAD_TIMEOUT_MS = 20000;
const REVENUECAT_IOS_API_KEY_SOURCE = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim()
  ? 'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'
  : process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim()
    ? 'EXPO_PUBLIC_REVENUECAT_API_KEY'
    : null;
const REVENUECAT_IOS_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ||
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim() ||
  '';

type NativeBridgeRequest = {
  type?: string;
  id?: string;
  action?: 'getOfferings' | 'purchase' | 'restore';
  payload?: {
    appUserID?: string;
    plan?: 'monthly' | 'annual';
    packageIdentifier?: string;
  };
};

type NativeBridgeResponse = {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  userCancelled?: boolean;
};

const REVENUECAT_BRIDGE_TYPE = 'goshed-revenuecat';
const REVENUECAT_RESPONSE_EVENT = 'goshed-revenuecat-response';
const nativePlatformInjection = `
  window.__GOSHED_NATIVE_PLATFORM = ${JSON.stringify(Platform.OS)};
  true;
`;

function logRevenueCatDebug(message: string, details?: Record<string, unknown>) {
  if (!__DEV__) return;
  console.log(`[RevenueCatBridge] ${message}`, details ?? '');
}

function productionWebAppUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim();
  const raw = fromEnv || DEFAULT_PRODUCTION_WEB_APP_URL;
  return raw.replace(/\/+$/, '');
}

export default function App() {
  const webViewRef = useRef<WebViewType>(null);
  const configuredUserIdRef = useRef<string | null>(null);
  const candidateUrls = useMemo(() => {
    if (__DEV__) {
      const fromEnv = process.env.EXPO_PUBLIC_WEB_APP_URL?.trim().replace(/\/+$/, '');
      const baseHost = Platform.OS === 'ios' ? '127.0.0.1' : '10.0.2.2';
      const localUrls = [3000, 3001, 3002, 3003, 3004, 3005].map((port) => `http://${baseHost}:${port}`);
      return fromEnv ? [fromEnv, ...localUrls.filter((url) => url !== fromEnv)] : localUrls;
    }
    return [productionWebAppUrl()];
  }, []);

  const [urlIndex, setUrlIndex] = useState(0);
  const [webViewKey, setWebViewKey] = useState(0);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const appUrl = candidateUrls[urlIndex]!;

  const tryNextUrl = () => {
    setUrlIndex((prev) => (prev < candidateUrls.length - 1 ? prev + 1 : prev));
  };

  const retryCurrentUrl = useCallback(() => {
    setLoadTimedOut(false);
    setWebViewLoading(true);
    setWebViewKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!webViewLoading) return;
    setLoadTimedOut(false);
    const timeoutId = setTimeout(() => setLoadTimedOut(true), WEBVIEW_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, [appUrl, webViewKey, webViewLoading]);

  const shouldStartLoad = useCallback((request: { url: string }) => {
    const url = request.url;
    if (url.startsWith('mailto:') || url.startsWith('tel:')) {
      void Linking.openURL(url).catch(() => undefined);
      return false;
    }
    if (url.startsWith('https://www.google.com/maps/') || url.startsWith('https://maps.google.com/')) {
      void Linking.openURL(url).catch(() => undefined);
      return false;
    }
    return true;
  }, []);

  const sendRevenueCatResponse = useCallback((response: NativeBridgeResponse) => {
    const serialized = JSON.stringify(response).replace(/</g, '\\u003c');
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new CustomEvent(${JSON.stringify(REVENUECAT_RESPONSE_EVENT)}, { detail: ${serialized} })); true;`
    );
  }, []);

  const ensureRevenueCatConfigured = useCallback(async (appUserID: string) => {
    logRevenueCatDebug('configure requested', {
      platform: Platform.OS,
      hasIosApiKey: !!REVENUECAT_IOS_API_KEY,
      keySource: REVENUECAT_IOS_API_KEY_SOURCE,
      keyPrefix: REVENUECAT_IOS_API_KEY ? REVENUECAT_IOS_API_KEY.slice(0, 5) : null,
      appUserID,
    });

    if (Platform.OS !== 'ios') {
      throw new Error('Native Apple subscriptions are only available on iOS.');
    }
    if (!REVENUECAT_IOS_API_KEY) {
      throw new Error('RevenueCat iOS API key is missing.');
    }

    const configured = await Purchases.isConfigured().catch(() => false);
    logRevenueCatDebug('isConfigured result', { configured, appUserID });
    if (!configured) {
      if (__DEV__) {
        void Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      }
      Purchases.configure({
        apiKey: REVENUECAT_IOS_API_KEY,
        appUserID,
        storeKitVersion: Purchases.STOREKIT_VERSION.DEFAULT,
      });
      configuredUserIdRef.current = appUserID;
      logRevenueCatDebug('Purchases.configure called', { appUserID });
      return;
    }

    const currentUserId = await Purchases.getAppUserID().catch(() => configuredUserIdRef.current);
    logRevenueCatDebug('existing Purchases user', { currentUserId, requestedAppUserID: appUserID });
    if (currentUserId !== appUserID) {
      await Purchases.logIn(appUserID);
      logRevenueCatDebug('Purchases.logIn called', { appUserID });
    }
    configuredUserIdRef.current = appUserID;
  }, []);

  const packagePlan = (pkg: PurchasesPackage): 'monthly' | 'annual' | null => {
    const packageType = String(pkg.packageType).toUpperCase();
    if (packageType === 'MONTHLY') return 'monthly';
    if (packageType === 'ANNUAL') return 'annual';
    if (pkg.identifier === '$rc_monthly') return 'monthly';
    if (pkg.identifier === '$rc_annual') return 'annual';
    return null;
  };

  const serializeOfferings = (offerings: PurchasesOfferings) => {
    const current = offerings.current;
    const packages = current?.availablePackages ?? [];
    return {
      currentOfferingIdentifier: current?.identifier ?? null,
      allOfferingIdentifiers: Object.keys(offerings.all ?? {}),
      currentServerDescription: current?.serverDescription ?? null,
      packages: packages.map((pkg) => ({
        identifier: pkg.identifier,
        packageType: String(pkg.packageType),
        productIdentifier: pkg.product.identifier,
        priceString: pkg.product.priceString ?? null,
        title: pkg.product.title ?? null,
        subscriptionPeriod: pkg.product.subscriptionPeriod ?? null,
        plan: packagePlan(pkg),
      })),
    };
  };

  const summarizeOfferingsForLog = (offerings: PurchasesOfferings) => {
    const current = offerings.current;
    const packages = current?.availablePackages ?? [];
    return {
      currentOfferingIdentifier: current?.identifier ?? null,
      allOfferingIdentifiers: Object.keys(offerings.all ?? {}),
      currentServerDescription: current?.serverDescription ?? null,
      packageCount: packages.length,
      packages: packages.map((pkg) => ({
        identifier: pkg.identifier,
        packageType: String(pkg.packageType),
        productIdentifier: pkg.product.identifier,
        priceString: pkg.product.priceString ?? null,
        subscriptionPeriod: pkg.product.subscriptionPeriod ?? null,
        resolvedPlan: packagePlan(pkg),
      })),
      resolvedMonthlyPackage: packages.find((pkg) => packagePlan(pkg) === 'monthly')?.identifier ?? null,
      resolvedAnnualPackage: packages.find((pkg) => packagePlan(pkg) === 'annual')?.identifier ?? null,
    };
  };

  const resolvePackage = (offerings: PurchasesOfferings, plan?: 'monthly' | 'annual', packageIdentifier?: string) => {
    const packages = offerings.current?.availablePackages ?? [];
    return (
      packages.find((pkg) => packageIdentifier && pkg.identifier === packageIdentifier) ??
      packages.find((pkg) => plan && packagePlan(pkg) === plan) ??
      null
    );
  };

  const handleRevenueCatRequest = useCallback(
    async (request: NativeBridgeRequest) => {
      const id = request.id;
      const action = request.action;
      const appUserID = request.payload?.appUserID?.trim();
      if (!id || !action) return;
      try {
        if (!appUserID) {
          throw new Error('Sign in before using subscriptions.');
        }
        await ensureRevenueCatConfigured(appUserID);

        if (action === 'restore') {
          const customerInfo = await Purchases.restorePurchases();
          sendRevenueCatResponse({ id, ok: true, data: { activeEntitlements: Object.keys(customerInfo.entitlements.active ?? {}) } });
          return;
        }

        logRevenueCatDebug('getOfferings requested', { action, appUserID });
        const offerings = await Purchases.getOfferings();
        logRevenueCatDebug('getOfferings succeeded', summarizeOfferingsForLog(offerings));
        if (action === 'getOfferings') {
          sendRevenueCatResponse({ id, ok: true, data: serializeOfferings(offerings) });
          return;
        }

        const pkg = resolvePackage(offerings, request.payload?.plan, request.payload?.packageIdentifier);
        logRevenueCatDebug('purchase package resolution', {
          requestedPlan: request.payload?.plan,
          requestedPackageIdentifier: request.payload?.packageIdentifier,
          resolvedPackageIdentifier: pkg?.identifier ?? null,
          resolvedProductIdentifier: pkg?.product.identifier ?? null,
        });
        if (!pkg) {
          throw new Error('Subscription plan is not available.');
        }
        const result = await Purchases.purchasePackage(pkg);
        sendRevenueCatResponse({
          id,
          ok: true,
          data: {
            productIdentifier: result.productIdentifier,
            activeEntitlements: Object.keys(result.customerInfo.entitlements.active ?? {}),
          },
        });
      } catch (err) {
        const maybe = err as { message?: string; userCancelled?: boolean; code?: unknown };
        logRevenueCatDebug('request failed', {
          action,
          appUserID,
          message: maybe?.message ?? null,
          code: maybe?.code ?? null,
          userCancelled: maybe?.userCancelled ?? null,
        });
        sendRevenueCatResponse({
          id,
          ok: false,
          error: maybe?.message || 'Native billing failed.',
          userCancelled: maybe?.userCancelled === true || maybe?.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR,
        });
      }
    },
    [ensureRevenueCatConfigured, sendRevenueCatResponse]
  );

  const onWebViewMessage = useCallback((event: WebViewMessageEvent) => {
    let parsed: NativeBridgeRequest | null = null;
    try {
      parsed = JSON.parse(event.nativeEvent.data) as NativeBridgeRequest;
    } catch {
      parsed = null;
    }
    if (parsed?.type === REVENUECAT_BRIDGE_TYPE) {
      void handleRevenueCatRequest(parsed);
      return;
    }

    if (event.nativeEvent.data !== NATIVE_AI_CONSENT_MSG) return;
    void (async () => {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Camera.requestCameraPermissionsAsync();
      }
    })();
  }, [handleRevenueCatRequest]);

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {loadTimedOut ? (
        <View style={styles.errorWrap}>
          <Text style={styles.title}>GoShed is taking too long to load</Text>
          <Text style={styles.body}>
            Check your connection and try again. If the problem continues, visit goshed.app in Safari.
          </Text>
          <Pressable style={styles.primaryButton} onPress={retryCurrentUrl}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
          <Pressable style={styles.badge}>
            <Text style={styles.badgeText}>{appUrl}</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          key={`${appUrl}-${webViewKey}`}
          ref={webViewRef}
          source={{ uri: appUrl }}
          originWhitelist={['*']}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          injectedJavaScriptBeforeContentLoaded={nativePlatformInjection}
          startInLoadingState
          onLoadStart={() => {
            setWebViewLoading(true);
            setLoadTimedOut(false);
          }}
          onLoadEnd={() => {
            setWebViewLoading(false);
            setLoadTimedOut(false);
          }}
          onMessage={onWebViewMessage}
          onShouldStartLoadWithRequest={shouldStartLoad}
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
              <Pressable style={styles.primaryButton} onPress={retryCurrentUrl}>
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
              <Pressable style={styles.badge}>
                <Text style={styles.badgeText}>{appUrl}</Text>
              </Pressable>
            </View>
          )}
        />
      )}
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
  primaryButton: {
    marginTop: 18,
    borderRadius: 999,
    backgroundColor: '#59483c',
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
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
