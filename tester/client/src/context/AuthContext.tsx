import { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../api/client';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  frameworks?: Array<{
    id: string;
    name: string;
    type: string;
    bunker_count: number;
  }>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  register: (username: string, password: string, email: string) => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
      // Set default header for API requests
      api.setAuthToken(storedToken);
      // Fetch current user info
      api.getCurrentUser()
        .then(setUser)
        .catch(() => {
          // Token invalid, clear it
          localStorage.removeItem('authToken');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const response = await api.login(username, password);
    setUser(response.user);
    setToken(response.token);
    localStorage.setItem('authToken', response.token);
    api.setAuthToken(response.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    api.setAuthToken(null);
  };

  const register = async (username: string, password: string, email: string) => {
    await api.register(username, password, email);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        register,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
