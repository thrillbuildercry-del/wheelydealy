import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Role, UserDoc } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: UserDoc | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  role: Role | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const snap = await getDoc(doc(db, 'users', nextUser.uid));
        setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as UserDoc) : null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      role: profile?.role ?? null,
      login: async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      logout: async () => {
        await signOut(auth);
      }
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
