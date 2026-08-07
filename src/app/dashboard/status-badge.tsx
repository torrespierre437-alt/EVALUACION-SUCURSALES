import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import type { EvaluationStatus } from "@/lib/supabase/types";

const STYLES: Record<EvaluationStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  a_tiempo: { label: "A tiempo", className: "bg-green-50 text-green-700", Icon: CheckCircle2 },
  tardio: { label: "Tardío", className: "bg-amber-50 text-amber-700", Icon: AlertTriangle },
  no_enviado: { label: "No enviado", className: "bg-red-50 text-red-700", Icon: XCircle },
  pendiente: { label: "Pendiente", className: "bg-slate-100 text-slate-500", Icon: Clock },
};

export function StatusBadge({ status }: { status: EvaluationStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}
    >
      <s.Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {s.label}
    </span>
  );
}
