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
- pdf-lib para intentar unir PDFs del servicio
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
themes/{themeId}
settings/main
```

`allowedEmails` permite autorizar correos antes de conocer el `uid` de Firebase Auth. Cuando el usuario autorizado inicia sesión, la app crea su perfil en `users/{uid}`.

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

Ese link permite usar “Ver dentro de la app”. Si Google Drive bloquea la vista previa, usa “Abrir PDF”.

### Intentar unir PDFs del servicio

En Vista para músicos, **Intentar unir PDFs del servicio** usa `pdf-lib` e intenta descargar los PDFs en el orden de la programación.

La app intenta:

- detectar links de Google Drive;
- convertirlos a `https://drive.google.com/uc?export=download&id=FILE_ID`;
- descargar PDFs directos que terminen en `.pdf`;
- unir los PDFs que sí se pudieron leer;
- descargar un PDF completo o parcial.

Limitación importante: Google Drive puede bloquear descargas desde el navegador por permisos, CORS o pantallas intermedias. Si eso ocurre, la app no se rompe: muestra incluidos/omitidos y permite usar **Ver PDFs del servicio** o abrir los enlaces individualmente.

Firebase Storage no es requisito para este flujo. Si más adelante activas Storage, la app conserva campos compatibles para PDFs subidos, pero el uso principal actual puede hacerse solo con Drive.

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
- Usa reglas más estrictas si separas iglesias, ministerios o ambientes.

## Pasos posteriores recomendados

- Probar links reales de Drive con “Ver PDFs del servicio” e “Intentar unir PDFs del servicio”.
- Revisar roles reales del equipo antes de cargar información.
- Agregar App Check.
- Importar el repertorio real sin letras con copyright no autorizadas.
- Activar backups/exportaciones periódicas de Firestore.
