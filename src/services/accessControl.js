export function normalizeRole(value = "") {
  const role = String(value || "").trim().toLowerCase();
  if (["admin", "administrator", "administrador"].includes(role)) return "admin";
  if (["editor", "edicion", "edición"].includes(role)) return "editor";
  return "viewer";
}

export function isFullAdmin(profile = {}) {
  return normalizeRole(profile?.role) === "admin";
}

export function canEditContent(profile = {}) {
  return ["admin", "editor"].includes(normalizeRole(profile?.role));
}

export function canManageAccess(profile = {}) {
  return normalizeRole(profile?.role) === "admin";
}

export function canEditServiceFollowUp(profile = {}) {
  return ["admin", "editor"].includes(normalizeRole(profile?.role));
}
