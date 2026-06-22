export const ADMIN_MODES = {
  EDITOR: "editor",
  ADMINISTRATIVE: "administrative"
};

export function normalizeRole(value = "") {
  const role = String(value || "").trim().toLowerCase();
  if (["admin", "administrator", "administrador"].includes(role)) return "admin";
  if (["editor", "edicion", "edición"].includes(role)) return "editor";
  return "viewer";
}

export function getAdminMode(profile = {}) {
  if (normalizeRole(profile?.role) !== "admin") return "";
  return profile.adminMode === ADMIN_MODES.ADMINISTRATIVE
    ? ADMIN_MODES.ADMINISTRATIVE
    : ADMIN_MODES.EDITOR;
}

export function isAdministrativeAdmin(profile = {}) {
  return normalizeRole(profile?.role) === "admin" && getAdminMode(profile) === ADMIN_MODES.ADMINISTRATIVE;
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
