import { getCurrentUser, isSupabaseSetupError, missingSupabaseEnvMessage, supabase, supabaseSetupError, warnSupabaseError } from "./supabaseClient";

function requireClient() {
  if (!supabase) return { error: new Error(missingSupabaseEnvMessage) };
  return { client: supabase };
}

function initialsFor(nameOrEmail = "") {
  const source = nameOrEmail.trim();
  if (!source) return "US";
  const parts = source.split(/\s+/).slice(0, 2);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.map((part) => part[0]).join("").toUpperCase();
}

function mapMember(row) {
  const profile = row.users || {};
  const name = profile.name || profile.email || "Unknown user";
  return {
    id: row.user_id,
    boardId: row.board_id,
    name,
    email: profile.email || "",
    initials: initialsFor(name),
    color: "#2855FF",
    role: row.role,
    presence: "not connected",
    activity: "No recent activity",
    joinedAt: row.created_at
  };
}

export async function listBoardMembers(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: [], error };
  const { data, error: queryError } = await client
    .from("board_members")
    .select("board_id, user_id, role, created_at, users(id, email, name, avatar_url)")
    .eq("board_id", boardId)
    .order("created_at", { ascending: true });
  warnSupabaseError("board members list failed", queryError);
  return { data: (data || []).map(mapMember), error: isSupabaseSetupError(queryError) ? supabaseSetupError("Board members could not be loaded from Supabase") : queryError };
}

export async function getCurrentUserBoardRole(boardId) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: user, error: userError } = await getCurrentUser();
  if (userError || !user) return { data: null, error: userError || new Error("No authenticated Supabase user.") };
  const { data, error: queryError } = await client
    .from("board_members")
    .select("role")
    .eq("board_id", boardId)
    .eq("user_id", user.id)
    .maybeSingle();
  warnSupabaseError("current user board role lookup failed", queryError);
  return { data: data?.role || null, error: isSupabaseSetupError(queryError) ? supabaseSetupError("Current board role could not be loaded from Supabase") : queryError };
}
