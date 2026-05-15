# Roca Eterna Musica

PWA para organizar el ministerio de musica de Roca Eterna: repertorio, programacion, PDFs de letra/acordes, tonos, lideres de adoracion, historial, estadisticas y preparacion para musicos.

## Stack

- React + Vite
- Tailwind CSS
- Firebase Authentication con Google Sign-In
- Cloud Firestore
- Framer Motion
- lucide-react
- Recharts
- pdf-lib para unir PDFs locales en el navegador
- pdfjs-dist para indexar texto de PDFs locales
- PWA preparada para GitHub Pages

## Primer uso

```bash
npm install
npm run dev
```

Para compilar:

```bash
npm run build
```

## Firebase

1. Crea un proyecto en Firebase Console.
2. Habilita Google Sign-In en Authentication.
3. Crea Firestore en modo produccion.
4. Llena `.env` con las variables `VITE_FIREBASE_*`.
5. Agrega tu correo en `VITE_INITIAL_ADMIN_EMAILS`.
6. Confirma el mismo correo en `firebase2.rules`, dentro de `bootstrapAdminEmails`.
7. Publica las reglas:

```bash
firebase deploy --only firestore:rules
```

Firebase Storage no es requisito para esta version. No uses claves privadas ni service accounts en el frontend.

## Accesos y preferencias

La app separa dos cosas:

- Configuracion institucional: nombre de iglesia, nombre de app, logo, tonalidad preferida global.
- Preferencias personales: modo claro/oscuro/sistema, color personal, sidebar, onboarding y nombre visible.

Cada usuario puede cambiar sus propias preferencias y su nombre visible. El rol solo lo puede asignar un admin.

## Auditoria

La coleccion `auditLogs` registra acciones importantes:

- creacion, edicion y eliminacion de cantos
- creacion, edicion y eliminacion de programaciones
- cambios de temas
- importaciones
- cambios de accesos y roles
- cambios de configuracion global

La pagina **Auditoria** permite filtrar y exportar CSV. La restauracion queda preparada como accion manual/proxima version.

## Changelog

El changelog de la app vive en:

```text
src/data/changelog.js
```

La pagina **Actualizaciones** muestra version actual, agregados, cambios, correcciones y pendientes. No se debe confundir con `auditLogs`: changelog es codigo/app; auditLogs son acciones de usuarios sobre datos.

## PDFs sin Firebase Storage

### Google Drive

Campo recomendado: **PDF de letra y acordes**.

Pega un link compartido:

```text
https://drive.google.com/file/d/FILE_ID/view?usp=sharing
```

La app intenta crear el preview:

```text
https://drive.google.com/file/d/FILE_ID/preview
```

Drive sirve bien para ver o abrir PDFs, pero no es confiable para fusionarlos desde el navegador por permisos/CORS.

### PDFs locales en GitHub Pages

Coloca PDFs no privados en:

```text
public/pdfs/
```

En cada canto puedes escribir cualquiera de estas rutas:

```text
pdfs/canto.pdf
/pdfs/canto.pdf
/roca-eterna-musica/pdfs/canto.pdf
https://tu-dominio/pdfs/canto.pdf
```

La app resuelve la ruta usando `import.meta.env.BASE_URL` para que funcione en GitHub Pages y en dominio propio. Si falla, usa **Probar PDF local** desde el detalle del canto. GitHub Pages distingue mayusculas, minusculas, espacios, acentos y extension `.pdf`.

Advertencia: todo lo que pongas en `public/pdfs` queda publico al publicar GitHub Pages.

## Como comprobar que un archivo publico si esta publicado

Antes de usar un PDF o logo en la app, abre la URL directa en el navegador.

Logo:

```text
https://alanndm14.github.io/roca-eterna-musica/icons/cropped-LOGO-IBRE-5-1.png
```

PDF:

```text
https://alanndm14.github.io/roca-eterna-musica/pdfs/Glorificate.pdf
```

Si no abre, la app tampoco podra usarlo. Posibles causas:

- el archivo esta en `main/public/...`, pero GitHub Pages aun no publico `dist`
- el deploy no corrio o fallo
- GitHub Pages esta publicando otra rama
- el nombre no coincide exactamente
- hay diferencia de mayusculas/minusculas
- la PWA esta sirviendo cache vieja
- falta volver a ejecutar build/deploy

Los archivos dentro de `public` no se escriben con `public/` en la URL publica. Por ejemplo:

```text
public/pdfs/Glorificate.pdf -> /pdfs/Glorificate.pdf
public/icons/logo.png -> /icons/logo.png
```

GitHub Pages distingue mayusculas y minusculas: `Glorificate.pdf` no es igual que `glorificate.pdf`. Si un archivo tiene espacios, parentesis o acentos, la app intenta codificar la URL, pero para evitar problemas conviene renombrar con guiones:

```text
glorificate.pdf
te-alabamos.pdf
tu-gloria.pdf
logo-roca-eterna.png
```

