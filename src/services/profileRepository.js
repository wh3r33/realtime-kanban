import { getCurrentUser, missingSupabaseEnvMessage, supabase, supabaseSetupError, warnSupabaseError } from "./supabaseClient";

const avatarBucketCandidates = [
  import.meta.env.VITE_SUPABASE_AVATAR_BUCKET,
  "avatars",
  "profile-avatars",
  "images"
].filter(Boolean);

function requireClient() {
  if (!supabase) return { error: new Error(missingSupabaseEnvMessage) };
  return { client: supabase };
}

function safeFileName(fileName = "avatar") {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "avatar";
}

async function findAvatarBucket() {
  const { client, error } = requireClient();
  if (error) return { bucket: null, error };
  const { data, error: listError } = await client.storage.listBuckets();
  warnSupabaseError("avatar bucket list failed", listError);
  if (listError) return { bucket: null, error: listError };
  const bucket = (data || []).find((item) => item.public && avatarBucketCandidates.includes(item.name));
  return { bucket: bucket || null, error: null };
}

export async function uploadProfileAvatar(file) {
  const { client, error } = requireClient();
  if (error) return { data: null, error };
  const { data: user, error: userError } = await getCurrentUser();
  if (userError || !user) return { data: null, error: userError || new Error("No authenticated Supabase user.") };

  const { bucket, error: bucketError } = await findAvatarBucket();
  if (bucketError) return { data: null, error: supabaseSetupError("Avatar storage could not be checked in Supabase") };
  if (!bucket) {
    return {
      data: null,
      error: new Error("Avatar storage bucket is not available. Use the avatar URL field instead.")
    };
  }

  const bucketPath = `profiles/${user.id}/${Date.now()}-${safeFileName(file.name)}`;
  const { error: uploadError } = await client.storage.from(bucket.name).upload(bucketPath, file, {
    upsert: true,
    contentType: file.type || "application/octet-stream"
  });
  warnSupabaseError("avatar upload failed", uploadError);
  if (uploadError) return { data: null, error: uploadError };

  const { data: publicUrl } = client.storage.from(bucket.name).getPublicUrl(bucketPath);
  if (!publicUrl?.publicUrl) {
    return {
      data: null,
      error: new Error("Avatar uploaded, but the bucket does not expose a public URL.")
    };
  }
  return {
    data: {
      avatarUrl: publicUrl.publicUrl,
      bucket: bucket.name,
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
