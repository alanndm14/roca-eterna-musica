export const ADMIN_MODES = {
  EDITOR: "editor",
  ADMINISTRATIVE: "administrative"
};

export function getAdminMode(profile = {}) {
  if (profile?.role !== "admin") return "";
  return profile.adminMode === ADMIN_MODES.ADMINISTRATIVE
    ? ADMIN_MODES.ADMINISTRATIVE
    : ADMIN_MODES.EDITOR;
}

export function isAdministrativeAdmin(profile = {}) {
  return profile?.role === "admin" && getAdminMode(profile) === ADMIN_MODES.ADMINISTRATIVE;
}

export function isFullAdmin(profile = {}) {
  return profile?.role === "admin" && getAdminMode(profile) === ADMIN_MODES.EDITOR;
}

export function canEditContent(profile = {}) {
  return isFullAdmin(profile) || profile?.role === "editor";
}

export function canManageAccess(profile = {}) {
  return profile?.role === "admin";
}

export function canEditServiceFollowUp(profile = {}) {
  return profile?.role === "admin" || profile?.role === "editor";
}
