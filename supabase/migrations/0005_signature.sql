-- Firma del gerente de sucursal, capturada antes de enviar la evaluación.

alter table evaluations add column if not exists signature_url text;
