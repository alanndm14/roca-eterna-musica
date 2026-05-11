# Roca Eterna Música

Web app tipo PWA para organizar el ministerio de música de la iglesia Roca Eterna: repertorio, programación, letras, tonos, responsables, ensayos, historial y estadísticas simples.

## Stack

- React + Vite
- Tailwind CSS
- Firebase Authentication con Google Sign-In
- Cloud Firestore
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
