import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { jwtDecode } from '@/lib/jwt-decode';
import api, { unwrap } from '@/lib/api';
import type { AuthUser, LoginResponse, SignupResponse, UserRole, StaffCapability } from '@/lib/types';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  staffLogin: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string, orgName: string) => Promise<SignupResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseToken(token: string): AuthUser | null {
  try {
    const payload = jwtDecode<{ sub: string; orgId: string; role: UserRole }>(token);
    // We store user info alongside the token
    const stored = localStorage.getItem('saahvik_user');
    if (stored) {
      const parsed = JSON.parse(stored) as AuthUser;
      return parsed;
    }
    // Fallback: build from token payload only
    return {
      userId: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
      name: '',
      email: '',
      permissions: [],
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('saahvik_token');
    if (token) {
      const parsed = parseToken(token);
      setUser(parsed);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = unwrap<LoginResponse>(
      await api.post('/auth/login', { email, password }),
    );
    localStorage.setItem('saahvik_token', data.accessToken);

    const payload = jwtDecode<{ sub: string; orgId: string; role: UserRole }>(
      data.accessToken,
    );
    const authUser: AuthUser = {
      userId: payload.sub,
      orgId: payload.orgId,
      role: payload.role as UserRole,
      name: '',
      email,
      permissions: [],
    };

    // Fetch user profile to get name + current permissions
    try {
      const profile = unwrap<{
        id: string;
        name: string;
        email: string;
        role: string;
        permissions: StaffCapability[];
      }>(await api.get('/users/me'));
      authUser.name = profile.name;
      authUser.email = profile.email;
      authUser.permissions = profile.permissions ?? [];
    } catch {
      // Profile endpoint may not exist yet; that's fine
      authUser.name = email.split('@')[0] ?? '';
      authUser.email = email;
    }

    localStorage.setItem('saahvik_user', JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const staffLogin = useCallback(async (email: string, password: string) => {
    const data = unwrap<LoginResponse>(
      await api.post('/auth/staff-login', { email, password }),
    );
    localStorage.setItem('saahvik_token', data.accessToken);

    const payload = jwtDecode<{ sub: string; orgId: string; role: UserRole }>(
      data.accessToken,
    );
    const authUser: AuthUser = {
      userId: payload.sub,
      orgId: payload.orgId,
      role: payload.role as UserRole,
      name: email.split('@')[0] ?? '',
      email,
      permissions: [],
    };

    try {
      const profile = unwrap<{
        id: string;
        name: string;
        email: string;
        role: string;
        permissions: StaffCapability[];
      }>(await api.get('/users/me'));
      authUser.name = profile.name;
      authUser.email = profile.email;
      authUser.permissions = profile.permissions ?? [];
    } catch {
      // Fall back to email-derived name; permissions stay [] which means
      // no delegable actions show, but server-side enforcement is what
      // actually matters for security.
    }

    localStorage.setItem('saahvik_user', JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const signup = useCallback(
    async (name: string, email: string, password: string, orgName: string) => {
      const data = unwrap<SignupResponse>(
        await api.post('/auth/signup', { name, email, password, orgName }),
      );
      return data;
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('saahvik_token');
    localStorage.removeItem('saahvik_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        staffLogin,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

/** An owner always has every capability; a staff member only has what's in
 * their `permissions` array. Server-side enforcement (CapabilityGuard) is
 * what actually matters for security — this is UI convenience only, to
 * hide actions a user isn't allowed to take rather than let them hit a 403. */
export function hasCapability(user: AuthUser | null, capability: StaffCapability): boolean {
  if (!user) return false;
  if (user.role === 'owner') return true;
  return user.permissions?.includes(capability) ?? false;
}
