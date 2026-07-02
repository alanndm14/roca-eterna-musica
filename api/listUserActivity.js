import admin from "firebase-admin";
import {
  applyCors,
  initializeAdmin,
  isAllowedOrigin,
  verifyAppCheckIfRequired,
  verifyRequester
} from "./uploadSongPdfToGithub.js";

const OWNER_EMAIL = "liquea45@gmail.com";

function toPlainDate(value) {
  if (!value) return "";
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  return "";
}

function plainActivity(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    ...data,
    createdAt: toPlainDate(data.createdAt)
  };
}

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
      unauthenticatedMessage: "Necesitas iniciar sesión para ver actividad.",
      forbiddenMessage: "No tienes permiso para ver actividad."
    });
    if (requester.email !== OWNER_EMAIL) {
      response.status(403).json({ ok: false, code: "OWNER_ONLY", message: "Solo el propietario puede ver esta actividad." });
      return;
    }

    const snapshot = await admin.firestore()
      .collection("userActivity")
      .orderBy("createdAt", "desc")
      .limit(300)
      .get();

    response.status(200).json({
      ok: true,
      activity: snapshot.docs.map(plainActivity)
    });
  } catch (error) {
    const status = Number(error.status) || 500;
    if (status >= 500) {
      console.error("[activity-list]", {
        code: error.code || "",
        message: error.message || "Error interno"
      });
    }
    response.status(status).json({
      ok: false,
      code: error.code || "ACTIVITY_LIST_FAILED",
      message: error.message || "No se pudo leer la actividad."
    });
  }
}
