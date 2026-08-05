-- Evaluación mensual de sucursales: esquema principal
-- Fórmulas de negocio (documentadas y validadas contra el Excel "DASHBOARD EDIFICIOS.xlsx"):
--   score_categoria   = sum(valor * peso) / sum(peso)               [valor es 0 o 1]
--   score_evaluacion  = promedio(score_categoria) de las categorías con respuestas
--   puntualidad_envio = max(0, 1 - 0.03 * dias_retraso); 0 si no se envía
--   puntualidad_mes   = promedio(puntualidad_inicial, puntualidad_seguimiento)
--   calificacion_final= promedio(score_evaluacion_seguimiento, puntualidad_mes)

create extension if not exists "pgcrypto";

create table branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,       -- ej. 'BJX', 'CCA'
  name text not null,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,       -- ej. 'LIMPIEZA', 'PINTURA'
  sort_order int not null default 0
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  description text not null,
  weight numeric(5,4) not null check (weight > 0 and weight <= 1),
  active boolean not null default true,
  sort_order int not null default 0
);

create type evaluation_period as enum ('inicial', 'seguimiento');
create type evaluation_status as enum ('pendiente', 'a_tiempo', 'tardio', 'no_enviado');

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  period evaluation_period not null,
  month int not null check (month between 1 and 12),
  year int not null,
  due_date date not null,
  submitted_at timestamptz,
  days_late int not null default 0,
  punctuality_score numeric(5,4),        -- calculado al recibir o al vencer el plazo
  evaluation_score numeric(5,4),         -- promedio de categorías, calculado al enviar
  status evaluation_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  unique (branch_id, period, month, year)
);

create table evaluation_answers (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references evaluations(id) on delete cascade,
  checklist_item_id uuid not null references checklist_items(id),
  value smallint not null check (value in (0, 1)),
  comment text,
  unique (evaluation_id, checklist_item_id)
);

create table followups (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  origin_evaluation_id uuid references evaluations(id) on delete set null,
  checklist_item_id uuid references checklist_items(id),
  description text not null,             -- pendiente en texto libre
  status text not null default 'pendiente' check (status in ('pendiente', 'resuelto')),
  created_at timestamptz not null default now()
);

create table followup_notes (
  id uuid primary key default gen_random_uuid(),
  followup_id uuid not null references followups(id) on delete cascade,
  note text not null,
  noted_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'branch')),
  branch_id uuid references branches(id),
  full_name text,
  email text,
  push_subscription jsonb,               -- suscripción Web Push (endpoint + keys)
  created_at timestamptz not null default now()
);

create index idx_evaluations_branch on evaluations(branch_id);
create index idx_evaluations_period on evaluations(month, year, period);
create index idx_evaluation_answers_eval on evaluation_answers(evaluation_id);
create index idx_followups_branch_status on followups(branch_id, status);
create index idx_followup_notes_followup on followup_notes(followup_id);

-- Vista de "última fecha de seguimiento" por pendiente, usada en el dashboard.
create view followups_with_last_note as
select
  f.*,
  ln.last_note_at,
  ln.last_note
from followups f
left join lateral (
  select note as last_note, noted_at as last_note_at
  from followup_notes n
  where n.followup_id = f.id
  order by n.noted_at desc
  limit 1
) ln on true;
