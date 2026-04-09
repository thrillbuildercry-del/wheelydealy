import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { getUserProfile, upsertUserProfile } from '../services/firestoreService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const profile = await getUserProfile(fbUser.uid);
      setUser({
        uid: fbUser.uid,
        email: fbUser.email,
        name: profile?.name || fbUser.displayName || fbUser.email,
        role: profile?.role || 'WORKER',
        active: profile?.active !== false
      });
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const loginWithGoogle = async () => {
    const { user: fbUser } = await signInWithPopup(auth, googleProvider);
    const profile = await upsertUserProfile(fbUser, 'WORKER');
    setUser({ uid: fbUser.uid, email: fbUser.email, name: profile.name, role: profile.role, active: profile.active });
  };

  const loginWithEmail = async ({ email, password }) => {
    const { user: fbUser } = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getUserProfile(fbUser.uid);
    if (!profile?.active) throw new Error('Your account is disabled.');
    setUser({ uid: fbUser.uid, email: fbUser.email, name: profile.name, role: profile.role, active: profile.active });
  };

  const signupWithEmail = async ({ name, email, password }) => {
    const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(fbUser, { displayName: name });
    const profile = await upsertUserProfile({ ...fbUser, displayName: name }, 'WORKER');
    setUser({ uid: fbUser.uid, email: fbUser.email, name: profile.name, role: profile.role, active: profile.active });
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'ADMIN',
      loginWithGoogle,
      loginWithEmail,
      signupWithEmail,
      logout
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
