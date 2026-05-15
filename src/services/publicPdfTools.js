import { resolvePublicPdfPath } from "./songUtils";

export async function testPublicPdfPath(localPdfPath) {
  const resolvedPath = resolvePublicPdfPath(localPdfPath);
  if (!resolvedPath) {
    return {
      ok: false,
      status: "",
      savedPath: localPdfPath || "",
      resolvedPath: "",
      message: "No hay ruta de PDF local guardada."
    };
  }

  try {
    const response = await fetch(resolvedPath, { method: "HEAD", cache: "no-store" });
    const ok = response.ok && String(response.headers.get("content-type") || "").toLowerCase().includes("pdf");
    return {
      ok,
      status: response.status,
      savedPath: localPdfPath,
      resolvedPath,
      message: ok
        ? "PDF local encontrado."
        : "No se encontro el PDF local. Verifica que exista en public/pdfs. GitHub Pages distingue mayusculas y minusculas; revisa espacios, acentos y extension .pdf."
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      savedPath: localPdfPath,
      resolvedPath,
      message: "No se pudo probar la ruta. Revisa que el archivo exista en public/pdfs y que la ruta no tenga errores."
    };
  }
}
