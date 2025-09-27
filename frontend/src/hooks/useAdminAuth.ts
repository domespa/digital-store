import { useState, useEffect } from "react";
import { adminAuth } from "../services/adminApi";

export const useAdminAuth = () => {
  const [isAuthenticated, setIsAutentichated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem("adminToken");

      if (!token) {
        setIsAutentichated(false);
        return;
      }

      const profile = await adminAuth.getProfile();
      if (profile.user?.role === "ADMIN") {
        setIsAutentichated(true);
      } else {
        logout();
      }
    } catch (error) {
      console.error("ADMIN LOGIN FAIL", error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      await adminAuth.login(email, password);
      setIsAutentichated(true);
    } catch (error: any) {
      setError(error.message || "LOGIN FAILED");
      throw error;
    }
  };

  const logout = () => {
    adminAuth.logout();
    setIsAutentichated(false);
  };

  return {
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
  };
};
