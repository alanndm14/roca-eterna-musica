# Subida de audio de ensayo a GitHub

La app puede guardar audios de ensayo en `public/practice-guides` dentro del
repositorio de GitHub.

## Archivos pequeños

Los audios de hasta 3 MB siguen subiendo por la función de Vercel
`api/uploadPracticeGuideToGithub.js`, igual que antes.

## Archivos grandes

Para audios mayores de 3 MB y hasta 25 MB, la app usa una subida directa desde
el navegador a GitHub. Esto evita el límite de tamaño del cuerpo de petición de
Vercel.

Esta ruta no expone el token permanente de GitHub. El backend crea un token
temporal de GitHub App, válido por poco tiempo, y solo después la app sube el
archivo directo a GitHub.

## Variables necesarias en Vercel

Además de las variables existentes para PDFs y Firebase Admin, agrega:

```env
GITHUB_PRACTICE_UPLOAD_APP_ID=<id de la GitHub App>
GITHUB_PRACTICE_UPLOAD_INSTALLATION_ID=<id de instalación>
GITHUB_PRACTICE_UPLOAD_PRIVATE_KEY=<private key de la GitHub App>
GITHUB_PRACTICE_GUIDES_BASE_PATH=public/practice-guides
```

La GitHub App debe estar instalada en el repositorio y tener permiso:

```text
Repository permissions:
- Contents: Read and write
```

Después de guardar variables, haz redeploy del backend en Vercel.

## Flujo

1. El usuario selecciona el audio desde la app.
2. Si pesa 3 MB o menos, se guarda por la función normal.
3. Si pesa más de 3 MB, el backend prepara una ruta y un token temporal.
4. El navegador sube el audio directo a GitHub.
5. El backend guarda los metadatos del audio en Firestore.

