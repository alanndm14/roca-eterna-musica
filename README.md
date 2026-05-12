# Roca Eterna Música

Web app tipo PWA para organizar el ministerio de música de la iglesia Roca Eterna: repertorio, programación, PDFs de letra/acordes, tonos, responsables, ensayos, historial y estadísticas.

## Stack

- React + Vite
- Tailwind CSS
- Firebase Authentication con Google Sign-In
- Cloud Firestore
- Framer Motion
- lucide-react
- Recharts
- pdf-lib para unir PDFs locales en el navegador
- PWA con manifest y service worker
- Preparada para GitHub Pages

## Primer uso

```bash
npm install
npm run dev
```

Para compilar:

```bash
npm run build
```

## Configurar Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. En Authentication, habilita el proveedor Google.
3. En Firestore Database, crea una base en modo producción.
4. Copia `.env.example` como `.env` si todavía no existe.
5. Llena las variables `VITE_FIREBASE_*` con la configuración web de tu app Firebase.
6. En `VITE_INITIAL_ADMIN_EMAILS`, escribe tu correo de Google.
7. En `firebase2.rules`, confirma que tu correo admin inicial esté en `bootstrapAdminEmails`.
8. Publica las reglas:

```bash
firebase deploy --only firestore:rules
```

Firebase Storage no es requisito. La app funciona con Authentication, Firestore y links de PDFs.

## Modelo de acceso

- `admin`: crea, edita, borra, configura usuarios y ajustes.
- `editor`: crea y edita cantos/programaciones.
- `viewer`: solo ve información.

El primer admin se crea cuando inicia sesión con un correo incluido en `VITE_INITIAL_ADMIN_EMAILS` y en `firebase2.rules`. Después, desde Configuración, el admin puede agregar correos a `allowedEmails` con rol y estado activo.

## PDFs de letra y acordes

El flujo recomendado sin plan Blaze es guardar cada canto como un PDF separado en Google Drive y pegar el link en el campo **PDF de letra y acordes**.

Usa un link compartido de Drive como:

```text
https://drive.google.com/file/d/FILE_ID/view?usp=sharing
```

La app intenta convertirlo automáticamente a:

```text
https://drive.google.com/file/d/FILE_ID/preview
```

Ese link permite usar **Ver PDFs del servicio** dentro de la app. Si Google Drive no se desplaza bien o bloquea la vista previa, usa **Abrir PDF**.

## Unir PDFs sin Firebase Storage

La app no intenta fusionar PDFs de Drive automáticamente porque Google Drive no lo permite de forma confiable desde el navegador.

Opciones disponibles en Vista para músicos:

- **Ver PDFs del servicio**: abre los PDFs de los cantos en un visor dentro de la app.
- **Descargar hoja del servicio**: genera un PDF resumen con fecha, servicio, responsable, cantos, tonos, notas y links.
- **Unir PDFs desde mi computadora**: selecciona varios PDFs locales, los reordena y los une en el navegador. No se suben a la nube.
- **Unir PDFs del servicio desde la app**: usa solo archivos disponibles en `public/pdfs/` mediante el campo `localPdfPath`.

### PDFs en public/pdfs

Puedes guardar PDFs en:

```text
public/pdfs/
```

Luego, en el formulario de canto, usa:

```text
/pdfs/nombre-del-canto.pdf
```

Los PDFs guardados en `public/pdfs` se publican junto con GitHub Pages. No uses esta opción para material privado o restringido.

## Importar repertorio

En Configuración > Importar repertorio puedes pegar CSV/TSV o cargar archivo `.csv`/`.tsv`.

Columnas esperadas:

```text
id, nombre, tema, otros_temas, categoria, cantado, tonalidad, capo, tonalidad_con_capo, cambio_de_tono, revision_musical, revision_keynote, revision_pdf, formato, comentario
```

También puedes incluir `ruta_pdf_local` o `localPdfPath` para llenar el campo de PDF local.

## Publicar en GitHub Pages

1. Revisa `base` en `vite.config.js`:

```js
base: "/roca-eterna-musica/"
```

2. En Firebase Authentication, agrega tu dominio de GitHub Pages a “Authorized domains”.
3. Ejecuta:

```bash
npm run deploy
```

La app usa `HashRouter`, por lo que funciona mejor en GitHub Pages sin configuración extra de servidor para rutas internas.

## Seguridad recomendada

- Mantén Firestore cerrado con `firebase2.rules`.
- No guardes datos sensibles de miembros; esta app solo debe contener información del ministerio de música.
- Revisa periódicamente la colección `allowedEmails`.
- Considera habilitar Firebase App Check antes de producción.
- No guardes PDFs privados en `public/pdfs`, porque serán públicos en GitHub Pages.

## Pasos posteriores recomendados

- Probar links reales de Drive con **Ver PDFs del servicio**.
- Probar **Unir PDFs desde mi computadora** con varios PDFs.
- Probar `public/pdfs` con uno o dos archivos no privados.
- Revisar roles reales del equipo antes de cargar información.
- Importar el repertorio real sin letras con copyright no autorizadas.
- Activar backups/exportaciones periódicas de Firestore.
