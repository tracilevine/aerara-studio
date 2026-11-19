import { redirect } from "next/navigation";
import { getAdvisor, createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { Wordmark } from "@/components/ui";
import { NavLink } from "@/components/nav-link";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const advisor = await getAdvisor();
  if (!advisor) redirect("/login");
  const supabase = await createClient();
  const [{ count: intakes }, { count: emails }] = await Promise.all([
    supabase.from("intake_submissions").select("id", { count: "exact", head: true }).eq("reviewed", false),
    supabase.from("email_drafts").select("id", { count: "exact", head: true }).in("status", ["needs_review", "approved"]),
  ]);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line px-6 py-8">
        <Wordmark />
        <nav className="mt-12 flex flex-col gap-1 text-[15px]">
          <NavLink href="/">Today</NavLink>
          <NavLink href="/clients">Clients</NavLink>
          <NavLink href="/intakes" badge={intakes ?? 0}>Intakes</NavLink>
          <NavLink href="/emails" badge={emails ?? 0}>Emails</NavLink>
          <NavLink href="/library">Resource Library</NavLink>
        </nav>
        <div className="mt-auto text-sm">
          <p className="text-ink-soft">{advisor.display_name}</p>
          <form action={signOut}><button className="mt-1 text-xs text-mauve hover:underline">Sign out</button></form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-10 py-10">{children}</main>
    </div>
  );
}
