import { UserRole } from "../generated/prisma";

// ===========================================
//            REQUEST/RESPONSE TYPES
// ===========================================

// TIPI PER AUTENTIFICAZIONE
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: UserProfile;
  token?: string;
}

// ===========================================
//               USER TYPES
// ===========================================

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: Date;
  emailVerified: boolean; // Aggiunto per compatibilità con il middleware
}

// ===========================================
//               JWT TYPES
// ===========================================

// SETUP JWT
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ===========================================
//            REQUEST EXTENSIONS
// ===========================================

// USER AUTENTICATO
export interface AuthenticatedRequest extends Express.Request {
  user?: UserProfile;
}

// ===========================================
//              ERROR CLASSES
// ===========================================

// ERRORE DI LOGIN CON ERRORE PERSONALIZZATO
export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
