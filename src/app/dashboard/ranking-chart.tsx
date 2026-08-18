"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";

export function RankingChart({ data }: { data: { branch: string; score: number }[] }) {
  const sorted = [...data].sort((a, b) => b.score - a.score);

  return (
    <div className="h-80 w-full rounded-lg border border-slate-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="branch" tick={{ fontSize: 11 }} interval={0} angle={-45} textAnchor="end" height={60} />
          <YAxis domain={[1, 100]} tick={{ fontSize: 11 }} allowDecimals={false} tickCount={6} />
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
