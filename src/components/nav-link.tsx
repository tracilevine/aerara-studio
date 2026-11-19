"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children, badge }: { href: string; children: React.ReactNode; badge?: number }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link href={href} className={`flex items-center justify-between rounded-lg px-3 py-2 transition ${active ? "bg-paper font-medium shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-soft hover:text-plum"}`}>
      {children}
      {!!badge && <span className="rounded-full bg-clay px-2 text-[11px] font-semibold text-white">{badge}</span>}
    </Link>
  );
}
