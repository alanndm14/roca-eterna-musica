import admin from "firebase-admin";

const DIRECT_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
const URL_IMPORT_MAX_BYTES = 20 * 1024 * 1024;
const URL_IMPORT_TIMEOUT_MS = 25000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 6;
const DEFAULT_ALLOWED_ORIGINS = [
  "https://musica.rocaeternamexico.com.mx",
  "https://alanndm14.github.io",
  "https://roca-eterna-musica.vercel.app"
];
const requestBuckets = new Map();
const activeUploads = new Set();

export function initializeAdmin() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    const error = new Error("Firebase Admin no esta configurado en el servidor.");
    error.status = 503;
    error.code = "FIREBASE_ADMIN_NOT_CONFIGURED";
    throw error;
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId
  });
}

export function normalizeOrigin(origin = "") {
  return String(origin || "").replace(/\/$/, "");
}

export function allowedOrigins() {
  const configured = String(
    process.env.PDF_UPLOAD_ALLOWED_ORIGINS
    || process.env.PUSH_ALLOWED_ORIGINS
    || process.env.PUSH_ALLOWED_ORIGIN
    || ""
  )
    .split(",")
    .map((item) => normalizeOrigin(item.trim()))
    .filter(Boolean);
  const values = configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
  if (process.env.NODE_ENV !== "production") {
    values.push("http://localhost:5173", "http://127.0.0.1:5173");
  }
  return new Set(values);
}

export function isAllowedOrigin(origin = "") {
  if (!origin) return true;
  if (process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(normalizeOrigin(origin))) {
    return true;
  }
  return allowedOrigins().has(normalizeOrigin(origin));
}

export function applyCors(request, response, methods = "POST, OPTIONS") {
  const origin = normalizeOrigin(request.headers.origin || "");
  if (isAllowedOrigin(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin || [...allowedOrigins()][0]);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", methods);
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Firebase-AppCheck");
  response.setHeader("Cache-Control", "no-store");
}

export function parseBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "string") {
    try {
      return JSON.parse(request.body);
    } catch {
      const error = new Error("El cuerpo de la solicitud no es JSON valido.");
      error.status = 400;
      error.code = "INVALID_JSON";
      throw error;
    }
  }
  return request.body;
}

function serverConfig() {
  const token = process.env.GITHUB_PDF_UPLOAD_TOKEN || "";
  const owner = process.env.GITHUB_PDF_UPLOAD_OWNER || "";
  const repo = process.env.GITHUB_PDF_UPLOAD_REPO || "";
  const branch = process.env.GITHUB_PDF_UPLOAD_BRANCH || "main";
  const basePath = String(process.env.GITHUB_PDF_UPLOAD_BASE_PATH || "public/pdfs")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");

  if (!token || !owner || !repo) {
    const error = new Error("La funcion de subida no esta configurada. Falta una variable de entorno del servidor.");
    error.status = 503;
    error.code = "GITHUB_UPLOAD_NOT_CONFIGURED";
    throw error;
  }
  if (basePath !== "public/pdfs") {
    const error = new Error("La ruta de PDFs configurada en el servidor no es valida.");
    error.status = 503;
    error.code = "INVALID_GITHUB_BASE_PATH";
    throw error;
  }

  return {
    token,
    owner,
    repo,
    branch,
    basePath,
    committerName: process.env.GITHUB_PDF_UPLOAD_COMMITTER_NAME || "",
    committerEmail: process.env.GITHUB_PDF_UPLOAD_COMMITTER_EMAIL || ""
  };
}

