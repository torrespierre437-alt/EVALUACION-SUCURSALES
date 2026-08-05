"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import type { Evaluation } from "@/lib/supabase/types";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function HistoryChart({ evaluations }: { evaluations: Evaluation[] }) {
  const data = evaluations
    .filter((e) => e.evaluation_score !== null)
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((e) => ({
      label: `${MONTHS[e.month - 1]} ${String(e.year).slice(2)} (${e.period === "inicial" ? "I" : "S"})`,
      score: e.evaluation_score !== null ? Math.round(e.evaluation_score * 100) : null,
      puntualidad:
        e.punctuality_score !== null ? Math.round(e.punctuality_score * 100) : null,
    }));

  if (data.length === 0) {
    return <p className="text-sm text-slate-400">Aún no hay evaluaciones enviadas.</p>;
  }

  return (
    <div className="h-64 w-full rounded-lg border border-slate-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="score" name="Cumplimiento %" stroke="#0f172a" strokeWidth={2} />
          <Line
            type="monotone"
            dataKey="puntualidad"
            name="Puntualidad %"
            stroke="#64748b"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
