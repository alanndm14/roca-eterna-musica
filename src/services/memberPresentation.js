import { isAdministrativeAdmin } from "./accessControl";

function normalizeMemberType(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getMemberType(profile = {}) {
  const normalized = normalizeMemberType(
    profile.viewerType
    || profile.memberType
    || profile.musicianType
    || profile.ministryRole
    || profile.profileType
    || ""
  );

  if (["corista", "coro", "choir", "vocal"].includes(normalized)) return "corista";
  if (["medios", "media", "multimedia"].includes(normalized)) return "medios";
  if (["musico", "instrumentista", "instrumentalista"].includes(normalized)) return "musico";
  return normalized;
}

export function shouldHideMusicalKeyForUser(profile = {}) {
  return isAdministrativeAdmin(profile) || ["corista", "medios"].includes(getMemberType(profile));
}

export function shouldShowMusicalKeyForUser(profile) {
  if (!profile) return false;
  const preferences = profile.preferences || {};
  const explicitPreference = [
    profile.showMusicalKey,
    profile.showTone,
    profile.showMusicDetails,
    preferences.showMusicalKey,
    preferences.showTone,
    preferences.showMusicDetails
  ].find((value) => typeof value === "boolean");

  return typeof explicitPreference === "boolean"
    ? explicitPreference
    : !shouldHideMusicalKeyForUser(profile);
}

export function canUseVocalPractice(profile = {}) {
  if (profile?.role === "admin") return !isAdministrativeAdmin(profile);
  return ["corista", "musico"].includes(getMemberType(profile));
}

export function canManageVocalPractice(profile = {}) {
  if (profile?.role === "admin") return !isAdministrativeAdmin(profile);
  return profile?.role === "editor" && ["corista", "musico"].includes(getMemberType(profile));
}
