-- Permite varias fotos de evidencia por punto de checklist (hasta 4, ver
-- MAX_PHOTOS_PER_ITEM en src/lib/photos.ts) en vez de una sola que se reemplazaba
-- cada vez que se tomaba una foto nueva.

alter table evaluation_answers add column if not exists photo_urls text[] not null default '{}';

-- Migra las fotos ya guardadas en la columna vieja (photo_url) a la nueva (photo_urls),
-- sin perder evidencia ya subida. photo_url se deja tal cual (columna legacy, ya no se
-- escribe desde la app) por si algo externo la sigue leyendo.
update evaluation_answers
set photo_urls = array[photo_url]
where photo_url is not null and coalesce(array_length(photo_urls, 1), 0) = 0;
