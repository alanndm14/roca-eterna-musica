import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider, isDemoModeAllowed, isFirebaseConfigured } from "../lib/firebase";
import { isInitialAdminEmail } from "../config/authorizedEmails";

const AuthContext = createContext(null);

const demoProfile = {
  uid: "demo-admin",
  email: "admin@rocaeterna.local",
  displayName: "Admin Demo",
  preferredDisplayName: "Admin Demo",
  role: "admin",
  active: true,
  themeMode: localStorage.getItem("roca-eterna-theme-mode") || "light",
  accentColor: localStorage.getItem("roca-eterna-accent-color") || "#b6945f",
  sidebarCollapsed: localStorage.getItem("roca-eterna-sidebar-collapsed") === "true",
  onboardingCompleted: localStorage.getItem("roca-eterna-onboarding-demo-admin") === "true"
};

const getDisplayName = (profile) => profile?.preferredDisplayName || profile?.displayName || profile?.email || "";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setError("");
      setUnauthorized(false);

      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);
      const uid = firebaseUser.uid;
      const email = firebaseUser.email?.toLowerCase();
      const userRef = doc(db, "users", uid);
      const authorizedEmailRef = doc(db, "authorizedEmails", email);
      const legacyAllowedEmailRef = doc(db, "allowedEmails", email);

      try {
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data();
          await updateDoc(userRef, { lastLogin: serverTimestamp() });
          if (data.active && data.email?.toLowerCase() === email) {
            setProfile({ uid, id: snap.id, ...data });
            setUnauthorized(false);
          } else {
            setProfile(null);
            setUnauthorized(true);
          }
        } else if (isInitialAdminEmail(email)) {
          const adminProfile = {
            uid,
            email,
            displayName: firebaseUser.displayName || email,
            role: "admin",
            active: true,
            themeMode: "system",
            accentColor: "#b6945f",
            sidebarCollapsed: false,
            onboardingCompleted: false,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp()
          };
          await setDoc(userRef, adminProfile);
          setProfile({ id: uid, ...adminProfile, createdAt: new Date(), lastLogin: new Date() });
          setUnauthorized(false);
        } else {
          const authorizedSnap = await getDoc(authorizedEmailRef);
          const legacyAllowedSnap = authorizedSnap.exists() ? authorizedSnap : await getDoc(legacyAllowedEmailRef);

          if (legacyAllowedSnap.exists() && legacyAllowedSnap.data().active) {
            const allowed = legacyAllowedSnap.data();
            const allowedProfile = {
              uid,
              email,
              displayName: firebaseUser.displayName || allowed.displayName || email,
              role: allowed.role || "viewer",
              active: true,
              themeMode: "system",
              accentColor: "#b6945f",
              sidebarCollapsed: false,
              onboardingCompleted: false,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp()
            };
            await setDoc(userRef, allowedProfile);
            setProfile({ id: uid, ...allowedProfile, createdAt: new Date(), lastLogin: new Date() });
            setUnauthorized(false);
          } else {
            setProfile(null);
            setUnauthorized(true);
          }
        }
      } catch (authError) {
        setError("No se pudo validar el acceso. Revisa las reglas de Firestore y la lista inicial de admins.");
        setProfile(null);
        setUnauthorized(true);
        console.error(authError);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const signInWithGoogle = async () => {
    setError("");
    if (!isFirebaseConfigured) {
      setError(
        import.meta.env.PROD
          ? "La app fue publicada sin configuración de Firebase. Revisa GitHub Actions Secrets."
          : "Configura Firebase para usar Google Sign-In."
      );
      return;
    }
    await signInWithPopup(auth, googleProvider);
  };

  const enterDemoMode = () => {
    if (!isDemoModeAllowed) {
      setError("El modo demo local está deshabilitado en producción.");
      return;
    }
    setUser(demoProfile);
    setProfile(demoProfile);
    setUnauthorized(false);
    setError("");
  };

  const signOut = async () => {
    sessionStorage.removeItem("roca-eterna-welcome-shown");
    if (isFirebaseConfigured && auth.currentUser) {
      await firebaseSignOut(auth);
    }
    setUser(null);
    setProfile(null);
    setUnauthorized(false);
  };

  const completeOnboarding = async () => {
    if (!profile?.uid) return;
    localStorage.setItem(`roca-eterna-onboarding-${profile.uid}`, "true");
    setProfile((current) => (current ? { ...current, onboardingCompleted: true } : current));
    if (isFirebaseConfigured && db && profile.uid !== "demo-admin") {
      try {
        await updateDoc(doc(db, "users", profile.uid), {
          onboardingCompleted: true,
          onboardingCompletedAt: new Date().toISOString()
        });
      } catch (onboardingError) {
        console.warn("No se pudo guardar la guía en Firestore. Se usará respaldo local.", onboardingError);
      }
    }
  };

  const saveUserPreferences = async (updates = {}) => {
    if (!profile?.uid) return;
    const allowedFields = [
      "preferredDisplayName",
      "themeMode",
      "accentColor",
      "blueGrayColor",
      "sidebarCollapsed",
      "onboardingCompleted"
    ];
    const payload = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedFields.includes(key))
    );
    if (!Object.keys(payload).length) return;

    if (payload.themeMode) localStorage.setItem("roca-eterna-theme-mode", payload.themeMode);
    if (payload.accentColor) localStorage.setItem("roca-eterna-accent-color", payload.accentColor);
    if (typeof payload.sidebarCollapsed === "boolean") {
      localStorage.setItem("roca-eterna-sidebar-collapsed", String(payload.sidebarCollapsed));
    }
    if (payload.onboardingCompleted) {
      localStorage.setItem(`roca-eterna-onboarding-${profile.uid}`, "true");
    }

    setProfile((current) => (current ? { ...current, ...payload } : current));

    if (isFirebaseConfigured && db && profile.uid !== "demo-admin") {
      try {
        await updateDoc(doc(db, "users", profile.uid), {
          ...payload,
          preferencesUpdatedAt: serverTimestamp()
        });
      } catch (preferencesError) {
        console.warn("No se pudieron guardar las preferencias personales en Firestore.", preferencesError);
      }
    }
  };

  const permissions = useMemo(
    () => ({
      isAdmin: profile?.role === "admin",
      canEdit: profile?.role === "admin" || profile?.role === "editor",
      canDelete: profile?.role === "admin"
    }),
    [profile?.role]
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      unauthorized,
      error,
      isFirebaseConfigured,
      isDemoMode: user?.uid === "demo-admin",
      ...permissions,
      displayName: getDisplayName(profile),
      signInWithGoogle,
      enterDemoMode,
      signOut,
      completeOnboarding,
      saveUserPreferences
    }),
    [user, profile, loading, unauthorized, error, permissions]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
};
