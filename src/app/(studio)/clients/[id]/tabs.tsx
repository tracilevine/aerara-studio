"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["", "Overview"], ["intake", "Intake"], ["assessment", "Assessment"], ["blueprint", "Soul & System Blueprint"],
  ["foundations", "Business Foundations"], ["systems", "Systems & Tools"], ["recommendations", "Recommendations"],
  ["todos", "To-dos"], ["roadmap", "Roadmap"], ["documents", "Documents"], ["activity", "Activity & Notes"],
];

export function Tabs({ id }: { id: string }) {
  const path = usePathname();
  const base = `/clients/${id}`;
  return (
    <nav className="flex gap-5 overflow-x-auto border-b border-line text-sm">
      {TABS.map(([seg, label]) => {
        const href = seg ? `${base}/${seg}` : base;
        const active = seg ? path.startsWith(href) : path === base;
        return (
          <Link key={seg} href={href} className={`-mb-px shrink-0 border-b-2 pb-3 transition ${active ? "border-clay font-medium text-plum" : "border-transparent text-ink-soft hover:text-plum"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
