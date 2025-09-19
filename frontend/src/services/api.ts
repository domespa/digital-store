import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

// ========================
//      SETUP AXIOS
// ========================
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// VEDIAMO SE L'UTENTE è AUTENTICATO
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ========================
//        FUNZIONI
// ========================
// LOGIN, REGISTRAZIONE, LOGOUT E GETPROFILE
export const auth = {
  login: async (email: string, password: string) => {
    const response = await api.post("/auth/login", { email, password });
    return response.data;
  },

  register: async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => {
    const response = await api.post("/auth/register", {
      email,
      password,
      firstName,
      lastName,
    });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },

  logout: () => {
    localStorage.removeItem("token");
  },
};

// PRODOTTI
export const products = {
  getAll: async () => {
    const response = await api.get("/products");
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },
};

// ORDINI
export const orders = {
  create: async (productId: string, customerEmail: string) => {
    const response = await api.post("/orders", {
      customerEmail,
      items: [{ productId, quantity: 1 }],
    });
    return response.data;
  },

  getUserOrders: async () => {
    const response = await api.get("/orders");
    return response.data;
  },
};
