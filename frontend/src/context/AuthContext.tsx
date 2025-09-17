import {
  createContext,
  useContext,
  type ReactNode,
  useState,
  useEffect,
} from "react";
import { auth } from "../lib/api";
import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
  AuthContextType,
} from "../types/auth";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      loadUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadUser = async () => {
    try {
      const response = await auth.getProfile();
      if (response.success && response.user) {
        setUser(response.user);
      } else {
        localStorage.removeItem("token");
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error("CARICAMENTO USER FALLITO", error);
      }
      localStorage.removeItem("token");
    } finally {
      setIsLoading(false);
    }
  };

  const login = async ({ email, password }: LoginRequest) => {
    setIsLoading(true);
    try {
      const response: AuthResponse = await auth.login(email, password);
      if (response.success && response.token && response.user) {
        localStorage.setItem("token", response.token);
        setUser(response.user);
      } else {
        throw new Error(response.message || "LOGIN FALLITO");
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async ({
    email,
    password,
    firstName,
    lastName,
  }: RegisterRequest) => {
    setIsLoading(true);
    try {
      const response: AuthResponse = await auth.register(
        email,
        password,
        firstName,
        lastName
      );
      if (response.success && response.token && response.user) {
        localStorage.setItem("token", response.token);
        setUser(response.user);
      } else {
        throw new Error(response.message || "REGISTRAZIONE FALLITA");
      }
    } catch (error) {
      console.error("LA REGISTRAZIONE NON E' ANDATA A BUON FINE", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    auth.logout();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    register,
    logout,
    isAuthenticated: !!user, // invece di ? true : false, sostituisce l'operatore ternario in questo caso
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("ERRORE CRITICO, METTI CONTEXT DENTRO PROVIDER");
  }
  return context;
};
