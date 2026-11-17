"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ChartPoint = { luna: string; facturat: number; incasat: number; costuri: number };

const ron = (v: unknown) =>
  new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 }).format(Number(v ?? 0));

export default function FinanceChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.12)" />
          <XAxis dataKey="luna" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={56} />
          <Tooltip formatter={(v) => ron(v)} cursor={{ fill: "rgba(255,255,255,0.08)" }} contentStyle={{ background: "rgba(12,24,52,0.85)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 14, color: "#f1f5f9", boxShadow: "0 12px 32px rgba(0,0,0,0.45)" }} labelStyle={{ color: "#f1f5f9" }} />
          <Legend />
          <Bar dataKey="facturat" name="Facturat" fill="#818cf8" radius={[8, 8, 0, 0]} />
          <Bar dataKey="incasat" name="Încasat" fill="#4ade80" radius={[8, 8, 0, 0]} />
          <Bar dataKey="costuri" name="Costuri directe" fill="#fbbf24" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
