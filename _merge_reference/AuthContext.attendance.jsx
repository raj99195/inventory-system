import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { watchAuth, logout as doLogout, login as doLogin } from '../services/auth.service.js';
import { getUserByUid } from '../services/users.service.js';
import { permissionsForRole, ROLE_PRESETS } from '../constants/permissions.js';
import { useNativePermissions } from '../hooks/useNativePermissions.js';

const AuthContext = createContext(null);

/**
 * Role preset is the source of truth for known roles.
 * Stored permissions in Firestore are IGNORED for preset roles.
 * Only role='custom' respects stored permissions.
 */
const hydrateProfile = (p) => {
  if (!p) return p;

  if (p.role && p.role !== 'custom' && ROLE_PRESETS[p.role]) {
    return { ...p, permissions: permissionsForRole(p.role) };
  }

  if (!Array.isArray(p.permissions) || p.permissions.length === 0) {
    return { ...p, permissions: permissionsForRole('employee') };
  }

  return p;
};

export function AuthProvider({ children }) {
  const [fbUser, setFbUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useNativePermissions();

  useEffect(() => {
    const unsub = watchAuth(async (u) => {
      setFbUser(u);
      if (u) {
        const p = await getUserByUid(u.uid);
        setProfile(hydrateProfile(p));
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = useCallback(async (email, password) => {
    const { fbUser: f, profile: p } = await doLogin(email, password);
    setFbUser(f);
    setProfile(hydrateProfile(p));
    return p;
  }, []);

  const logout = useCallback(async () => {
    await doLogout();
    setFbUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (fbUser) {
      const p = await getUserByUid(fbUser.uid);
      setProfile(hydrateProfile(p));
    }
  }, [fbUser]);

  return (
    <AuthContext.Provider value={{ fbUser, profile, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}