import admin from "firebase-admin";

const allowedTypes = new Set(["new_schedule", "new_song", "updated_schedule", "other"]);

function initializeAdmin() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin no está configurado en el backend.");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

function sendJson(response, status, body) {
  response.status(status).json(body);
}

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", process.env.PUSH_ALLOWED_ORIGIN || "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return sendJson(response, 405, { error: "Método no permitido." });

  try {
    initializeAdmin();
    const authHeader = request.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!idToken) return sendJson(response, 401, { error: "Falta token de autenticación." });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const requesterSnap = await admin.firestore().doc(`users/${decoded.uid}`).get();
    const requester = requesterSnap.data();
    if (!requester?.active || !["admin", "editor"].includes(requester.role)) {
      return sendJson(response, 403, { error: "No autorizado para enviar push." });
    }

    const { type, title, body, url, scheduleId, songId } = request.body || {};
    if (!allowedTypes.has(type || "other")) return sendJson(response, 400, { error: "Tipo de notificación no permitido." });
    if (!title || !body) return sendJson(response, 400, { error: "Faltan título o mensaje." });

    const tokensSnap = await admin.firestore().collectionGroup("fcmTokens").where("active", "==", true).get();
    const tokens = [];
    const tokenRefs = [];

    for (const tokenDoc of tokensSnap.docs) {
      const userRef = tokenDoc.ref.parent.parent;
      if (!userRef) continue;
      const userSnap = await userRef.get();
      const user = userSnap.data();
      if (!user?.active) continue;
      const token = tokenDoc.data().token;
      if (token) {
        tokens.push(token);
        tokenRefs.push(tokenDoc.ref);
      }
    }

    let sent = 0;
    let failed = 0;
    let invalid = 0;
    for (let index = 0; index < tokens.length; index += 500) {
      const chunk = tokens.slice(index, index + 500);
      const refs = tokenRefs.slice(index, index + 500);
      const result = await admin.messaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: {
          type: type || "other",
          url: url || "/roca-eterna-musica/",
          scheduleId: scheduleId || "",
          songId: songId || ""
        }
      });
      sent += result.successCount;
      failed += result.failureCount;

      await Promise.all(result.responses.map(async (item, itemIndex) => {
        if (item.success) return;
        const code = item.error?.code || "";
        if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
          invalid += 1;
          await refs[itemIndex].set({ active: false, invalidatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
      }));
    }

    return sendJson(response, 200, { sent, failed, invalid, totalTokens: tokens.length });
  } catch (error) {
    console.error("Error enviando push", error.message);
    return sendJson(response, 500, { error: "No se pudo enviar la notificación push." });
  }
}
