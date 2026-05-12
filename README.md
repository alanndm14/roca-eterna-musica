# Roca Eterna Música

Web app tipo PWA para organizar el ministerio de música de la iglesia Roca Eterna: repertorio, programación, letras, tonos, responsables, ensayos, historial y estadísticas simples.

## Stack

- React + Vite
- Tailwind CSS
- Firebase Authentication con Google Sign-In
- Cloud Firestore
- Firebase Storage para PDFs subidos a la app
- Framer Motion
- lucide-react
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
4. Copia `.env.example` como `.env`.
5. Llena las variables `VITE_FIREBASE_*` con la configuración web de tu app Firebase.
6. En `VITE_INITIAL_ADMIN_EMAILS`, escribe tu correo de Google.
7. En `firebase2.rules`, confirma que tu correo admin inicial esté en `bootstrapAdminEmails`.
8. Publica las reglas:

```bash
firebase deploy --only firestore:rules
```

Si vas a subir PDFs a la app y generar PDFs combinados, habilita Firebase Storage y publica también:

```bash
firebase deploy --only storage
```

Las API keys web de Firebase pueden estar en el frontend. La protección real está en Firebase Authentication y Firestore Security Rules. No agregues service accounts ni claves privadas en esta app.

## Modelo de acceso

- `admin`: crea, edita, borra, configura usuarios y ajustes.
- `editor`: crea y edita cantos/programaciones.
- `viewer`: solo ve información.

El primer admin se crea cuando inicia sesión con un correo incluido en `VITE_INITIAL_ADMIN_EMAILS` y en `firebase2.rules`. Después, desde Configuración, el admin puede agregar correos a `allowedEmails` con rol y estado activo.

Si una persona inicia sesión con Google pero su correo no está autorizado, verá la pantalla “Acceso no autorizado”.

## Estructura de Firestore

```text
users/{uid}
allowedEmails/{email}
songs/{songId}
schedules/{scheduleId}
settings/main
```

`allowedEmails` permite autorizar correos antes de conocer el `uid` de Firebase Auth. Cuando el usuario autorizado inicia sesión, la app crea su perfil en `users/{uid}`.

## Datos de ejemplo

La app incluye 5 cantos y 2 programaciones de ejemplo. En modo demo local aparecen automáticamente. Con Firebase conectado, un admin puede cargarlos desde Configuración con “Cargar datos de ejemplo”.

Los cantos de ejemplo no incluyen letras protegidas por copyright; solo placeholders editables.

## PDFs de letra y acordes

El flujo recomendado es guardar cada canto como un PDF separado en Google Drive y pegar el link en el campo **PDF de letra y acordes**.

Usa un link compartido de Drive como:

```text
https://drive.google.com/file/d/FILE_ID/view?usp=sharing
```

La app intenta convertirlo automáticamente a:

```text
https://drive.google.com/file/d/FILE_ID/preview
```

Ese link permite usar “Ver dentro de la app”. Si Google Drive bloquea la vista previa, usa “Abrir PDF”.

### Subir PDFs a Firebase Storage

Para que la app pueda generar un PDF combinado del servicio, sube cada PDF directamente desde el formulario del canto:

1. Habilita Firebase Storage en Firebase Console.
2. Verifica que `.env` tenga `VITE_FIREBASE_STORAGE_BUCKET`.
3. Publica `storage.rules` con `firebase deploy --only storage`.
4. En Repertorio, edita un canto.
5. En **Archivos y enlaces**, usa **Subir PDF a la app** y selecciona un `.pdf`.
6. Guarda el canto.

La app guarda internamente `storagePath`, `storagePdfUrl`, `originalFileName`, `uploadedAt` y `uploadedBy`.

Los usuarios `viewer` pueden leer PDFs. Solo `admin` y `editor` pueden subir, reemplazar o eliminar PDFs.

### PDF combinado del servicio

En Vista para músicos, **Descargar PDFs del servicio** intenta combinar en orden los PDFs subidos a Firebase Storage usando `pdf-lib`.

- Si todos los cantos tienen PDF subido a la app, descarga un PDF completo.
- Si algunos cantos solo tienen Drive o no tienen PDF, muestra incluidos/omitidos.
- Si al menos un PDF se pudo incluir, permite descargar un PDF parcial.
- Los PDFs de Drive no se fusionan por restricciones normales de permisos/CORS.

## Importar repertorio

En Configuración > Importar repertorio puedes pegar CSV/TSV o cargar archivo `.csv`/`.tsv`.

Columnas esperadas:

```text
id, nombre, tema, otros_temas, categoria, cantado, tonalidad, capo, tonalidad_con_capo, cambio_de_tono, revision_musical, revision_keynote, revision_pdf, formato, comentario
```

Notas:

- `cantado` y `cambio_de_tono` aceptan `si/no`.
- `otros_temas` puede traer varios valores separados por coma.
- Si `tonalidad_con_capo` viene vacío, la app la calcula con la preferencia de sostenidos/bemoles.
- Si un canto ya existe con el mismo nombre, puedes omitirlo o actualizarlo.
- La importación no borra datos existentes.

## Publicar en GitHub Pages

1. Cambia `base` en `vite.config.js`:

```js
base: "/nombre-del-repo/"
```

2. En Firebase Authentication, agrega tu dominio de GitHub Pages a “Authorized domains”.
3. Ejecuta:

```bash
npm run deploy
```

La app usa `HashRouter`, por lo que funciona mejor en GitHub Pages sin configuración extra de servidor para rutas internas.

## Seguridad recomendada

- Mantén Firestore cerrado con `firestore.rules`.
- No guardes datos sensibles de miembros; esta app solo debe contener información del ministerio de música.
- Revisa periódicamente la colección `allowedEmails`.
- Considera habilitar Firebase App Check antes de producción.
- Usa reglas más estrictas si separas iglesias, ministerios o ambientes.

## Pasos posteriores recomendados

- Reemplazar el logo placeholder por el logo oficial si lo tienes.
- Crear un proyecto Firebase de producción y otro de pruebas.
- Revisar roles reales del equipo antes de cargar información.
- Agregar App Check.
- Importar el repertorio real sin letras con copyright no autorizadas.
- Activar backups/exportaciones periódicas de Firestore.
