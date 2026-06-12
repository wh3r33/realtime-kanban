import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;

export const missingSupabaseEnvMessage =
  "Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. VITE_SUPABASE_PUBLISHABLE_KEY is also supported as a fallback.";

export function warnSupabaseError(context, error) {
  if (import.meta.env.DEV && error) console.warn(`[Supabase] ${context}`, error);
}

export function isSupabaseSetupError(error) {
  return error?.status === 403 || error?.status === 406 || error?.code === "42501" || /permission|row-level security|rls/i.test(error?.message || "");
}

export function isMissingSupabaseSchemaError(error) {
  const message = error?.message || error?.details || error?.hint || "";
  return (
    error?.code === "PGRST202" ||
    error?.status === 404 ||
    (error?.status === 400 && /column|does not exist|schema cache/i.test(message)) ||
    /relation .* does not exist/i.test(message) ||
    /column .* does not exist/i.test(message) ||
    /could not find .* in the schema cache/i.test(message) ||
    /function .* does not exist/i.test(message)
  );
}

export function migrationRequiredError(feature) {
  const error = new Error(`${feature} require database migration.`);
  error.code = "MIGRATION_REQUIRED";
  return error;
}

export function supabaseSetupError(context) {
  return new Error(`${context}. Check that Supabase migrations have been applied and that RLS policies allow this authenticated user.`);
}

export async function getCurrentUser() {
  if (!supabase) return { data: null, error: new Error(missingSupabaseEnvMessage) };
  const { data, error } = await supabase.auth.getUser();
  warnSupabaseError("auth.getUser failed", error);
  return { data: data?.user || null, error };
}

export async function getCurrentSession() {
  if (!supabase) return { data: null, error: new Error(missingSupabaseEnvMessage) };
  const { data, error } = await supabase.auth.getSession();
  warnSupabaseError("auth.getSession failed", error);
  return { data: data?.session || null, error };
}

export async function getCurrentProfile() {
  if (!supabase) return { data: null, error: new Error(missingSupabaseEnvMessage) };
  const { data: user, error: userError } = await getCurrentUser();
  if (userError || !user) return { data: null, error: userError || new Error("No authenticated Supabase user.") };

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  warnSupabaseError("profiles lookup failed", error);
  if (error) return { data: null, error };
  if (data) return { data, error: null };

  const fallbackProfile = {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.email,
    avatar_url: user.user_metadata?.avatar_url || null
  };

  const { data: createdProfile, error: insertError } = await supabase
    .from("profiles")
    .insert(fallbackProfile)
    .select()
    .single();
  warnSupabaseError("profiles fallback insert failed", insertError);

  if (insertError) {
    return {
      data: fallbackProfile,
      error: isSupabaseSetupError(insertError)
        ? supabaseSetupError("Profile row is missing and could not be created in Supabase")
        : new Error("Profile row is missing and could not be created. Check profiles RLS or handle_new_user trigger.")
    };
  }

  return { data: createdProfile, error: null };
}
