export function badgeClass(value = "") {
  const key = String(value).toLowerCase();
  if (["live", "synced", "sync stable", "online"].includes(key)) return "synced";
  if (["owner", "editor", "viewer"].includes(key)) return key;
  if (["conflict", "conflict_detected"].includes(key)) return "conflict";
  if (["locked"].includes(key)) return "locked";
  if (["error", "failed"].includes(key)) return "danger";
  if (["partial", "broadcast"].includes(key)) return "viewer";
  return key || "viewer";
}
