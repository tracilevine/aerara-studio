import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Session-bound client. All queries run under RLS as the signed-in advisor. */
export async function createClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* server component */ }
        },
      },
    },
  );
}

/** Returns the signed-in advisor or null. */
export async function getAdvisor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("advisors").select("*").eq("user_id", user.id).maybeSingle();
  return data ? { ...data, email: user.email } : null;
}
