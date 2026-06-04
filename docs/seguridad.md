# Seguridad de Roca Eterna Musica

Esta guia resume las protecciones actuales y los pasos manuales necesarios para produccion.

## Firebase Security Rules

La app debe tratar el frontend como una interfaz, no como la barrera de seguridad. Las decisiones reales viven en:

- `firebase2.rules`
- `storage.rules`
- `api/sendPushNotification.js`

Reglas esperadas:

- Usuario no autenticado: sin lectura ni escritura.
- Usuario autenticado pero no autorizado: sin acceso.
- Admin: administra repertorio, programaciones, configuracion, roles y auditoria.
- Editor: edita repertorio, temas y programaciones; no cambia roles ni configuracion institucional critica.
- Viewer: lectura permitida; sin escritura en repertorio, roles ni configuracion.
- Nadie puede cambiar su propio `role`.
- Nadie puede borrar o modificar auditoria.
- Notificaciones internas: solo admin/editor pueden crear; usuarios solo pueden marcar lectura propia.

## Pruebas en Rules Playground

Probar estas combinaciones:

1. Sin `request.auth`
   - Leer `/songs/{id}`: debe negar.
   - Escribir `/songs/{id}`: debe negar.

2. Usuario autenticado no autorizado
   - Sin doc en `users` y sin `authorizedEmails`: debe negar lectura.

3. Viewer autorizado
   - Leer `/songs/{id}`: debe permitir.
   - Crear `/songs/{id}`: debe negar.
   - Actualizar `/schedules/{id}`: debe negar.
   - Actualizar su propio `/users/{uid}` cambiando `role`: debe negar.

4. Editor autorizado
   - Crear/editar canto con `title`: debe permitir.
   - Crear canto sin `title`: debe negar.
   - Crear/editar programacion con `date`: debe permitir.
   - Crear programacion sin `date`: debe negar.
   - Cambiar `/settings/main`: debe negar.
   - Cambiar `/authorizedEmails/{email}`: debe negar.

5. Admin autorizado
   - Cambiar roles: debe permitir.
   - Cambiar configuracion institucional: debe permitir.
   - Leer auditoria: debe permitir.
   - Borrar auditoria: debe negar.

## Firebase App Check

Preparado en frontend de forma opcional.

Para activarlo:

1. Firebase Console.
2. Proyecto `web-iglesia-musica`.
3. `Build > App Check`.
4. Registra la app web.
5. Proveedor recomendado: reCAPTCHA v3 o reCAPTCHA Enterprise.
6. Agrega el dominio:

   `musica.rocaeternamexico.com.mx`

7. Copia la site key.
8. En GitHub Actions Secrets agrega:

   `VITE_FIREBASE_APPCHECK_SITE_KEY`

9. Publica de nuevo.
10. Primero monitorea en modo no forzado.
11. Cuando veas trafico valido, activa enforcement gradualmente en:

   - Firestore
   - Storage
   - Authentication si aplica en tu configuracion

No configures `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` en produccion. Ese valor es solo local.

## Vercel backend push

Variables necesarias:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `PUSH_ALLOWED_ORIGIN=https://musica.rocaeternamexico.com.mx`
- `PUSH_APP_BASE_URL=https://musica.rocaeternamexico.com.mx`
- `REQUIRE_APP_CHECK=true` cuando ya este probado App Check

El endpoint debe:

- Rechazar requests sin ID token.
- Validar token con Firebase Admin.
- Confirmar usuario activo con rol admin/editor.
- Validar origen.
- No imprimir tokens completos.
- No imprimir secrets.
- Aplicar deduplicacion por `notificationId`.
- Aplicar rate-limit basico por usuario.

Recomendacion: deja `REQUIRE_APP_CHECK` sin activar hasta confirmar que la app ya envia `X-Firebase-AppCheck` correctamente. Despues activalo en Vercel y redeploya.

## GitHub

Recomendado:

- Activar Dependabot alerts.
- Activar Secret scanning si esta disponible.
- Requerir 2FA para administradores del repositorio.
- Activar branch protection para `main`.
- Pedir pull request antes de produccion cuando haya mas colaboradores.
- Revisar que `PAGES_CUSTOM_DOMAIN` exista como secret.

## Datos sensibles

La app no debe almacenar:

- Contrasenas.
- Datos financieros.
- Direcciones privadas.
- Datos sensibles de miembros.

Datos que si existen y deben tratarse con cuidado:

- Correos autorizados.
- Roles.
- Nombres visibles.
- Historial de cambios.
- Tokens FCM, que deben guardarse solo en documentos protegidos por usuario.

## Auditoria esperada

Registrar:

- Crear/editar/eliminar canto.
- Crear/editar/eliminar programacion.
- Cambiar acceso o rol.
- Cambiar configuracion institucional.
- Crear/restaurar desde auditoria.
- Indexar PDFs/OCR.
- Cerrar servicio y seguimiento posterior.

La auditoria se puede leer por admin y no se puede editar ni borrar desde cliente.