En Configuracion y en Detalle de canto usa **Diagnosticar archivo** para ver ruta guardada, ruta normalizada, URL final, status HTTP, content-type, tamaño y si se recibio HTML en lugar del archivo.

### Unir PDFs

En Vista para musicos hay dos flujos:

- **Unir PDFs desde mi computadora**: seleccionas varios PDFs locales, los reordenas y se unen solo en tu navegador. No se suben a la nube.
- **Unir PDFs del servicio desde la app**: solo usa `localPdfPath` que apunte a `public/pdfs`.

Los PDFs de Drive se conservan para vista previa y enlaces, pero no se asumen fusionables.

## Busqueda dentro de PDFs

En Configuracion puedes usar **Indexar textos de PDFs locales**.

Condiciones:

- Solo funciona con PDFs locales accesibles por `localPdfPath`.
- No depende de Drive.
- Si el PDF es escaneado como imagen, probablemente no tendra texto extraible sin OCR.
- La app guarda texto/tokens normalizados para busqueda, no muestra letras completas extraidas.

El buscador del repertorio incluye nombre, tema, tono, comentario y texto indexado del PDF.

## Programacion

Servicios normales:

- Miercoles de oracion: 19:00
- Domingo manana: 11:00
- Domingo tarde: 17:00
- Especial / otro: hora manual

El formulario incluye buscador de cantos. Evita duplicados y muestra tema, tono y capo.

Desde el detalle de un canto puedes usar **Agregar a la siguiente programacion**. Si no existe programacion futura, la app ofrece crear el siguiente servicio normal con ese canto incluido.

## Notificaciones

La app crea notificaciones internas cuando se crea una programacion futura. Los usuarios las ven en la campana del header y pueden marcarlas como leidas.

Push notifications reales quedan como fase futura porque requieren soporte del navegador, service worker y un backend seguro/Cloud Functions para enviar mensajes sin exponer llaves privadas.

## Logo institucional

En Configuracion puedes usar:

- URL publica de imagen
- ruta local del repo, por ejemplo `/logos/logo-oficial.png`
- logo por defecto

Para rutas locales, coloca el archivo en:

```text
public/logos/
```

La app usa `object-contain` y fallback si el logo falla. Para iconos PWA/manifest, actualiza los assets del proyecto y vuelve a compilar.

## Guia interactiva

La guia aparece despues de la bienvenida la primera vez que un usuario autorizado entra. Usa overlay y spotlight para resaltar navegacion, repertorio, programacion, Vista para musicos, estadisticas y configuracion.

Se puede abrir otra vez desde:

- icono de ayuda en el header
- Configuracion > Ayuda
- menu Mas en movil

El estado se guarda en `users/{uid}.onboardingCompleted` y usa localStorage como respaldo.

## GitHub Pages

Revisa `vite.config.js`:

```js
base: "/roca-eterna-musica/"
```

En Firebase Authentication agrega tu dominio de GitHub Pages en Authorized domains.

### Variables necesarias en GitHub Actions Secrets

Para que el build publicado en GitHub Pages tenga Firebase activo, agrega estos secrets en GitHub:

```text
Settings > Secrets and variables > Actions > New repository secret
```

Secrets requeridos:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

Secret recomendado para bootstrap de administradores:

```text
VITE_INITIAL_ADMIN_EMAILS
```

El workflow revisa estos nombres sin imprimir valores. Solo muestra `presente` o `falta`. Si falta una variable `VITE_FIREBASE_*`, el deploy se detiene para no publicar una app sin Google Sign-In.

El modo demo local queda oculto en produccion. Solo se muestra en desarrollo local o si agregas explicitamente:

```text
VITE_ENABLE_DEMO_MODE=true
```

Publicar:

```bash
npm run deploy
```

El repo tambien incluye un workflow en `.github/workflows/deploy-pages.yml`. En cada push a `main`, GitHub Actions instala dependencias, verifica de forma segura que los secrets de Firebase existan, ejecuta `npm run build` con esas variables, verifica que `dist/pdfs/Glorificate.pdf` y `dist/icons/cropped-LOGO-IBRE-5-1.png` existan, y publica `dist` en la rama `gh-pages`.

La app usa `HashRouter`, asi que las rutas internas funcionan en GitHub Pages.

Si la PWA muestra una version vieja, entra a Configuracion > Ayuda > Actualizar app, prueba en incognito, borra datos del sitio o desregistra el service worker desde DevTools.

## Seguridad

- Mantener Firestore protegido con `firebase2.rules`.
- No guardar datos sensibles de miembros.
- `viewer` solo lectura.
- `editor` puede crear/editar repertorio y programaciones.
- `admin` administra accesos, roles y configuracion global.
- Cada usuario solo puede editar sus propias preferencias.
- No guardar PDFs privados en `public/pdfs`.
- Considera App Check antes de produccion.
