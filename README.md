# Simulador de Innovación

Simulador de negocios para la materia de Innovación (UAGRM). Esta versión reemplaza Google Apps Script + Google Sheets por:

- **Pantalla**: página estática en `docs/` publicada con GitHub Pages.
- **Servidor**: Edge Function `api` de Supabase, que ejecuta **la misma lógica** de Apps Script (`fuente/*.gs`) sin cambios.
- **Datos**: base de datos Postgres de Supabase (una tabla por cada hoja del libro anterior).

## Cómo está organizado

| Carpeta / archivo | Qué contiene |
|---|---|
| `fuente/` | Código original del simulador (Engine, Params, Informes, Proyectos, Evaluacion, Acceso, Code, Db, Setup y las pantallas .html). **Aquí se hacen los cambios.** |
| `build.js` | Genera `docs/index.html` y `supabase/functions/api/gas_codigo.js` a partir de `fuente/`. |
| `docs/` | Lo que publica GitHub Pages: `index.html`, `config.js` (dirección del servidor y clave publicable) e `img/` (logos opcionales). |
| `supabase/migrations/0001_esquema.sql` | Tablas, seguridad y funciones de la base de datos. |
| `supabase/functions/api/` | Edge Function: `index.ts` (entrada), `nucleo.js` (imita los servicios de Google sobre Postgres), `http.js`, `origen_codigo.js` (qué versión de la lógica carga). |
| `tools/semilla.mjs` | Crea los datos iniciales (Config, Parámetros y superadministrador con contraseña temporal). |
| `tools/origen.mjs` | Fija la versión de `gas_codigo.js` que usa la Edge Function. |
| `test/` | Pruebas: originales (`acceso.js`, `etapa1–4.js`, `integration.js`) y del servidor nuevo (`nucleo.test.mjs`, `ui.test.mjs`). |

## Seguridad

- Las tablas tienen RLS activado, sin políticas, y sin permisos para `anon` y `authenticated`: con la clave publicable nadie puede leerlas ni modificarlas.
- Solo la Edge Function (con la service role key, que vive únicamente en Supabase) llama a las funciones `sim_cargar`, `sim_aplicar`, `sim_tomar_bloqueo` y `sim_soltar_bloqueo`.
- El acceso es el mismo de la versión 2.3: contraseñas con SHA-256 y sal, bloqueo tras 5 intentos fallidos durante 15 minutos, sesiones de 6 horas, invitaciones de 72 horas.
- La Edge Function descarga la lógica (`gas_codigo.js`) de GitHub en un commit exacto y verifica su SHA-256 antes de usarla.

## Publicación (una sola vez)

1. **Base de datos**: aplicar `supabase/migrations/0001_esquema.sql` (SQL Editor de Supabase o `apply_migration`).
2. **Datos iniciales**: en una computadora con Node 20+, ejecutar `node tools/semilla.mjs semilla.sql` y pegar el contenido de `semilla.sql` en el SQL Editor. Anotar la contraseña temporal que aparece en pantalla (no se guarda en ningún archivo). **No subir `semilla.sql` al repositorio.**
3. **Edge Function**: desplegar `supabase/functions/api` con el nombre `api` y **verify_jwt = false** (la función usa su propio sistema de acceso). Archivos: `index.ts`, `nucleo.js`, `http.js`, `origen_codigo.js`.
   Variables opcionales (Edge Functions → Secrets):
   - `ORIGENES_PERMITIDOS`: orígenes que pueden llamar a la API, separados por comas. Por defecto `https://atilayasociados.github.io`.
   - `URL_PUBLICA`: dirección de la pantalla (se usa en los enlaces de invitación). Por defecto `https://atilayasociados.github.io/simuladordeinnovacion/`.
   - `CORREO_SUPERADMIN`: por defecto `jdavidatila@gmail.com`.
4. **GitHub Pages**: Settings → Pages → Deploy from a branch → `main` / carpeta `/docs`.
5. **Logos (opcional)**: subir `docs/img/logo1.png`, `logo2.png`, `logo3.png`. Si no existen, la pantalla muestra el nombre de cada institución.
6. Ingresar en `https://atilayasociados.github.io/simuladordeinnovacion/?vista=docente` con `jdavidatila@gmail.com` y la contraseña temporal; el sistema obliga a cambiarla.

### Cambiar la dirección pública

Si se cambia el nombre del repositorio o se usa un dominio propio: actualizar `URL_PUBLICA` y `ORIGENES_PERMITIDOS` en los secretos de la Edge Function. `docs/config.js` no cambia (apunta a Supabase).

## Mantenimiento (cambiar el simulador)

1. Editar los archivos de `fuente/` (nunca `docs/index.html` ni `gas_codigo.js` a mano).
2. `node build.js`
3. Probar: `node test/nucleo.test.mjs` y `node test/ui.test.mjs` (y las pruebas originales de `test/`).
4. Commit y push. Si cambió algún `.gs`: `node tools/origen.mjs`, commit, push y volver a desplegar la Edge Function.
5. Evitar publicar durante una clase.

## Límites conocidos

- Plan gratuito de Supabase: el proyecto se pausa tras 7 días sin uso (se reactiva desde el panel) y la Edge Function tiene límite de CPU por petición. Procesar un trimestre con 10 equipos tarda unos 20 ms de CPU en las pruebas locales.
- Las peticiones que modifican una simulación se atienden de una en una (bloqueo por simulación); las de lectura no esperan.
- La región del proyecto es us-east-1: cada acción tarda lo que tarda la red desde Bolivia (aprox. 150–300 ms) además del procesamiento.

## Publicación automática del servidor (GitHub Actions)

Cada `push` a `main` que cambie `supabase/functions/api/**` publica la Edge Function `api` en el proyecto
`xlkjssypdayyaxwjokry` (`.github/workflows/desplegar-api.yml`). También se puede lanzar a mano desde la pestaña
**Actions → Publicar Edge Function → Run workflow**. Usa el secreto `SUPABASE_ACCESS_TOKEN` del repositorio
(token personal de Supabase con permiso solo de Edge Functions read-write sobre este proyecto).

Flujo para cambiar la lógica del simulador: editar `fuente/` → `node build.js` → commit y push →
`node tools/origen.mjs` → commit y push (este segundo push dispara la publicación).
