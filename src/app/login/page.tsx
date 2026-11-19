"use client";
import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "@/app/actions";
import { Wordmark } from "@/components/ui";

export default function Login() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <main className="brand-gradient flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center"><Wordmark size="lg" /></div>
        <form action={action} className="card space-y-4 p-8">
          <p className="font-serif text-2xl">Welcome back</p>
          <input name="email" type="email" required placeholder="Email" className="input" autoComplete="email" />
          <input name="password" type="password" required placeholder="Password" className="input" autoComplete="current-password" />
          {state?.error && <p className="text-sm text-[#9A4B36]">{state.error}</p>}
          <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
          <Link href="/login/reset" className="block text-center text-sm underline">Forgot password?</Link>
        </form>
        <p className="mt-6 text-center text-xs text-ink-soft">Private advisory workspace</p>
      </div>
    </main>
  );
}
