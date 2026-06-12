import { getCurrentUser, missingSupabaseEnvMessage, supabase, supabaseSetupError, warnSupabaseError } from "./supabaseClient";

const avatarBucketName = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET || "avatars";

function requireClient() {
  if (!supabase) return { error: new Error(missingSupabaseEnvMessage) };
  return { client: supabase };
}

function safeFileName(fileName = "avatar") {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "avatar";
}

export async function uploadProfileAvatar(file) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: user, error: userError } = await getCurrentUser();
  if (userError || !user) return { data: null, error: userError || new Error("No authenticated Supabase user.") };

  const bucketPath = `${user.id}/avatar-${Date.now()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await client.storage.from(avatarBucketName).upload(bucketPath, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream"
  });
  warnSupabaseError("avatar upload failed", uploadError);
  if (uploadError) {
    const message = uploadError?.status === 404 || /bucket|storage/i.test(uploadError?.message || "")
      ? "Avatar storage is not configured. Create a public Supabase Storage bucket named avatars or paste an Avatar URL."
      : uploadError?.message || "Avatar upload failed";
    return { data: null, error: new Error(message) };
  }

  const { data: publicUrl } = client.storage.from(avatarBucketName).getPublicUrl(bucketPath);
  if (!publicUrl?.publicUrl) {
    return {
      data: null,
      error: new Error("Avatar uploaded, but the bucket does not expose a public URL.")
    };
  }
  return {
    data: {
      avatarUrl: publicUrl.publicUrl,
      bucket: avatarBucketName,
      path: bucketPath
    },
    error: null
  };
}

export async function updateCurrentProfile(patch = {}) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: user, error: userError } = await getCurrentUser();
  if (userError || !user) return { data: null, error: userError || new Error("No authenticated Supabase user.") };

  const email = String(user.email || patch.email || "").trim() || `${user.id}@invalid.local`;
  const name = patch.name === undefined ? null : String(patch.name || "").trim() || null;
  const avatarUrl = patch.avatarUrl === undefined ? null : String(patch.avatarUrl || "").trim() || null;

  const { data, error: updateError } = await client
    .from("profiles")
    .upsert({
      id: user.id,
      email,
      name,
      avatar_url: avatarUrl
    })
    .select("*")
    .single();
  warnSupabaseError("profile update failed", updateError);
  if (updateError) {
    return {
      data: null,
      error: updateError.status === 403 || updateError.code === "42501"
        ? supabaseSetupError("Profile could not be updated because RLS blocked the write")
        : updateError
    };
  }

  return { data, error: null };
}
