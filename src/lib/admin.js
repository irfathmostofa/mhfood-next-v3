import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Server-side Supabase client that reads/writes auth session cookies.
// Use this inside admin route handlers, server actions and admin pages.
export async function createAdminClient() {
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — safe to ignore when
          // middleware is refreshing the session.
        }
      },
    },
  });
}

export async function getAdminUser() {
  const supabase = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Simple admin guard used by admin route handlers.
export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }
  return user;
}
