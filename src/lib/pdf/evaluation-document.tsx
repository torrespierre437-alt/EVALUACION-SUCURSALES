import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { Branch, Category, ChecklistItem, Evaluation, EvaluationAnswer, Followup, FollowupNote } from "@/lib/supabase/types";

export type PhotoData = { data: Buffer; format: "jpg" | "png" };

const PHOTO_WIDTH = 38;
const INK = "#1e293b";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const ACCENT = "#1c2b6b";
const ACCENT_SOFT = "#eef1fb";

const styles = StyleSheet.create({
  page: { paddingTop: 80, paddingBottom: 34, paddingHorizontal: 26, fontSize: 8.5, fontFamily: "Helvetica", color: INK },

  // Encabezado fijo, se repite en cada página — el logo se queda grande, y en vez de
  // dejar aire alrededor de un texto chico, absorbe ese espacio: aquí vive TODO el
  // título (nombre, periodo, fechas), así no hay un bloque de título aparte solo en
  // la primera página que deje una franja vacía entre el encabezado y el contenido.
  runningHeader: {
    position: "absolute",
    top: 8,
    left: 26,
    right: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 6,
    borderBottom: "0.75pt solid " + LINE,
  },
  runningHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  runningHeaderLogo: { width: 66, height: 66 },
  runningHeaderText_b: { fontSize: 16, color: ACCENT, fontWeight: 700, marginBottom: 2 },
  runningHeaderText: { fontSize: 9.5, color: MUTED },
  runningHeaderMeta: { alignItems: "flex-end" },
  metaLine: { fontSize: 8, color: MUTED, textAlign: "right", marginBottom: 1 },
  pageNumLine: { fontSize: 7, color: MUTED, textAlign: "right", marginTop: 3 },

  // Pie fijo, se repite en cada página.
  runningFooter: {
    position: "absolute",
    bottom: 14,
    left: 26,
    right: 26,
    textAlign: "center",
    fontSize: 7,
    color: MUTED,
  },

  statRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  statCard: { flex: 1, borderRadius: 3, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: "#f8fafc", border: "0.75pt solid " + LINE },
  statLabel: { fontSize: 6.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 1 },
  statValue: { fontSize: 12, fontWeight: 700 },

  // Grid de categorías: 2 columnas independientes (no se emparejan fila por fila) para
  // que no quede espacio muerto cuando una categoría tiene más puntos que la otra.
  catGrid: { flexDirection: "row", gap: 10 },
  catCol: { flex: 1 },
  catCard: { borderRadius: 4, border: "0.75pt solid " + LINE, overflow: "hidden", marginBottom: 6 },
  categoryHeader: {
    fontSize: 8,
    fontWeight: 700,
    color: "#ffffff",
    backgroundColor: ACCENT,
    paddingVertical: 3,
    paddingHorizontal: 8,
    letterSpacing: 0.3,
  },
  item: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderBottom: "0.5pt solid " + LINE,
  },
  itemTopRow: { flexDirection: "row", alignItems: "flex-start" },
  itemMain: { flex: 1, paddingRight: 6 },
  itemDescription: { fontSize: 7, lineHeight: 1.15 },
  badgeWrap: { width: 38, alignItems: "center" },
  badge: { fontSize: 6, fontWeight: 700, textAlign: "center", paddingVertical: 2, paddingHorizontal: 2, borderRadius: 8, width: "100%" },
  // Fila de evidencia: foto y comentario van juntos, uno al lado del otro, para no
  // gastar una línea aparte arriba (junto a la descripción) cuando hay comentario.
  evidenceRow: { flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 2 },
  // maxWidth + maxHeight (sin width/height fijo ni objectFit): la foto se escala
  // completa dentro de esa caja según su aspect ratio real — una horizontal topa en
  // el ancho, una vertical topa en el alto — sin recortar y sin que una foto muy
  // vertical dispare el alto de la fila (clave con evaluaciones con foto en casi
  // todos los puntos, donde el alto de cada fila sí importa para caber en 2 páginas).
  itemPhoto: { maxWidth: PHOTO_WIDTH, maxHeight: PHOTO_WIDTH, borderRadius: 4, border: "0.5pt solid " + LINE },
  itemComment: { flex: 1, fontSize: 6.3, color: MUTED, fontStyle: "italic", lineHeight: 1.15 },

  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: ACCENT,
    marginTop: 4,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottom: "1pt solid " + ACCENT,
  },
  followupRow: { marginBottom: 4, paddingBottom: 4, borderBottom: "0.5pt solid " + LINE },
  followupDesc: { fontSize: 7.5 },
  followupMeta: { fontSize: 6.8, color: MUTED, marginTop: 1 },

  // Bloque de cierre / firma: tarjeta con acento. Sin wrap:false — se deja fluir con
  // el resto del contenido (no "salta" completa a una página nueva) para que nunca
  // quede aislada, sola, lejos de los puntos que la preceden.
  closingCard: {
    marginTop: 8,
    borderRadius: 4,
    border: "0.75pt solid " + LINE,
    borderTop: "2.5pt solid " + ACCENT,
    backgroundColor: ACCENT_SOFT,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closingLeft: { flex: 1, paddingRight: 14 },
  closingTitle: { fontSize: 9, fontWeight: 700, color: ACCENT, marginBottom: 3 },
  closingText: { fontSize: 7.3, color: MUTED, lineHeight: 1.4 },
  signatureBox: { alignItems: "center", width: 170 },
  signatureImage: { width: 150, height: 48, objectFit: "contain" },
  signatureLine: { width: 150, borderTop: "0.75pt solid #94a3b8", marginTop: 3, paddingTop: 3 },
  signatureCaption: { fontSize: 7.5, textAlign: "center", color: MUTED },
});

