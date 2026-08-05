# Evaluación de Sucursales

Web app (Next.js + Supabase) para la evaluación mensual de 25 sucursales: checklist de imagen/mantenimiento por categoría, seguimiento a pendientes con bitácora de fechas, medición de puntualidad de envío, y dashboards.

Ciclo mensual automatizado (día 1 y día 27, ver `src/app/api/cron/daily/route.ts`):

- **Día 1**: se crea la evaluación "inicial" del mes y se envía recordatorio (correo + push) a cada sucursal. Se cierra como "no enviado" la evaluación "seguimiento" del mes anterior si seguía pendiente.
- **Día 27**: se crea la evaluación "seguimiento" y se envía recordatorio. Se cierra como "no enviado" la "inicial" del mes en curso si seguía pendiente.
- **Resto de días**: si hay evaluaciones pendientes vencidas, se envía una alerta de atraso.

Fórmulas de negocio (documentadas y verificadas contra `DASHBOARD EDIFICIOS.xlsx` en `scripts/verify-scoring.ts`):

- `score categoría = Σ(valor × peso) / Σ(peso)`
- `score evaluación = promedio de los scores de categoría`
- `puntualidad envío = max(0, 1 − 0.03 × días de retraso)`, `0` si no se envía
- `puntualidad del mes = promedio(puntualidad inicial, puntualidad seguimiento)`
- `calificación final = promedio(score de seguimiento, puntualidad del mes)`

## Puesta en marcha (cuentas gratuitas que debes crear tú mismo)

1. **Supabase** (base de datos + autenticación): crea un proyecto gratis en [supabase.com](https://supabase.com). En el SQL Editor, ejecuta en orden los archivos de `supabase/migrations/` (0001_schema.sql, 0002_rls.sql, 0003_seed.sql). Copia `Project URL`, `anon public key` y `service_role key` desde *Project Settings → API*.
2. **Usuarios**: en Supabase → Authentication, crea una cuenta por cada sucursal (26... en este momento el Excel trae 25, ver nota abajo) y una para ti como admin. Después, para cada usuario, inserta su fila en la tabla `profiles` con `role` (`admin` o `branch`) y, si es de sucursal, su `branch_id` — puedes hacerlo desde el Table Editor o con SQL:
   ```sql
   insert into profiles (id, role, branch_id, full_name, email)
   values ('<uuid del usuario en auth.users>', 'branch', (select id from branches where code = 'BJX'), 'BJX', 'correo@sucursal.com');
   ```
3. **Resend** (correo): crea cuenta gratis en [resend.com](https://resend.com), genera un API key.
4. **Web Push**: genera tus llaves VAPID con `npx web-push generate-vapid-keys` y guarda la pública/privada.
5. Copia `.env.example` a `.env.local` y llena todos los valores (incluye un `CRON_SECRET` — cualquier cadena aleatoria).
6. `npm install` y `npm run dev` para probar localmente en `http://localhost:3000`.
7. **Despliegue**: crea cuenta gratis en [vercel.com](https://vercel.com), importa este repo, configura las mismas variables de entorno del `.env.local` en el proyecto de Vercel (agrega también `CRON_SECRET` en *Settings → Cron Jobs* si Vercel lo pide). El cron ya está definido en `vercel.json` (corre 1 vez al día; dentro decide si es día 1, 27 u otro).

### Nota sobre el número de sucursales

El Excel de origen (`DASHBOARD EDIFICIOS.xlsx`) trae **25** sucursales, no 26. `supabase/migrations/0003_seed.sql` sembró esas 25 con `name` igual a su código (ej. `BJX`); edita esa migración (o la tabla `branches` directo en Supabase) para agregar la sucursal faltante o poner nombres reales.

### Iconos

`public/icons/icon-192.png` y `icon-512.png` son placeholders (un cuadro sólido). Reemplázalos con el logo real antes de instalar la PWA en producción.

## Probar el cron manualmente

```
GET /api/cron/daily?date=2026-09-01&secret=<CRON_SECRET>
```

El parámetro `date` simula "hoy" (día 1, 27, o cualquier otro) sin esperar al calendario real.

## Verificar las fórmulas

```bash
npx tsx scripts/verify-scoring.ts
```

Compara los cálculos de `src/lib/scoring.ts` contra los valores reales de la sucursal BJX en el Excel original.

## Estructura

- `src/app/login` — login (Supabase Auth).
- `src/app/sucursal/[code]` — formulario de checklist, pendientes/seguimiento con bitácora, historial.
- `src/app/dashboard` — vista admin: ranking, tendencia histórica, matriz por categoría, puntualidad.
- `src/app/api/cron/daily` — automatización mensual (crear evaluaciones, recordatorios, alertas).
- `src/lib/scoring.ts` — fórmulas puras (testeadas).
- `src/lib/dashboard.ts` — agregaciones para el dashboard.
- `src/lib/notifications/` — envío de correo (Resend) y push (Web Push).
- `supabase/migrations/` — esquema, RLS y datos semilla.
