# Dominio propio para Roca Eterna Musica

Esta guia deja la app lista para pasar de:

`https://alanndm14.github.io/roca-eterna-musica/`

a un subdominio de la iglesia, por ejemplo:

`https://musica.tudominio.org/`

Para el dominio actual de la iglesia, la opcion recomendada es:

`https://musica.rocaeternamexico.com.mx/`

## Recomendacion

Usa un subdominio, no el dominio principal de la iglesia.

Buenas opciones:

- `musica.tudominio.org`
- `cantos.tudominio.org`
- `ministeriomusica.tudominio.org`
- `musica.rocaeternamexico.com.mx`

No conviene usar `www.tudominio.org` si ese ya es el sitio WordPress.

## 1. DNS del dominio de la iglesia

En el panel donde se administra el DNS del dominio de la iglesia, crea este registro:

| Tipo | Nombre / Host | Valor / Destino | TTL |
| --- | --- | --- | --- |
| CNAME | `musica` | `alanndm14.github.io` | Automatico o 1 hora |

Notas:

- Si el subdominio sera `musica.tudominio.org`, el host normalmente es solo `musica`.
- Para Roca Eterna Mexico, el subdominio recomendado queda como `musica.rocaeternamexico.com.mx`.
- El destino debe ser `alanndm14.github.io`, no el sitio WordPress.
- Si el DNS esta en Cloudflare, deja el registro en modo DNS only al principio para que GitHub emita HTTPS sin problemas.

## 2. GitHub Pages

En GitHub:

1. Abre el repositorio `alanndm14/roca-eterna-musica`.
2. Entra a `Settings`.
3. Entra a `Pages`.
4. En `Custom domain`, escribe el subdominio completo:

   `musica.tudominio.org`

5. Guarda.
6. Espera a que GitHub verifique el DNS.
7. Cuando aparezca disponible, activa `Enforce HTTPS`.

## 3. Secreto de GitHub Actions

Para que el build use rutas de dominio propio y genere el `CNAME` automaticamente:

1. En GitHub, entra a `Settings`.
2. Entra a `Secrets and variables`.
3. Entra a `Actions`.
4. Crea un secret nuevo:

   Nombre:

   `PAGES_CUSTOM_DOMAIN`

   Valor:

   `musica.tudominio.org`

5. Vuelve a ejecutar el workflow `Deploy GitHub Pages`.

Cuando este secret existe, la app se compila con base `/` en lugar de `/roca-eterna-musica/`.

## 4. Firebase Authentication

Para que el login con Google funcione en el nuevo subdominio:

1. Abre Firebase Console.
2. Entra al proyecto `web-iglesia-musica`.
3. Ve a `Authentication`.
4. Entra a `Settings`.
5. Busca `Authorized domains`.
6. Agrega:

   `musica.tudominio.org`

No quites todavia `alanndm14.github.io`; dejalo mientras confirmas que todo funciona.

## 5. Vercel / backend push

Si el backend de push esta en Vercel, actualiza sus variables para aceptar el nuevo origen.

En Vercel:

1. Abre el proyecto del backend.
2. Entra a `Settings`.
3. Entra a `Environment Variables`.
4. Ajusta o agrega:

   `PUSH_ALLOWED_ORIGIN=https://musica.tudominio.org`

   `PUSH_APP_BASE_URL=https://musica.tudominio.org`

5. Redeploy del backend.

Si quieres mantener temporalmente ambos origenes, revisa primero si el backend acepta lista separada por comas. Si no, usa el dominio nuevo como principal cuando hagas el cambio.

## 6. WordPress

En el sitio WordPress de la iglesia no se hospeda la app. Solo agrega acceso visible:

1. Entra al admin de WordPress.
2. Ve a `Apariencia > Menus`.
3. Agrega un enlace personalizado:

   URL: `https://musica.tudominio.org/`

   Texto: `Ministerio de Musica` o `Roca Eterna Musica`

4. Guarda el menu.

## 7. Verificacion final

Despues del deploy:

1. Abre `https://musica.tudominio.org/`.
2. Confirma que no redirige a `/roca-eterna-musica/`.
3. Confirma que el login con Google abre y regresa bien.
4. Confirma que la PWA se puede instalar.
5. Confirma que `manifest.webmanifest` carga desde:

   `https://musica.tudominio.org/manifest.webmanifest`

6. Confirma que el service worker carga desde:

   `https://musica.tudominio.org/sw.js`

7. Confirma una notificacion de prueba.
8. Confirma una programacion nueva con push real.

## 8. Si algo falla

### La app abre pero se ve en blanco

Revisa que el secret `PAGES_CUSTOM_DOMAIN` exista y que el workflow se haya ejecutado despues de crearlo.

### Login de Google falla

Falta agregar el subdominio en Firebase Authentication > Authorized domains.

### No hay push

Revisa `PUSH_ALLOWED_ORIGIN` y `PUSH_APP_BASE_URL` en Vercel y redeploya el backend.

### GitHub no deja activar HTTPS

Espera la propagacion del DNS. Puede tardar desde minutos hasta algunas horas. Verifica que el CNAME apunte a `alanndm14.github.io`.

## 9. Vuelta atras rapida

Si necesitas volver temporalmente a GitHub Pages normal:

1. Quita o vacia el secret `PAGES_CUSTOM_DOMAIN`.
2. Vuelve a ejecutar `Deploy GitHub Pages`.
3. La app volvera a compilar con base `/roca-eterna-musica/`.
