import { createContext, useContext } from "react";
import { Session, User } from "@supabase/supabase-js";
import { UserProfile } from "./types";

export interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  setActiveRole: (role: string) => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
}

export const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signOut: async () => {},
  setActiveRole: async () => {},
  refreshProfile: async () => null,
});

export const useAuth = () => useContext(AuthContext);
