# Subir o reemplazar PDFs desde la app

La funcion usa una Vercel Function y GitHub Contents API. El token vive solo en
Vercel y nunca se envia al navegador ni se guarda en Firestore.

## 1. Crear token fine-grained

1. Abre GitHub > Settings > Developer settings.
2. Entra a Fine-grained personal access tokens.
3. Crea un token para el repositorio `alanndm14/roca-eterna-musica`.
4. En Repository permissions habilita solamente `Contents: Read and write`.
5. Define una expiracion y guarda el token en un administrador de contrasenas.

## 2. Variables en Vercel

En el proyecto del backend push, abre Settings > Environment Variables y agrega
estas variables para Production:

```text
GITHUB_PDF_UPLOAD_TOKEN=<token fine-grained>
GITHUB_PDF_UPLOAD_OWNER=alanndm14
GITHUB_PDF_UPLOAD_REPO=roca-eterna-musica
GITHUB_PDF_UPLOAD_BRANCH=main
GITHUB_PDF_UPLOAD_BASE_PATH=public/pdfs
GITHUB_PDF_UPLOAD_COMMITTER_NAME=Roca Eterna Musica Bot
GITHUB_PDF_UPLOAD_COMMITTER_EMAIL=<correo noreply o correo seguro>
```

El backend tambien necesita las variables Firebase Admin que ya usa el push:

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

Si el origen permitido del backend esta personalizado, incluye:

```text
PDF_UPLOAD_ALLOWED_ORIGINS=https://musica.rocaeternamexico.com.mx
```

Despues de guardar variables, redeploya Vercel.

## 3. Frontend

Normalmente no necesita una variable nueva. La app obtiene el host del backend
desde `VITE_PUSH_SERVER_URL` y usa `/api/uploadSongPdfToGithub`.

Solo si la subida usa otro backend distinto, configura:

```text
VITE_PDF_UPLOAD_SERVER_URL=https://backend.example/api/uploadSongPdfToGithub
```

## Seguridad

- Solo usuarios activos con rol `admin` o `editor` pasan la validacion server-side.
- El endpoint valida Firebase ID token y App Check cuando esta forzado.
- Solo acepta PDFs reales con firma `%PDF-`.
- La subida directa se limita a 3 MB en el cliente y 4 MB en el servidor.
- La importacion por URL se limita a 20 MB y solo acepta HTTPS publico.
- La ruta del repositorio esta restringida a `public/pdfs`.
- El nombre se deriva del canto guardado en Firestore.
- El token no se imprime ni se devuelve al cliente.

## Publicacion

La subida crea un commit en `main`. GitHub Pages puede tardar unos minutos en
publicar el PDF. Firestore guarda `pdfVersion`, y la app abre el archivo con
cache-busting para evitar mostrar una version anterior.
