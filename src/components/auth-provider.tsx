"use client";

import React, { createContext, useContext } from "react";

export interface AuthUser {
  userId: string;
  orgId: string;
  email: string;
  name: string;
  role: string;
  orgName?: string;
}

interface AuthContextType {
  user: AuthUser;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
