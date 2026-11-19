"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { Button, Field, inputCls, Notice, Spinner } from "@/components/ui";
import { SiteLogo } from "./site/chrome";
import { WalletButtons } from "./wallet";

function safeNext(n: string | null) {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/studio";
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(mode === "sign-in" ? "/api/auth/signin" : "/api/auth/signup", { method: "POST", json: mode === "sign-in" ? { email, password } : { email, password, name } });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  const other = mode === "sign-in" ? "/sign-up" : "/sign-in";
  return (
    <div className="theme-light flex min-h-screen flex-col px-4">
      <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center">
        <Link href="/">
          <SiteLogo />
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center pb-20">
        <div className="w-full max-w-[380px]">
          <h1 className="display text-[40px]">{mode === "sign-in" ? "welcome back." : "start your world."}</h1>
          <p className="mt-3 text-[14px] text-fg-2">{mode === "sign-in" ? "Sign in to your studio." : "Free plan includes monthly credits. No card needed."}</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "sign-up" && (
              <Field label="Name">
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={40} />
              </Field>
            )}
            <Field label="Email">
              <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </Field>
            <Field label="Password" hint={mode === "sign-up" ? "At least 8 characters." : undefined}>
              <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required minLength={mode === "sign-up" ? 8 : 1} />
            </Field>
            {error && <Notice tone="danger">{error}</Notice>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              {busy && <Spinner />} {mode === "sign-in" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <div className="my-6 flex items-center gap-3 text-[12px] text-fg-3">
            <span className="h-px flex-1 bg-line-soft" /> or continue with a wallet <span className="h-px flex-1 bg-line-soft" />
          </div>
          <WalletButtons purpose="signin" onDone={() => { router.replace(next); router.refresh(); }} />
          <p className="mt-3 text-[11.5px] leading-relaxed text-fg-3">Optional. Signing proves you own the wallet — it never moves funds, and we never ask for seed phrases or private keys.</p>
          <p className="mt-8 text-[13.5px] text-fg-2">
            {mode === "sign-in" ? "New here? " : "Already have an account? "}
            <Link href={`${other}${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-fg underline decoration-line underline-offset-4">
              {mode === "sign-in" ? "Create an account" : "Sign in"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
