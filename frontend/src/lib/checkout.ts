import type { CheckoutRequest, CheckoutResponse } from "../types/checkout";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

const getAuthToken = (): string | null => {
  return localStorage.getItem("token");
};

export const createCheckoutOrder = async (
  checkoutData: CheckoutRequest
): Promise<CheckoutResponse> => {
  const token = getAuthToken;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify(checkoutData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => {});
    throw new Error(errorData.message || `${response.status}`);
  }

  return response.json();
};
