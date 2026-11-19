import Image from "next/image";
import Link from "next/link";
import React from "react";

const TONES: Record<string, string> = {
  neutral: "bg-[#F4EFEA] text-ink-soft",
  plum: "bg-lavender/60 text-plum",
  clay: "bg-system-card text-clay-dark",
  mauve: "bg-soul-card text-mauve",
  done: "bg-[#EEF1EA] text-[#56684A]",
  alert: "bg-[#F7E6E1] text-[#9A4B36]",
};

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

export const STATUS_TONE: Record<string, keyof typeof TONES> = {
  not_started: "neutral", in_progress: "plum", waiting: "clay", completed: "done",
  proposed: "neutral", approved: "done", declined: "alert", done: "done",
  draft: "clay", awaiting_review: "clay", generating: "plum", failed: "alert",
  new: "plum", onboarding: "clay", active: "done", paused: "neutral", archived: "neutral",
  high: "alert", medium: "clay", low: "neutral",
  needs_review: "clay", sent: "done", discarded: "neutral",
};

export const human = (s?: string | null) => (s ? s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "—");

export function Status({ value }: { value?: string | null }) {
  if (!value) return <Pill>—</Pill>;
  return <Pill tone={STATUS_TONE[value] ?? "neutral"}>{human(value)}</Pill>;
}

export function Section({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-sm text-ink-soft">{children}</p>;
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F1E9E3]">
      <div className="h-full rounded-full bg-clay" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Link href="/" className="block leading-none">
      <Image src="/aerara-mountain-logo.png" width={1673} height={940} alt="AERARA" className={`inline-block h-auto ${size === "lg" ? "w-44" : "w-28"}`} />
      <span className="mt-1 block text-[10px] uppercase tracking-[0.28em] text-mauve">System Advisory Studio</span>
    </Link>
  );
}

export const fmtDate = (d?: string | null, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString("en-US", opts) : "—";
export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : "—";
