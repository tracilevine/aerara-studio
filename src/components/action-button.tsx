"use client";
import { useState, useTransition } from "react";

/** Button that runs a bound server action, with pending + error feedback. */
export function ActionButton({ action, children, variant = "ghost", confirm, className = "", done }: {
  action: () => Promise<unknown>; children: React.ReactNode; variant?: "primary" | "ghost";
  confirm?: string; className?: string; done?: (r: unknown) => string | null;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={pending} className={`btn btn-${variant} ${className}`}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setMsg(null); setErr(false);
          start(async () => {
            try {
              const r = await action();
              const e = (r as { error?: string } | undefined)?.error;
              if (e) { setErr(true); setMsg(e); } else setMsg(done ? done(r) : null);
            } catch (e) {
              if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
              setErr(true); setMsg(e instanceof Error ? e.message : "Something went wrong");
            }
          });
        }}>
        {pending ? "Working…" : children}
      </button>
      {msg && <span className={`text-xs ${err ? "text-[#9A4B36]" : "text-ink-soft"}`}>{msg}</span>}
    </span>
  );
}
