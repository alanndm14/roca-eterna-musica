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

export function getNotificationDeviceContext() {
  return {
    android: isAndroidDevice(),
    mobile: isMobileDevice(),
    standalone: isStandalonePwa()
  };
}