export async function verifyRequester(request, options = {}) {
  const allowedRoles = options.allowedRoles || ["admin", "editor"];
  const unauthenticatedMessage = options.unauthenticatedMessage || "Necesitas iniciar sesion para actualizar PDFs.";
  const forbiddenMessage = options.forbiddenMessage || "No tienes permiso para subir o reemplazar PDFs.";
  const authHeader = request.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!idToken) {
    const error = new Error(unauthenticatedMessage);
    error.status = 401;
    error.code = "MISSING_ID_TOKEN";
    throw error;
  }

  const decoded = await admin.auth().verifyIdToken(idToken);
  const userSnapshot = await admin.firestore().doc(`users/${decoded.uid}`).get();
  const user = userSnapshot.data() || {};
  const tokenEmail = String(decoded.email || "").trim().toLowerCase();
  const storedEmail = String(user.email || "").trim().toLowerCase();
  const role = String(user.role || "").trim().toLowerCase();

  if (user.active === false || !allowedRoles.includes(role) || !tokenEmail || tokenEmail !== storedEmail) {
    const error = new Error(forbiddenMessage);
    error.status = 403;
    error.code = "ROLE_NOT_ALLOWED";
    throw error;
  }

  return {
    uid: decoded.uid,
    email: tokenEmail,
    displayName: user.preferredDisplayName || user.displayName || decoded.name || tokenEmail,
    role,
    adminMode: role === "admin" ? String(user.adminMode || "editor").trim().toLowerCase() : "",
    viewerType: String(user.viewerType || user.memberType || "").trim().toLowerCase()
  };
}

export async function verifyAppCheckIfRequired(request) {
  if (process.env.REQUIRE_APP_CHECK !== "true") return;
  const token = request.headers["x-firebase-appcheck"] || "";
  if (!token) {
    const error = new Error("No se pudo verificar la aplicacion.");
    error.status = 401;
    error.code = "APP_CHECK_REQUIRED";
    throw error;
  }
  await admin.appCheck().verifyToken(token);
}

export function enforceRateLimit(uid = "", namespace = "pdf") {
  const now = Date.now();
  const bucketKey = `${namespace}:${uid}`;
  const recent = (requestBuckets.get(bucketKey) || []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    const error = new Error("Hay demasiados intentos de subida. Espera un minuto e intenta de nuevo.");
    error.status = 429;
    error.code = "RATE_LIMITED";
    throw error;
  }
  recent.push(now);
  requestBuckets.set(bucketKey, recent);
}

export function validateSongId(songId = "") {
  const value = String(songId || "").trim();
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(value)) {
    const error = new Error("El canto seleccionado no es valido.");
    error.status = 400;
    error.code = "INVALID_SONG_ID";
    throw error;
  }
  return value;
}

export function slugifySongTitle(title = "") {
  const slug = String(title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug || "canto").slice(0, 120);
}

