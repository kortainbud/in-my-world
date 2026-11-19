"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { Button, Field, inputCls, Notice, Spinner } from "@/components/ui";
import { AuthShell } from "./auth-form";

export function ForgotPassword() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/forgot", { method: "POST", json: { email } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="display text-display-sm">{sent ? "check your inbox." : "forgot your password?"}</h1>
      {sent ? (
        <>
          <p className="mt-3 text-body text-fg-2">
            If <strong className="font-medium text-fg">{email}</strong> has an account, we’ve sent it a link to choose a new password. The link expires in 1 hour.
          </p>
          <p className="mt-3 text-small text-fg-2">Nothing there? Check your spam folder, or try again in a minute.</p>
          <Button className="mt-6 w-full" size="lg" onClick={() => setSent(false)}>
            Use a different email
          </Button>
        </>
      ) : (
        <>
          <p className="mt-3 text-body text-fg-2">Enter the email you signed up with and we’ll send you a link to choose a new one.</p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="Email">
              <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required autoFocus />
            </Field>
            {error && <Notice tone="danger">{error}</Notice>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              {busy && <Spinner />} Send reset link
            </Button>
          </form>
        </>
      )}
      <p className="mt-7 border-t border-line pt-5 text-small text-fg-2">
        Remembered it?{" "}
        <Link href="/sign-in" className="text-fg underline decoration-line underline-offset-4">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export function ResetPassword() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("The two passwords don’t match.");
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/reset", { method: "POST", json: { token, password } });
      router.replace("/studio");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="display text-display-sm">choose a new password.</h1>
      {!token ? (
        <>
          <p className="mt-3 text-body text-fg-2">This page needs the link from your reset email.</p>
          <Link href="/forgot-password" className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--pill-bg)] text-body font-medium text-[var(--pill-fg)]">
            Send me a new link
          </Link>
        </>
      ) : (
        <>
          <p className="mt-3 text-body text-fg-2">You’ll be signed in, and signed out everywhere else.</p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="New password" hint="At least 8 characters.">
              <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} autoFocus />
            </Field>
            <Field label="Confirm new password">
              <input className={inputCls} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required minLength={8} />
            </Field>
            {error && (
              <Notice tone="danger">
                {error}{" "}
                {/expired|already used/.test(error) && (
                  <Link href="/forgot-password" className="underline underline-offset-4">
                    Get a new link
                  </Link>
                )}
              </Notice>
            )}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              {busy && <Spinner />} Save and sign in
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
