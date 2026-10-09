# Lista de Turno

App web mobile-first (PWA) para organizar el trabajo diario de la cocina de una taquería.
El **rol es el puesto del día, no la persona**: cada día se asigna quién cubre Taquero,
Tortillero, Auxiliar y Cajero, y cada quien marca solo sus propias tareas de Apertura,
Servicio y Cierre. Todo se sincroniza en tiempo real con Supabase. Zona horaria: `America/Bogota`.

## Tecnología

- React + TypeScript + Vite (sin dependencias de UI).
- Supabase: Postgres con Row Level Security, Auth (correo para el administrador y sesión
  anónima + PIN para empleados) y Realtime.
- PWA: `manifest.webmanifest`, íconos y un service worker que guarda la app para abrir sin señal.

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor** ejecuta, en este orden, los dos archivos de `supabase/migrations/`:
   1. `20261009000000_esquema.sql`: tablas, seguridad, funciones y tiempo real.
   2. `20261009000100_datos_iniciales.sql`: Daniel (PIN 1111), Camila (2222), Junior (3333)
      y las tareas de los cuatro puestos.

   Con la CLI de Supabase también vale `supabase link` + `supabase db push`.
3. En **Authentication → Sign In / Providers** activa **Allow anonymous sign-ins**.
   Así entran los empleados: cada celular abre una sesión anónima que se vincula a la
   persona solo después de escribir su PIN.
4. Crea la cuenta del dueño en **Authentication → Users → Add user** (correo y contraseña,
   marcando *Auto Confirm User*) y dale permisos de administrador desde el SQL Editor:

   ```sql
   insert into public.administradores (user_id, nombre)
   select id, 'Don Carlos'            -- nombre que aparecerá como "definido por"
   from auth.users
   where email = 'dueno@mitaqueria.com';
   ```

### 2. Configurar y correr la app

```bash
cp .env.example .env      # pega la URL y la clave anon (Project Settings → API)
npm install
npm run dev               # desarrollo
npm run build             # genera dist/ para publicar
```

`dist/` se puede publicar en cualquier hosting estático (Vercel, Netlify, Cloudflare Pages…).
La navegación usa `#/ruta`, así que no hace falta configurar redirecciones. Para que se
pueda instalar en la pantalla de inicio el sitio debe servirse por HTTPS.

En el celular: abrir la página → menú del navegador → **Agregar a pantalla de inicio**.

## Cómo funciona

| Quién | Cómo entra | Qué puede hacer |
|---|---|---|
| Administrador | Correo y contraseña ("Soy el administrador") | Todo: asignar puestos, confirmar el día, editar/quitar tareas, gestionar el equipo y sus PIN, corregir días pasados |
| Empleado | Toca su nombre y escribe su PIN de 4 dígitos. La sesión queda guardada en el celular | Ver todo, marcar las tareas del puesto que cubre hoy, agregar tareas |

- **Distribución**: una persona por puesto por día. Si hoy no se ha guardado, se muestra la
  del último día como *"Igual que el 8 de octubre · sin confirmar"* sin escribir nada hasta
  que el administrador la confirme o la edite. Cada día confirmado queda en el historial y
  se puede corregir después desde **Historial**.
- **Marcas**: por persona + tarea + fecha, con la hora del servidor en Bogotá. Se reinician
  cada día y quedan guardadas en el historial. Un empleado solo marca tareas del puesto que
  cubre hoy (o de un puesto sin asignar) y solo desmarca las suyas.
- Al entrar, el empleado va directo a la pestaña de su puesto.
- **Quitar un empleado** lo desactiva: ya no puede entrar, pero el historial conserva su nombre.
- **Quitar una tarea** la oculta desde ese día. El historial de días anteriores sigue contando
  sus totales correctos.
- Cambiar el PIN de alguien cierra sus sesiones abiertas.

## Seguridad

- Los PIN se guardan con bcrypt (`pgcrypto`) en `empleados_pin`, una tabla sin ninguna
  política RLS: ningún cliente puede leerla.
- Tras 5 PIN incorrectos el empleado queda bloqueado 10 minutos (o hasta que el
  administrador le restablezca el PIN).
- Los miembros (administrador o empleado vinculado) solo pueden **leer** las tablas.
  Toda escritura pasa por funciones `security definer` (`marcar_tarea`, `guardar_distribucion`,
  `agregar_tarea`, `crear_empleado`…) que validan quién llama y qué puede hacer.
- Una sesión anónima sin PIN no ve nada; solo puede pedir la lista de nombres para entrar.

## Modelo de datos

| Tabla | Contenido |
|---|---|
| `empleados` | `id, nombre, activo` |
| `empleados_pin` | `empleado_id, pin_hash, intentos_fallidos, bloqueado_hasta` (privada) |
| `administradores` | `user_id` de Supabase Auth, `nombre` |
| `sesiones_empleado` | sesión anónima del celular → empleado |
| `tareas` | `rol, bloque (apertura/servicio/cierre), texto, orden, creado_por, creado_en, borrada_en` |
| `asignaciones` | `fecha` (única), `roles` jsonb `{rol: {empleado_id, nombre}}`, `definido_por, definido_en` |
| `marcas` | `fecha, empleado_id, nombre, tarea_id, rol, hora`, única por `(fecha, empleado_id, tarea_id)` |

## Estructura

```
src/
  App.tsx               sesión y pantalla de entrada
  lib/turno.tsx         datos del día + suscripción en tiempo real
  lib/fecha.ts          fechas y horas en America/Bogota
  vistas/               Entrar, Hoy, Puesto, Historial, Equipo, Turno (encabezado y pestañas)
  componentes/          Distribución, barras, avisos, doble confirmación
  estilos.css           marca: rojo #E00000, naranja #FF5B00, negro y blanco
public/
  manifest.webmanifest, sw.js, icons/
supabase/migrations/    esquema y datos iniciales
scripts/generar-iconos.mjs   regenera los PNG desde icons/icono.svg (npm run icons)
```
