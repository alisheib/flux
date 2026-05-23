"use client";

import React, { createContext, useContext } from "react";

export interface AuthUser {
  userId: string;
  orgId: string;
  email: string;
  name: string;
  role: string;
  orgName?: string;
  emailVerified?: boolean;
}

// Server-resolved org-level settings that every authenticated page reads.
// Lives on the auth context so pages don't each need to fetch /api/settings
// just to know what currency symbol to render — that fetch produced a
// brief "$" flicker before the real value arrived, and it duplicated 10×
// across pages on every navigation.
export interface OrgContext {
  currency: string;
  taxLabel: string;
  exchangeRate: number;
}

interface AuthContextType {
  user: AuthUser;
  org: OrgContext;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  user,
  org,
  children,
}: {
  user: AuthUser;
  org: OrgContext;
  children: React.ReactNode;
}) {
  return (
    <AuthContext.Provider value={{ user, org }}>
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

// Convenience hook — keeps pages from spelling out useAuth().org.currency
// every time, and makes the dependency on org currency obvious at the
// callsite.
export function useOrgCurrency(): string {
  return useAuth().org.currency;
}
