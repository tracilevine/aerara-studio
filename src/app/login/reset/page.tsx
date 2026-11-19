"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Wordmark } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const [mode, setMode] = useState<"request" | "recovery" | "done">("request");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setMessage("");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setMessage("");
    try {
      const { auth } = createClient();
      if (mode === "request") {
        const { error } = await auth.resetPasswordForEmail(String(form.get("email")), {
          redirectTo: window.location.origin + "/login/reset",
        });
        setMessage(error ? "Couldn’t request a reset link. Please try again shortly." :
          "If this account can receive a reset link, check your email and open the link in this browser.");
        return;
      }
      const password = String(form.get("password"));
      if (password !== form.get("confirmation")) {
        setMessage("The passwords must match.");
        return;
      }
      const { error } = await auth.updateUser({ password });
      if (error) {
        setMessage(error.message);
        return;
      }
      await auth.signOut();
      setMode("done");
      setMessage("Your password was updated. Sign in with your new password.");
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="brand-gradient flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center"><Wordmark size="lg" /></div>
        <form onSubmit={submit} className="card space-y-4 p-8">
          <h1 className="font-serif text-2xl">{mode === "recovery" ? "Choose a new password" : "Reset password"}</h1>
          {mode === "request" && (
            <label className="block">Email
              <input name="email" type="email" required className="input" autoComplete="email" />
            </label>
          )}
          {mode === "recovery" && (
            <>
              <label className="block">New password
                <input name="password" type="password" required minLength={6} className="input" autoComplete="new-password" />
              </label>
              <label className="block">Confirm new password
                <input name="confirmation" type="password" required minLength={6} className="input" autoComplete="new-password" />
              </label>
            </>
          )}
          {message && <p role="status" className="text-sm">{message}</p>}
          {mode !== "done" && (
            <button type="submit" className="btn btn-primary w-full justify-center" disabled={pending}>
              {pending ? "Please wait…" : mode === "recovery" ? "Update password" : "Send reset link"}
            </button>
          )}
          <Link href="/login" className="block text-center text-sm underline">Back to sign in</Link>
        </form>
      </div>
    </main>
  );
}
