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
import type { AuthUser, LoginResponse, SignupResponse, UserRole } from '@/lib/types';

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
    };

    // Fetch user profile to get name
    try {
      const profile = unwrap<{ id: string; name: string; email: string; role: string }>(
        await api.get('/users/me'),
      );
      authUser.name = profile.name;
      authUser.email = profile.email;
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
    };
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
