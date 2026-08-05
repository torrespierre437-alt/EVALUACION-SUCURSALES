@AGENTS.md

# Evaluación de Sucursales

Next.js (App Router, TS) + Supabase (Postgres/Auth/RLS) + Resend (correo) + Web Push. Ver README.md para puesta en marcha.

## Modelo de datos (supabase/migrations/0001_schema.sql)

`branches` (25 sucursales) · `categories` (10) · `checklist_items` (37, con `weight` por categoría) · `evaluations` (una fila por sucursal/periodo(`inicial`|`seguimiento`)/mes/año) · `evaluation_answers` (valor 0/1 + comentario por item) · `followups` (pendiente en texto libre) · `followup_notes` (bitácora de fechas de seguimiento, N por followup) · `profiles` (role `admin`|`branch`, `branch_id`, `push_subscription`).

RLS (0002_rls.sql): `is_admin()` y `my_branch_id()` son funciones `security definer`; una sucursal solo ve/edita filas de su `branch_id`, el admin ve todo.

## Fórmulas (src/lib/scoring.ts, verificadas en scripts/verify-scoring.ts contra el Excel original)

```
categoryScore   = Σ(valor·peso) / Σ(peso)
evaluationScore = promedio(categoryScore de cada categoría)
punctualityScore= max(0, 1 − 0.03·días_retraso), 0 si no se envía
monthlyPunctuality = promedio(puntualidad inicial, puntualidad seguimiento)
finalScore      = promedio(evaluationScore de seguimiento, monthlyPunctuality)
```

No dupliques esta lógica en otro lado — importar de `@/lib/scoring` y `@/lib/dashboard`.

## Ciclo mensual (src/app/api/cron/daily/route.ts)

Un solo endpoint, un solo cron diario (`vercel.json`, 13:00 UTC). Decide la acción por `day` del mes:
- día 1 → cierra `seguimiento` pendiente del mes anterior como `no_enviado`, crea `inicial` del mes en curso, notifica.
- día 27 → cierra `inicial` pendiente del mes en curso como `no_enviado`, crea `seguimiento`, notifica.
- cualquier otro día → alerta de atraso a evaluaciones `pendiente` vencidas.

Probar con `?date=YYYY-MM-DD&secret=<CRON_SECRET>` para simular cualquier día sin esperar al calendario.

## Convenciones

- Cliente Supabase: `@/lib/supabase/client` (browser), `@/lib/supabase/server` (Server Components/actions, respeta RLS), `createServiceRoleClient()` de `@/lib/supabase/server` solo dentro de rutas server-only como el cron (bypassa RLS, nunca importar desde un componente cliente).
- Server Actions viven junto a su página (`src/app/sucursal/[code]/actions.ts`), no en un archivo global.
- Colores/estados de evaluación: `a_tiempo` | `tardio` | `no_enviado` | `pendiente` (ver `src/app/dashboard/status-badge.tsx`).
- Los 25 códigos de sucursal y los 37 puntos de checklist con sus pesos están sembrados en `supabase/migrations/0003_seed.sql`, generados a partir de `DASHBOARD EDIFICIOS.xlsx` (hojas Hoja1/Hoja2) — es la fuente de verdad si hay dudas sobre nombres o pesos.

