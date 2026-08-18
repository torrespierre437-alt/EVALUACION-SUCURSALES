"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";

const Y_AXIS_TICKS = Array.from({ length: 51 }, (_, i) => i * 2);

export function RankingChart({ data }: { data: { branch: string; score: number }[] }) {
  const sorted = [...data].sort((a, b) => b.score - a.score);

  return (
    <div className="h-[36rem] w-full rounded-lg border border-slate-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="branch" tick={{ fontSize: 11 }} interval={0} angle={-45} textAnchor="end" height={60} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} allowDecimals={false} ticks={Y_AXIS_TICKS} />
          <Tooltip />
          <Bar dataKey="score" name="Calificación final %" radius={[4, 4, 0, 0]}>
            {sorted.map((d, i) => (
              <Cell key={i} fill={d.score >= 90 ? "#16a34a" : d.score >= 75 ? "#d97706" : "#dc2626"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
