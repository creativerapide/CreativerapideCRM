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
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="luna" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={56} />
          <Tooltip formatter={(v) => ron(v)} />
          <Legend />
          <Bar dataKey="facturat" name="Facturat" fill="#4f46e5" radius={[3, 3, 0, 0]} />
          <Bar dataKey="incasat" name="Încasat" fill="#10b981" radius={[3, 3, 0, 0]} />
          <Bar dataKey="costuri" name="Costuri directe" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