function existingPdfFileName(song = {}) {
  const rawPath = String(song.localPdfPath || song.pdfLocalPath || "")
    .split(/[?#]/)[0]
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^public\//i, "");
  if (!rawPath.toLowerCase().startsWith("pdfs/")) return "";
  const encodedName = rawPath.slice("pdfs/".length);
  let fileName = "";
  try {
    fileName = decodeURIComponent(encodedName);
  } catch {
    fileName = encodedName;
  }
  if (
    !fileName
    || fileName.includes("/")
    || fileName.includes("\\")
    || fileName.includes("..")
    || /[\u0000-\u001f\u007f]/.test(fileName)
    || !fileName.toLowerCase().endsWith(".pdf")
  ) return "";
  return fileName.slice(0, 180);
}

function resolvePdfFileName(song = {}) {
  return existingPdfFileName(song) || `${slugifySongTitle(song.title)}.pdf`;
}

function isPdfBuffer(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function validatePdfBuffer(buffer, maxBytes, sizeMessage) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    const error = new Error("El PDF esta vacio.");
    error.status = 400;
    error.code = "EMPTY_PDF";
    throw error;
  }
  if (buffer.length > maxBytes) {
    const error = new Error(sizeMessage);
    error.status = 413;
    error.code = "PDF_TOO_LARGE";
    throw error;
  }
  if (!isPdfBuffer(buffer)) {
    const error = new Error("El archivo seleccionado no es un PDF valido.");
    error.status = 400;
    error.code = "INVALID_PDF_SIGNATURE";
    throw error;
  }
}

function pdfFromDirectUpload(body = {}) {
  const contentType = String(body.contentType || "").toLowerCase();
  const originalFileName = String(body.originalFileName || "");
  const fileBase64 = String(body.fileBase64 || "").replace(/\s/g, "");

  if (!contentType.includes("application/pdf") || !originalFileName.toLowerCase().endsWith(".pdf")) {
    const error = new Error("Solo se permiten archivos PDF.");
    error.status = 400;
    error.code = "INVALID_FILE_TYPE";
    throw error;
  }
  if (!fileBase64 || !/^[a-zA-Z0-9+/]*={0,2}$/.test(fileBase64)) {
    const error = new Error("El contenido del PDF no es valido.");
    error.status = 400;
    error.code = "INVALID_BASE64";
    throw error;
  }
  if (fileBase64.length > Math.ceil(DIRECT_UPLOAD_MAX_BYTES * 4 / 3) + 8) {
    const error = new Error("Este PDF pesa demasiado para subida directa. Usa Importar desde enlace o comprimelo.");
    error.status = 413;
    error.code = "PDF_TOO_LARGE";
    throw error;
  }

  const buffer = Buffer.from(fileBase64, "base64");
  validatePdfBuffer(
    buffer,
    DIRECT_UPLOAD_MAX_BYTES,
    "Este PDF pesa demasiado para subida directa. Usa Importar desde enlace o comprimelo."
  );
  return buffer;
}

function googleDriveDownloadUrl(inputUrl) {
  const url = new URL(inputUrl);
  const patterns = [
    /\/file\/d\/([^/?#]+)/i,
    /[?&]id=([^&#]+)/i
  ];
  const match = patterns.map((pattern) => inputUrl.match(pattern)).find(Boolean);
  if (!url.hostname.endsWith("drive.google.com") || !match?.[1]) return inputUrl;
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(match[1])}`;
}

function validateRemoteUrl(input = "") {
  if (String(input || "").length > 2048) {
    const error = new Error("El enlace del PDF es demasiado largo.");
    error.status = 400;
    error.code = "INVALID_PDF_URL";
    throw error;
  }
  let url;
  try {
    url = new URL(String(input || "").trim());
  } catch {
    const error = new Error("El enlace del PDF no es valido.");
    error.status = 400;
    error.code = "INVALID_PDF_URL";
    throw error;
  }
  const hostname = url.hostname.toLowerCase();
  const blockedHostname = hostname === "localhost"
    || hostname === "0.0.0.0"
    || hostname === "::1"
    || hostname.endsWith(".local")
    || /^127\./.test(hostname)
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^169\.254\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
  if (url.protocol !== "https:" || blockedHostname) {
    const error = new Error("El enlace debe ser HTTPS y apuntar a un archivo publico.");
    error.status = 400;
    error.code = "UNSAFE_PDF_URL";
    throw error;
  }
  return url.href;
}

async function pdfFromUrl(inputUrl = "") {
  const safeInputUrl = validateRemoteUrl(inputUrl);
  const downloadUrl = googleDriveDownloadUrl(safeInputUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), URL_IMPORT_TIMEOUT_MS);

  try {
    const response = await fetch(downloadUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Roca-Eterna-Musica-PDF-Importer/1.0" }
    });
    if (!response.ok) {
      const error = new Error(`No se pudo descargar el PDF desde el enlace (${response.status}).`);
      error.status = 400;
      error.code = "PDF_DOWNLOAD_FAILED";
      throw error;
    }
    validateRemoteUrl(response.url || downloadUrl);
    const announcedSize = Number(response.headers.get("content-length") || 0);
    if (announcedSize > URL_IMPORT_MAX_BYTES) {
      const error = new Error("El PDF del enlace es demasiado grande para importarlo.");
      error.status = 413;
      error.code = "PDF_TOO_LARGE";
      throw error;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    validatePdfBuffer(buffer, URL_IMPORT_MAX_BYTES, "El PDF del enlace es demasiado grande para importarlo.");
    return buffer;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("La descarga del PDF excedio el tiempo de espera.");
      timeoutError.status = 504;
      timeoutError.code = "PDF_DOWNLOAD_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function encodeGithubPath(path = "") {
  return String(path).split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

export function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Roca-Eterna-Musica-PDF-Uploader"
  };
}

export async function githubRequest(url, options, config) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...githubHeaders(config.token),
      ...(options.headers || {})
    }
  });
  let payload = {};
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = {};
    }
  }
  return { response, payload };
}

async function uploadToGithub({ buffer, fileName, songTitle, config }) {
  const repoPath = `${config.basePath}/${fileName}`;
  const contentUrl = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodeGithubPath(repoPath)}`;
  const lookup = await githubRequest(`${contentUrl}?ref=${encodeURIComponent(config.branch)}`, { method: "GET" }, config);

  if (!lookup.response.ok && lookup.response.status !== 404) {
    const error = new Error("No se pudo consultar el PDF actual en GitHub. Revisa permisos del token.");
    error.status = lookup.response.status === 401 || lookup.response.status === 403 ? 503 : 502;
    error.code = "GITHUB_LOOKUP_FAILED";
    throw error;
  }

  const exists = lookup.response.ok && Boolean(lookup.payload.sha);
  const body = {
    message: `${exists ? "Update" : "Add"} PDF for ${songTitle}`,
    content: buffer.toString("base64"),
    branch: config.branch,
    ...(exists ? { sha: lookup.payload.sha } : {}),
    ...(config.committerName && config.committerEmail ? {
      committer: {
        name: config.committerName,
        email: config.committerEmail
      }
    } : {})
  };
  const upload = await githubRequest(contentUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }, config);

  if (!upload.response.ok) {
    const error = new Error(
      upload.response.status === 409
        ? "Hubo un conflicto al reemplazar el PDF. Espera unos segundos y vuelve a intentar."
        : "No se pudo actualizar el PDF en GitHub. Revisa permisos del token o intenta de nuevo."
    );
    error.status = upload.response.status === 409 ? 409 : 502;
    error.code = upload.response.status === 409 ? "GITHUB_CONFLICT" : "GITHUB_UPLOAD_FAILED";
    throw error;
  }

  return {
    created: !exists,
    repoPath,
    commitSha: upload.payload.commit?.sha || "",
    contentSha: upload.payload.content?.sha || ""
  };
}

async function updateSongMetadata({ songRef, song, requester, fileName, githubResult }) {
  const nowVersion = Date.now();
  const publicPath = `/pdfs/${fileName}`;
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const metadata = {
    localPdfPath: publicPath,
    pdfLocalPath: publicPath,
    pdfFileName: fileName,
    pdfUpdatedAt: timestamp,
    pdfUpdatedBy: requester.uid,
    pdfUpdatedByEmail: requester.email,
    pdfSource: "github",
    pdfStatus: "actualizado",
    pdfVersion: nowVersion,
    pdfIndexStatus: "pending",
    indexedTextAvailable: false,
    pdfSearchText: "",
    pdfOcrText: "",
    pdfSearchTokens: [],
    textFingerprint: "",
    updatedAt: timestamp
  };

  await songRef.update(metadata);
  try {
    await admin.firestore().collection("auditLogs").add({
      actionType: "pdf_updated",
      entityType: "song",
      entityId: songRef.id,
      entityName: song.title || "",
      summary: `PDF local actualizado: ${song.title || songRef.id}`,
      beforeData: {
        localPdfPath: song.localPdfPath || song.pdfLocalPath || "",
        pdfVersion: song.pdfVersion || null
      },
      afterData: {
        localPdfPath: publicPath,
        pdfFileName: fileName,
        pdfVersion: nowVersion,
        source: "github-upload",
        commitSha: githubResult.commitSha
      },
      performedByUid: requester.uid,
      performedByName: requester.displayName,
      performedByEmail: requester.email,
      createdAt: timestamp
    });
  } catch (auditError) {
    console.warn("[pdf-upload] No se pudo registrar auditoria.", {
      code: auditError.code || "",
      message: auditError.message || ""
    });
  }

  return { ...metadata, localPdfPath: publicPath, pdfLocalPath: publicPath, pdfVersion: nowVersion };
}

function safeError(error = {}) {
  return {
    ok: false,
    code: error.code || "PDF_UPLOAD_FAILED",
    message: error.message || "No se pudo actualizar el PDF.",
    stage: error.stage || "upload_pdf"
  };
}

export default async function handler(request, response) {
  applyCors(request, response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", message: "Metodo no permitido." });
    return;
  }
  if (!isAllowedOrigin(request.headers.origin || "")) {
    response.status(403).json({ ok: false, code: "ORIGIN_NOT_ALLOWED", message: "Origen no permitido." });
    return;
  }

  let uploadKey = "";
  try {
    initializeAdmin();
    await verifyAppCheckIfRequired(request);
    const requester = await verifyRequester(request);
    if (requester.role === "admin" && requester.adminMode === "administrative") {
      const error = new Error("Este perfil administrativo no puede reemplazar archivos del repertorio.");
      error.status = 403;
      error.code = "ADMINISTRATIVE_PROFILE_READ_ONLY";
      throw error;
    }
    enforceRateLimit(requester.uid);
    const body = parseBody(request);
    const songId = validateSongId(body.songId);
    uploadKey = `${requester.uid}:${songId}`;
    if (activeUploads.has(uploadKey)) {
      const error = new Error("Ya hay una actualizacion de PDF en curso para este canto.");
      error.status = 409;
      error.code = "UPLOAD_IN_PROGRESS";
      throw error;
    }
    activeUploads.add(uploadKey);

    const songRef = admin.firestore().doc(`songs/${songId}`);
    const songSnapshot = await songRef.get();
    if (!songSnapshot.exists) {
      const error = new Error("El canto ya no existe.");
      error.status = 404;
      error.code = "SONG_NOT_FOUND";
      throw error;
    }
    const song = songSnapshot.data() || {};
    const fileName = resolvePdfFileName(song);
    const mode = body.mode === "url" ? "url" : "file";
    const config = serverConfig();
    const buffer = mode === "url"
      ? await pdfFromUrl(body.sourceUrl)
      : pdfFromDirectUpload(body);
    const githubResult = await uploadToGithub({
      buffer,
      fileName,
      songTitle: song.title || body.songTitle || songId,
      config
    });
    const metadata = await updateSongMetadata({
      songRef,
      song,
      requester,
      fileName,
      githubResult
    });

    response.status(githubResult.created ? 201 : 200).json({
      ok: true,
      created: githubResult.created,
      songId,
      songTitle: song.title || "",
      localPdfPath: metadata.localPdfPath,
      pdfLocalPath: metadata.pdfLocalPath,
      pdfFileName: fileName,
      pdfVersion: metadata.pdfVersion,
      pdfStatus: "actualizado",
      source: "github",
      message: "PDF actualizado en GitHub. Puede tardar unos minutos en verse en produccion."
    });
  } catch (error) {
    const status = Number(error.status) || 500;
    if (status >= 500) {
      console.error("[pdf-upload]", {
        code: error.code || "",
        message: error.message || "Error interno"
      });
    }
    response.status(status).json(safeError(error));
  } finally {
    if (uploadKey) activeUploads.delete(uploadKey);
  }
}
