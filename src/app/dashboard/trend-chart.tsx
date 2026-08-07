"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";

export function TrendChart({ data }: { data: { label: string; promedio: number; puntualidad: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">Aún no hay historial suficiente.</p>;
  }
  return (
    <div className="h-72 w-full rounded-lg border border-slate-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="promedio" name="Cumplimiento nacional %" stroke="#0f172a" strokeWidth={2} />
          <Line
            type="monotone"
            dataKey="puntualidad"
            name="Puntualidad nacional %"
            stroke="#64748b"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
