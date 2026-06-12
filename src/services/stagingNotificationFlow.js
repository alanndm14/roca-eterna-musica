const getUserAgent = () => (typeof navigator === "undefined" ? "" : navigator.userAgent || "");

export function isAndroidDevice() {
  return /android/i.test(getUserAgent());
}

export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(getUserAgent())
    || Boolean(navigator.userAgentData?.mobile);
}

export function isStandalonePwa() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)")?.matches
    || window.navigator?.standalone === true
  );
}

export function isStagingEnvironment() {
  if (import.meta.env.VITE_ENABLE_STAGING_NOTIFICATION_FLOW === "true") return true;
  if (import.meta.env.VITE_APP_ENV === "staging") return true;
  if (typeof window === "undefined") return false;
  return window.location.hostname.endsWith(".vercel.app")
    && window.location.hostname !== "roca-eterna-musica.vercel.app";
}

const stagingTesterEmails = () => `${import.meta.env.VITE_STAGING_TESTER_EMAILS || ""}`
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isStagingNotificationFlowEnabled(user, role) {
  if (!isStagingEnvironment()) return false;
  const email = `${user?.email || ""}`.trim().toLowerCase();
  const testers = stagingTesterEmails();
  return role === "admin" || (email && testers.includes(email));
}

export function getNotificationDeviceContext() {
  return {
    android: isAndroidDevice(),
    mobile: isMobileDevice(),
    standalone: isStandalonePwa()
  };
}
