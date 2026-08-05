-- Row Level Security: cada sucursal solo ve/edita sus propios datos; el admin ve todo.

alter table branches enable row level security;
alter table categories enable row level security;
alter table checklist_items enable row level security;
alter table evaluations enable row level security;
alter table evaluation_answers enable row level security;
alter table followups enable row level security;
alter table followup_notes enable row level security;
alter table profiles enable row level security;

create or replace function is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function my_branch_id()
returns uuid language sql stable security definer as $$
  select branch_id from profiles where id = auth.uid();
$$;

-- Catálogos: lectura para cualquier usuario autenticado, escritura solo admin.
create policy "branches_select" on branches for select using (auth.uid() is not null);
create policy "branches_write_admin" on branches for all using (is_admin()) with check (is_admin());

create policy "categories_select" on categories for select using (auth.uid() is not null);
create policy "categories_write_admin" on categories for all using (is_admin()) with check (is_admin());

create policy "checklist_items_select" on checklist_items for select using (auth.uid() is not null);
create policy "checklist_items_write_admin" on checklist_items for all using (is_admin()) with check (is_admin());

-- Evaluaciones: la sucursal ve/edita solo las suyas; admin ve/edita todas.
create policy "evaluations_select" on evaluations for select
  using (is_admin() or branch_id = my_branch_id());
create policy "evaluations_insert" on evaluations for insert
  with check (is_admin() or branch_id = my_branch_id());
create policy "evaluations_update" on evaluations for update
  using (is_admin() or branch_id = my_branch_id());

create policy "answers_select" on evaluation_answers for select
  using (is_admin() or exists (
    select 1 from evaluations e where e.id = evaluation_id and e.branch_id = my_branch_id()
  ));
create policy "answers_write" on evaluation_answers for all
  using (is_admin() or exists (
    select 1 from evaluations e where e.id = evaluation_id and e.branch_id = my_branch_id()
  ))
  with check (is_admin() or exists (
    select 1 from evaluations e where e.id = evaluation_id and e.branch_id = my_branch_id()
  ));

-- Pendientes/seguimiento: misma regla.
create policy "followups_select" on followups for select
  using (is_admin() or branch_id = my_branch_id());
create policy "followups_write" on followups for all
  using (is_admin() or branch_id = my_branch_id())
  with check (is_admin() or branch_id = my_branch_id());

create policy "followup_notes_select" on followup_notes for select
  using (is_admin() or exists (
    select 1 from followups f where f.id = followup_id and f.branch_id = my_branch_id()
  ));
create policy "followup_notes_write" on followup_notes for all
  using (is_admin() or exists (
    select 1 from followups f where f.id = followup_id and f.branch_id = my_branch_id()
  ))
  with check (is_admin() or exists (
    select 1 from followups f where f.id = followup_id and f.branch_id = my_branch_id()
  ));

-- Perfiles: cada quien ve/edita el suyo (para guardar su suscripción push); admin ve todos.
create policy "profiles_select" on profiles for select
  using (is_admin() or id = auth.uid());
create policy "profiles_update_self" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_write_admin" on profiles for all
  using (is_admin()) with check (is_admin());
