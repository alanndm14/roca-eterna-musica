import { getToken as getAppCheckToken } from "firebase/app-check";
import { appCheck, auth, pushServerUrl } from "../lib/firebase";

export function activityApiUrl(path = "logUserActivity") {
  if (!pushServerUrl) return "";
  try {
    const url = new URL(pushServerUrl, window.location.origin);
    url.pathname = url.pathname.replace(/\/api\/[^/]*$/, `/api/${path}`);
    if (!url.pathname.includes(`/api/${path}`)) url.pathname = `/api/${path}`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return pushServerUrl.replace(/\/api\/[^/?#]+.*$/, `/api/${path}`);
  }
}

export async function authenticatedHeaders() {
  const currentUser = auth?.currentUser;
  if (!currentUser) return null;
  const idToken = await currentUser.getIdToken(false);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`
  };
  if (appCheck) {
    try {
      const appCheckResult = await getAppCheckToken(appCheck, false);
      if (appCheckResult?.token) headers["X-Firebase-AppCheck"] = appCheckResult.token;
    } catch {
      // App Check no debe romper funciones internas si todavía no está listo.
    }
  }
  return headers;
}
