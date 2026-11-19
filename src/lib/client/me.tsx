"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Plan } from "@/config/plans";
import { api } from "./api";

export interface Me {
  id: string;
  email: string | null;
  displayName: string;
  handle: string;
  planId: string;
  plan: Plan;
  balance: number;
  wallets: { id: string; chain: "solana" | "evm"; address: string; linkedAt: string }[];
  hasPassword: boolean;
}

export interface Providers {
  mode: "development" | "production";
  story: { id: string | null; label: string; ai: boolean };
  voice: { id: string; label: string };
  render: { id: string; label: string };
  payments: { card: boolean; crypto: boolean; configured: boolean };
}

interface MeState {
  me: Me | null;
  providers: Providers | null;
  voices: { id: string; label: string; accent: string }[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<MeState>({ me: null, providers: null, voices: [], loading: true, refresh: async () => {} });

export function MeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<MeState, "refresh">>({ me: null, providers: null, voices: [], loading: true });
  const refresh = useCallback(async () => {
    try {
      const d = await api<{ user: Me | null; providers: Providers; voices: MeState["voices"] }>("/api/me");
      setState({ me: d.user, providers: d.providers, voices: d.voices, loading: false });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <Ctx value={{ ...state, refresh }}>{children}</Ctx>;
}

export const useMe = () => useContext(Ctx);
