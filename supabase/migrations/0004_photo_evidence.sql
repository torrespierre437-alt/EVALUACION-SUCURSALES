-- Evidencia fotográfica por punto de checklist.

alter table evaluation_answers add column if not exists photo_url text;

-- Bucket público de Storage para las fotos (público para poder mostrarlas con una URL
-- directa sin firmar; el control de quién puede SUBIR se hace con las policies de abajo).
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', true)
on conflict (id) do nothing;

-- Convención de carpetas: evidence/{branch_id}/{evaluation_id}/{checklist_item_id}-*.jpg
-- storage.foldername(name) regresa el arreglo de segmentos de carpeta del path.
create policy "evidence_select" on storage.objects for select
  using (bucket_id = 'evidence');

create policy "evidence_insert" on storage.objects for insert
  with check (
    bucket_id = 'evidence'
    and (
      is_admin()
      or (storage.foldername(name))[1] = my_branch_id()::text
    )
  );

create policy "evidence_delete" on storage.objects for delete
  using (
    bucket_id = 'evidence'
    and (
      is_admin()
      or (storage.foldername(name))[1] = my_branch_id()::text
    )
  );
