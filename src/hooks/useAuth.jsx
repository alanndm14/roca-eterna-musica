import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, googleProvider, isFirebaseConfigured } from "../lib/firebase";
import { isInitialAdminEmail } from "../config/authorizedEmails";

const AuthContext = createContext(null);

const demoProfile = {
  uid: "demo-admin",
  email: "admin@rocaeterna.local",
  displayName: "Admin Demo",
  role: "admin",
  active: true
};

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
      setError("Configura Firebase para usar Google Sign-In.");
      return;
    }
    await signInWithPopup(auth, googleProvider);
  };

  const enterDemoMode = () => {
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
      signInWithGoogle,
      enterDemoMode,
      signOut,
      completeOnboarding
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
