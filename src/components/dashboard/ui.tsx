import type { ReactNode } from "react";

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "attention" | "danger" | "success" }) {
  const classes = {
    neutral: "border-slate-300 bg-slate-50 text-slate-700",
    attention: "border-amber-300 bg-amber-50 text-amber-900",
    danger: "border-rose-300 bg-rose-50 text-rose-900",
    success: "border-emerald-300 bg-emerald-50 text-emerald-900",
  };

  return <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${classes[tone]}`}>{children}</span>;
}

export function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded border border-slate-300 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[8rem_1fr]">
      <dt className="font-semibold text-slate-600">{label}</dt>
      <dd className="break-words text-slate-950">{value}</dd>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-4 py-6">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{children}</p>
    </div>
  );
}

export function DataTable({ headers, rows, emptyText }: { headers: string[]; rows: Array<Array<ReactNode>>; emptyText: string }) {
  if (rows.length === 0) {
    return <EmptyState title="No results">{emptyText}</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-semibold text-slate-700">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="max-w-xl break-words px-3 py-2 text-slate-950">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MetricStrip({ metrics }: { metrics: Array<{ label: string; value: string; tone?: "neutral" | "attention" | "danger" }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className={`rounded border bg-white p-3 ${metric.tone === "danger" ? "border-rose-300" : metric.tone === "attention" ? "border-amber-300" : "border-slate-300"}`}>
          <div className="text-xs font-semibold uppercase text-slate-500">{metric.label}</div>
          <div className="mt-1 text-xl font-semibold text-slate-950">{metric.value}</div>
        </div>
      ))}
    </div>
  );
}