const PERIOD_LABEL: Record<string, string> = { inicial: "Evaluación inicial", seguimiento: "Evaluación de seguimiento" };
const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  a_tiempo: "A tiempo",
  tardio: "Con atraso",
  no_enviado: "No enviada",
};
const STATUS_COLOR: Record<string, string> = {
  pendiente: MUTED,
  a_tiempo: "#15803d",
  tardio: "#b45309",
  no_enviado: "#b91c1c",
};

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function fmtPct(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

/**
 * Reparte las categorías en 2 columnas independientes por cantidad de puntos (no en
 * pares fila-por-fila) — así una columna no se queda con espacio muerto solo porque
 * la categoría de al lado tenía más preguntas.
 */
function splitBalanced(
  cats: Category[],
  itemsByCategory: Map<string, ChecklistItem[]>
): [Category[], Category[]] {
  const left: Category[] = [];
  const right: Category[] = [];
  let leftCount = 0;
  let rightCount = 0;
  for (const cat of cats) {
    const count = (itemsByCategory.get(cat.id) ?? []).length;
    if (leftCount <= rightCount) {
      left.push(cat);
      leftCount += count;
    } else {
      right.push(cat);
      rightCount += count;
    }
  }
  return [left, right];
}

export function EvaluationDocument({
  branch,
  evaluation,
  categories,
  items,
  answers,
  followups,
  notesByFollowupId,
  photoDataByUrl,
  logoData,
}: {
  branch: Branch;
  evaluation: Evaluation;
  categories: Category[];
  items: ChecklistItem[];
  answers: EvaluationAnswer[];
  followups: Followup[];
  notesByFollowupId: Map<string, FollowupNote[]>;
  /** Fotos ya descargadas y reducidas de tamaño (ver fetchAndResizePhotos en la ruta) */
  photoDataByUrl: Map<string, PhotoData>;
  logoData: PhotoData | null;
}) {
  // Si la foto no se pudo descargar/reducir (ver fetchAndResizePhotos), se omite en
  // vez de pasarle la URL cruda a <Image> — @react-pdf/renderer no maneja bien esa
  // ruta de fallback (falla con "Not valid image extension" en varias fotos reales).
  function photoSrc(url: string) {
    const photo = photoDataByUrl.get(url);
    return photo ? { data: photo.data, format: photo.format } : null;
  }

  const answerByItemId = new Map(answers.map((a) => [a.checklist_item_id, a]));
  const itemsByCategory = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const list = itemsByCategory.get(item.category_id) ?? [];
    list.push(item);
    itemsByCategory.set(item.category_id, list);
  }
  const categoriesWithItems = categories.filter((cat) => (itemsByCategory.get(cat.id) ?? []).length > 0);
  const [leftCategories, rightCategories] = splitBalanced(categoriesWithItems, itemsByCategory);

  const logoSrc = logoData ? { data: logoData.data, format: logoData.format } : null;
  const statusColor = STATUS_COLOR[evaluation.status] ?? MUTED;

  function renderCategoryCard(cat: Category) {
    const catItems = itemsByCategory.get(cat.id) ?? [];
    return (
      <View key={cat.id} style={styles.catCard}>
        <Text style={styles.categoryHeader}>{cat.name}</Text>
        {catItems.map((item, idx) => {
          const answer = answerByItemId.get(item.id);
          if (!answer) return null;
          const cumple = answer.value === 1;
          const isLast = idx === catItems.length - 1;
          const photo = answer.photo_url ? photoSrc(answer.photo_url) : null;
          return (
              <View key={item.id} style={[styles.item, isLast ? { borderBottom: "none" } : {}]} wrap={false}>
                <View style={styles.itemTopRow}>
                  <View style={styles.itemMain}>
                    <Text style={styles.itemDescription}>{item.description}</Text>
                  </View>
                  <View style={styles.badgeWrap}>
                    <Text
                      style={[
                        styles.badge,
                        cumple ? { backgroundColor: "#dcfce7", color: "#15803d" } : { backgroundColor: "#fee2e2", color: "#b91c1c" },
                      ]}
                    >
                      {cumple ? "Cumple" : "No cumple"}
                    </Text>
                  </View>
                </View>
                {(photo || answer.comment) && (
                  <View style={styles.evidenceRow}>
                    {photo && <Image src={photo} style={styles.itemPhoto} />}
                    {answer.comment && <Text style={styles.itemComment}>"{answer.comment}"</Text>}
                  </View>
                )}
              </View>
            );
        })}
      </View>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.runningHeader} fixed>
          <View style={styles.runningHeaderLeft}>
            {logoSrc && <Image src={logoSrc} style={styles.runningHeaderLogo} />}
            <View>
              <Text style={styles.runningHeaderText_b}>{branch.name}</Text>
              <Text style={styles.runningHeaderText}>
                {PERIOD_LABEL[evaluation.period] ?? evaluation.period} — {evaluation.month}/{evaluation.year}
              </Text>
            </View>
          </View>
          <View style={styles.runningHeaderMeta}>
            <Text style={styles.metaLine}>Vencimiento: {evaluation.due_date}</Text>
            <Text style={styles.metaLine}>Enviado: {fmtDate(evaluation.submitted_at)}</Text>
            <Text style={styles.pageNumLine} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
          </View>
        </View>
        <Text style={styles.runningFooter} fixed>
          Evaluación de Sucursales · PCP · Documento generado automáticamente
        </Text>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Score</Text>
            <Text style={styles.statValue}>{fmtPct(evaluation.evaluation_score)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Puntualidad</Text>
            <Text style={styles.statValue}>{fmtPct(evaluation.punctuality_score)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Estado</Text>
            <Text style={[styles.statValue, { color: statusColor }]}>
              {STATUS_LABEL[evaluation.status] ?? evaluation.status}
            </Text>
          </View>
        </View>

        <View style={styles.catGrid}>
          <View style={styles.catCol}>{leftCategories.map((cat) => renderCategoryCard(cat))}</View>
          <View style={styles.catCol}>{rightCategories.map((cat) => renderCategoryCard(cat))}</View>
        </View>

        <Text style={styles.sectionTitle}>Pendientes / seguimiento</Text>
        {followups.length === 0 ? (
          <Text style={{ fontSize: 7.5, color: MUTED }}>Sin pendientes registrados.</Text>
        ) : (
          followups.map((f) => {
            const notes = notesByFollowupId.get(f.id) ?? [];
            return (
              <View key={f.id} style={styles.followupRow} wrap={false}>
                <Text style={styles.followupDesc}>
                  {f.description} — {f.status === "resuelto" ? "Resuelto" : "Pendiente"}
                </Text>
                {notes.map((n) => (
                  <Text key={n.id} style={styles.followupMeta}>
                    {new Date(n.noted_at).toLocaleDateString("es-MX")} — {n.note}
                  </Text>
                ))}
              </View>
            );
          })
        )}

        <View style={styles.closingCard}>
          <View style={styles.closingLeft}>
            <Text style={styles.closingTitle}>Evaluación certificada</Text>
            <Text style={styles.closingText}>
              {branch.name} · {PERIOD_LABEL[evaluation.period] ?? evaluation.period} de {evaluation.month}/{evaluation.year}.
              Enviada el {fmtDate(evaluation.submitted_at)} con un score de {fmtPct(evaluation.evaluation_score)} y
              puntualidad de {fmtPct(evaluation.punctuality_score)}.
            </Text>
          </View>
          <View style={styles.signatureBox}>
            {evaluation.signature_url && photoSrc(evaluation.signature_url) && (
              <Image src={photoSrc(evaluation.signature_url)!} style={styles.signatureImage} />
            )}
            <View style={styles.signatureLine}>
              <Text style={styles.signatureCaption}>Gerente de Sucursal</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
