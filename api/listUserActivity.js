import {
  applyCors,
  initializeAdmin,
  isAllowedOrigin,
  verifyAppCheckIfRequired,
  verifyRequester
} from "./uploadSongPdfToGithub.js";

const OWNER_EMAIL = "liquea45@gmail.com";

export default async function handler(request, response) {
  applyCors(request, response, "GET, OPTIONS");
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (request.method !== "GET") {
    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "Método no permitido." });
    return;
  }
  if (!isAllowedOrigin(request.headers.origin || "")) {
    response.status(403).json({ ok: false, code: "ORIGIN_NOT_ALLOWED", message: "Origen no permitido." });
    return;
  }

  try {
    initializeAdmin();
    await verifyAppCheckIfRequired(request);
    const requester = await verifyRequester(request, {
      allowedRoles: ["admin"],
      unauthenticatedMessage: "Necesitas iniciar sesión.",
      forbiddenMessage: "No tienes permiso para ver esta información."
    });
    if (requester.email !== OWNER_EMAIL) {
      response.status(403).json({ ok: false, code: "OWNER_ONLY", message: "Solo el propietario puede ver esta información." });
      return;
    }

    response.status(200).json({
      ok: true,
      disabled: true,
      activity: [],
      message: "El registro detallado de actividad está desactivado para ahorrar cuota de Firebase."
    });
  } catch (error) {
    response.status(Number(error.status) || 500).json({
      ok: false,
      code: error.code || "ACTIVITY_LIST_DISABLED",
      message: error.message || "El registro detallado de actividad está desactivado."
    });
  }
}
