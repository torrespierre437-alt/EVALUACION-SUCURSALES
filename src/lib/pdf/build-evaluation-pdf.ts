import sharp from "sharp";
import { renderToBuffer } from "@react-pdf/renderer";
import { EvaluationDocument, type PhotoData } from "./evaluation-document";
import type {
  Branch,
  Category,
  ChecklistItem,
  Evaluation,
  EvaluationAnswer,
  Followup,
  FollowupNote,
} from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

let cachedLogo: PhotoData | null | undefined;

/** Logo PCP para el encabezado del PDF — se descarga una vez y se reutiliza en la misma invocación. */
export async function fetchLogo(): Promise<PhotoData | null> {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const res = await fetchWithRetry(`${APP_URL}/icons/icon-192.png`);
    if (!res) throw new Error("no se pudo descargar el logo");
    const original = Buffer.from(await res.arrayBuffer());
    // El ícono fuente ya es de 192x192 — se deja a su resolución nativa (sin agrandar)
    // en vez de reducirlo a 60px, que es lo que lo hacía verse pixelado al mostrarlo
    // más grande en el encabezado del PDF.
    const resized = await sharp(original).resize({ width: 256, withoutEnlargement: true }).png().toBuffer();
    cachedLogo = { data: resized, format: "png" };
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}

/**
 * El componente de PDF incrusta las imágenes tal cual (a su resolución original);
 * como en el documento se muestran del tamaño de una miniatura, se descargan y
 * reducen aquí antes de pasarlas — si no, un puñado de fotos de celular (varios
 * cientos de KB cada una) infla el PDF a varios MB. Las fotos de evidencia se
 * recomprimen a JPEG (no tienen transparencia); la firma se mantiene en PNG para
 * conservar el fondo transparente del canvas (convertirla a JPEG lo rellena de negro).
 */
async function fetchWithRetry(url: string, attempts = 3): Promise<Response | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      // reintenta abajo
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, 300 * attempt));
  }
  return null;
}

async function fetchAndResizePhotos(urls: string[], signatureUrl: string | null): Promise<Map<string, PhotoData>> {
  const result = new Map<string, PhotoData>();
  const CONCURRENCY = 8;
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (url) => {
        try {
          const res = await fetchWithRetry(url);
          if (!res) return;
          const original = Buffer.from(await res.arrayBuffer());
          if (url === signatureUrl) {
            const resized = await sharp(original)
              .resize({ width: 320, withoutEnlargement: true })
              .png()
              .toBuffer();
            result.set(url, { data: resized, format: "png" });
          } else {
            // Se conserva el aspect ratio original (sin recortar a cuadrado aquí) —
            // el recorte final lo hace objectFit:cover ya en el tamaño real que se
            // muestra en el PDF. Ancho más grande que antes (190→480) para que las
            // fotos, ahora más grandes en el documento, no se vean pixeladas.
            const resized = await sharp(original)
              .rotate() // corrige orientación según EXIF (fotos de celular vienen rotadas seguido)
              .resize({ width: 480, withoutEnlargement: true })
              .jpeg({ quality: 72 })
              .toBuffer();
            result.set(url, { data: resized, format: "jpg" });
          }
        } catch {
          // si una foto individual falla, el PDF se genera sin ella en vez de tronar completo
        }
      })
    );
  }
  return result;
}

/**
 * Genera el PDF de una evaluación individual. Reutilizado por la ruta de descarga
 * suelta (/api/admin/evaluation-pdf) y por la de lote (/api/admin/evaluation-pdf/bulk).
 */
export async function buildEvaluationPdf(
  admin: SupabaseClient,
  evaluationId: string
): Promise<{ buffer: Buffer; branch: Branch; evaluation: Evaluation } | null> {
  const { data: evaluation } = await admin.from("evaluations").select("*").eq("id", evaluationId).single();
  if (!evaluation) return null;
  const ev = evaluation as Evaluation;

  const [{ data: branch }, { data: categories }, { data: items }, { data: answers }, { data: followups }, logoData] =
    await Promise.all([
      admin.from("branches").select("*").eq("id", ev.branch_id).single(),
      admin.from("categories").select("*").order("sort_order"),
      admin.from("checklist_items").select("*").eq("active", true).order("sort_order"),
      admin.from("evaluation_answers").select("*").eq("evaluation_id", evaluationId),
      admin.from("followups").select("*").eq("branch_id", ev.branch_id).order("created_at", { ascending: false }),
      fetchLogo(),
    ]);

  if (!branch) return null;

  const allFollowups = (followups as Followup[]) ?? [];
  const followupIds = allFollowups.map((f) => f.id);
  const { data: notes } = await admin
    .from("followup_notes")
    .select("*")
    .in("followup_id", followupIds.length ? followupIds : ["00000000-0000-0000-0000-000000000000"])
    .order("noted_at", { ascending: true });
  const notesByFollowupId = new Map<string, FollowupNote[]>();
  for (const n of (notes as FollowupNote[]) ?? []) {
    const list = notesByFollowupId.get(n.followup_id) ?? [];
    list.push(n);
    notesByFollowupId.set(n.followup_id, list);
  }

  const allAnswers = (answers as EvaluationAnswer[]) ?? [];
  const photoUrls = allAnswers.map((a) => a.photo_url).filter((u): u is string => !!u);
  if (ev.signature_url) photoUrls.push(ev.signature_url);
  const photoDataByUrl = await fetchAndResizePhotos(photoUrls, ev.signature_url);

  const buffer = await renderToBuffer(
    EvaluationDocument({
      branch: branch as Branch,
      evaluation: ev,
      categories: (categories as Category[]) ?? [],
      items: (items as ChecklistItem[]) ?? [],
      answers: allAnswers,
      followups: allFollowups,
      notesByFollowupId,
      photoDataByUrl,
      logoData,
    })
  );

  return { buffer, branch: branch as Branch, evaluation: ev };
}
