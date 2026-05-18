import { auth, pushServerUrl } from "../lib/firebase";

export async function sendExternalPush(payload = {}) {
  if (!pushServerUrl || !auth?.currentUser) {
    return { skipped: true, reason: "Push externo no configurado." };
  }

  try {
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(pushServerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return { skipped: false, ok: false, status: response.status };
    }

    return await response.json().catch(() => ({ ok: true }));
  } catch (error) {
    console.warn("No se pudo enviar push externo. La notificación interna sigue activa.", error);
    return { skipped: false, ok: false, error: error.message };
  }
}
