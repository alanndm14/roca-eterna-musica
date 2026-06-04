import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const requiredFirebaseConfig = {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId
};

export const isFirebaseConfigured = Object.values(requiredFirebaseConfig).every(Boolean);
export const firebaseMissingConfigKeys = Object.entries(requiredFirebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);
export const isDemoModeAllowed =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_MODE === "true";
export const firebaseVapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";
export const pushServerUrl = import.meta.env.VITE_PUSH_SERVER_URL || "";
export const firebaseAppCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY || "";

export const firebaseApp = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const appCheck = (() => {
  if (!firebaseApp || !firebaseAppCheckSiteKey || typeof window === "undefined") return null;

  if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;
  }

  try {
    return initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(firebaseAppCheckSiteKey),
      isTokenAutoRefreshEnabled: true
    });
  } catch (error) {
    console.warn("[Firebase] App Check no pudo inicializarse.", error?.message || error);
    return null;
  }
})();
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? getFirestore(firebaseApp) : null;
export const storage = firebaseApp && firebaseConfig.storageBucket ? getStorage(firebaseApp) : null;
export const googleProvider = new GoogleAuthProvider();

if (googleProvider) {
  googleProvider.setCustomParameters({ prompt: "select_account" });
}
