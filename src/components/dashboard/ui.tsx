import type { ReactNode } from "react";

type Tone = "neutral" | "attention" | "danger" | "success" | "info";

const toneClasses: Record<Tone, string> = {
  neutral: "border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]",
  attention: "border-[var(--color-warning)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  danger: "border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  success: "border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
  info: "border-[var(--color-info)] bg-[var(--color-info-soft)] text-[var(--color-info)]",
};

export function AppMark() {
  return (
    <span aria-hidden="true" className="relative grid size-7 place-items-center rounded-[var(--radius-md)] border border-cyan-300/35 bg-cyan-100/10">
      <svg viewBox="0 0 24 24" className="size-5 text-cyan-100">
        <path d="M5 7.5 12 4l7 3.5v9L12 20l-7-3.5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8.25 9.25 12 7.4l3.75 1.85M12 7.4v9.2M8.25 14.75 12 16.6l3.75-1.85" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    </span>
  );
}

export function Icon({
  name,
  className = "size-4",
}: {
  name: "folder" | "graph" | "layers" | "branch" | "flame" | "git" | "box" | "search" | "plus" | "trash" | "alert" | "check";
  className?: string;
}) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8 };
  const paths = {
    folder: <path {...common} d="M3.5 6.5h5l1.6 2h10.4v8.8a2.2 2.2 0 0 1-2.2 2.2H5.7a2.2 2.2 0 0 1-2.2-2.2z" />,
    graph: (
      <>
        <path {...common} d="M7 7h10M7 12h10M7 17h6" />
        <path {...common} d="M4 7h.01M4 12h.01M4 17h.01" />
      </>
    ),
    layers: (
      <>
        <path {...common} d="m12 4 8 4-8 4-8-4z" />
        <path {...common} d="m4 12 8 4 8-4M4 16l8 4 8-4" />
      </>
    ),
    branch: (
      <>
        <path {...common} d="M7 5v6a4 4 0 0 0 4 4h6" />
        <path {...common} d="M17 9v10" />
        <circle {...common} cx="7" cy="5" r="2" />
        <circle {...common} cx="17" cy="9" r="2" />
        <circle {...common} cx="17" cy="19" r="2" />
      </>
    ),
    flame: <path {...common} d="M12 21a7 7 0 0 0 6.8-7.4c-.2-3-2-5.2-5.3-8.6-.1 2.8-1.2 4.2-3 5.5.2-2-.7-3.4-2.2-4.7C7.8 9.4 5 11.2 5 14a7 7 0 0 0 7 7z" />,
    git: (
      <>
        <path {...common} d="M7 6v8a4 4 0 0 0 4 4h6M7 10h8" />
        <circle {...common} cx="7" cy="6" r="2" />
        <circle {...common} cx="15" cy="10" r="2" />
        <circle {...common} cx="17" cy="18" r="2" />
      </>
    ),
    box: <path {...common} d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" />,
    search: (
      <>
        <circle {...common} cx="10.5" cy="10.5" r="6.5" />
        <path {...common} d="m15.5 15.5 4.5 4.5" />
      </>
    ),
    plus: <path {...common} d="M12 5v14M5 12h14" />,
    trash: <path {...common} d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13" />,
    alert: (
      <>
        <path {...common} d="M12 8v5" />
        <path {...common} d="M12 17h.01" />
        <path {...common} d="M10.3 4.5 2.9 17.3A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.7-2.7L13.7 4.5a2 2 0 0 0-3.4 0z" />
      </>
    ),
    check: <path {...common} d="m5 12 4 4 10-10" />,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {paths[name]}
    </svg>
  );
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <span className={`inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>{children}</span>;
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="max-w-4xl">
        {eyebrow ? <div className="mb-1 text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{eyebrow}</div> : null}
        <h2 className="text-xl font-semibold text-[var(--color-text)]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  children,
  emphasis = "normal",
  action,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  emphasis?: "normal" | "subtle" | "strong";
  action?: ReactNode;
}) {
  const emphasisClass =
    emphasis === "strong"
      ? "border-[var(--color-border-strong)] bg-[var(--color-surface)]"
      : emphasis === "subtle"
        ? "border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]"
        : "border-[var(--color-border)] bg-[var(--color-surface)]";

  return (
    <section className={`rounded-[var(--radius-md)] border ${emphasisClass}`}>
      <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[var(--color-text)]">{title}</h3>
          {description ? <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function DetailPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
      <h3 className="text-[15px] font-semibold text-[var(--color-text)]">{title}</h3>
      <div className="mt-3">{children}</div>
    </aside>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[9rem_1fr]">
      <dt className="font-medium text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="break-words text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

export function EmptyState({ title, children, tone = "neutral" }: { title: string; children: ReactNode; tone?: Tone }) {
  const borderClass = tone === "danger" ? "border-[var(--color-danger)]" : tone === "attention" ? "border-[var(--color-warning)]" : "border-[var(--color-border)]";

  return (
    <div className={`rounded-[var(--radius-md)] border border-dashed ${borderClass} bg-[var(--color-surface-subtle)] px-4 py-6`}>
      <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-secondary)]">{children}</p>
    </div>
  );
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-9 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-hover)]" />
      ))}
    </div>
  );
}

export function DataTable({
  headers,
  rows,
  emptyText,
  numericColumns = [],
  selectedRowIndex,
}: {
  headers: string[];
  rows: Array<Array<ReactNode>>;
  emptyText: string;
  numericColumns?: number[];
  selectedRowIndex?: number;
}) {
  if (rows.length === 0) {
    return <EmptyState title="No results">{emptyText}</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            {headers.map((header, index) => (
              <th key={header} className={`px-3 py-2 text-xs font-medium uppercase tracking-[0.04em] text-[var(--color-text-muted)] ${numericColumns.includes(index) ? "text-right" : "text-left"}`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-surface-hover)] ${
                selectedRowIndex === rowIndex ? "bg-[var(--color-surface-selected)]" : ""
              }`}
              aria-selected={selectedRowIndex === rowIndex}
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`max-w-xl break-words px-3 py-2.5 text-[var(--color-text)] ${numericColumns.includes(cellIndex) ? "text-right tabular-nums" : ""} ${
                    cellIndex === 0 ? "font-medium" : ""
                  }`}
                >
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

export function MetricGroup({ metrics }: { metrics: Array<{ label: string; value: string; tone?: Tone; detail?: ReactNode; primary?: boolean }> }) {
  return (
    <dl className="grid rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => (
        <div key={metric.label} className="border-b border-[var(--color-border-subtle)] px-4 py-3 last:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0">
          <dt className="text-xs font-medium uppercase tracking-[0.05em] text-[var(--color-text-muted)]">{metric.label}</dt>
          <dd className={`mt-1 tabular-nums font-semibold ${metric.primary ? "text-2xl" : "text-xl"} ${metric.tone && metric.tone !== "neutral" ? toneText(metric.tone) : "text-[var(--color-text)]"}`}>
            {metric.value}
          </dd>
          {metric.detail ? <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{metric.detail}</div> : null}
        </div>
      ))}
    </dl>
  );
}

export const MetricStrip = MetricGroup;

export function VisualizationPanel({
  title,
  description,
  children,
  height = "standard",
  controls,
  legend,
  state = "empty",
}: {
  title: string;
  description: ReactNode;
  children?: ReactNode;
  height?: "small" | "standard" | "large";
  controls?: ReactNode;
  legend?: ReactNode;
  state?: "ready" | "empty" | "loading" | "error";
}) {
  const heightClass = height === "large" ? "min-h-[420px]" : height === "small" ? "min-h-[240px]" : "min-h-[320px]";

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex flex-col gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--color-text)]">{title}</h3>
          <p className="mt-1 max-w-3xl text-[13px] text-[var(--color-text-secondary)]">{description}</p>
        </div>
        {controls ? <div className="shrink-0">{controls}</div> : null}
      </div>
      <div className={`relative ${heightClass} overflow-hidden bg-[var(--color-surface-subtle)]`}>
        {state === "loading" ? (
          <div className="p-4">
            <LoadingState rows={6} />
          </div>
        ) : null}
        {state === "error" ? (
          <div className="p-4">
            <EmptyState title="Visualization unavailable" tone="danger">
              The visualization area is reserved, but this view cannot render its data yet.
            </EmptyState>
          </div>
        ) : null}
        {state === "empty" ? <VisualizationEmpty>{children ?? "Visualization coming next. The layout is reserved for the analytical view described above."}</VisualizationEmpty> : null}
        {state === "ready" ? children : null}
      </div>
      {legend ? <div className="border-t border-[var(--color-border-subtle)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">{legend}</div> : null}
    </section>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-2">{children}</div>;
}

export function SignalBar({ value, tone = "info" }: { value: number; tone?: Tone }) {
  const percentage = Math.max(0, Math.min(100, Math.round(value * 100)));

  return (
    <span className="inline-flex min-w-24 items-center gap-2">
      <span className="h-1.5 flex-1 rounded-full bg-[var(--color-border-subtle)]">
        <span className={`block h-1.5 rounded-full ${toneBg(tone)}`} style={{ width: `${percentage}%` }} />
      </span>
      <span className="w-8 text-right text-xs tabular-nums text-[var(--color-text-secondary)]">{percentage}%</span>
    </span>
  );
}

function VisualizationEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-secondary)]">{children}</div>
    </div>
  );
}

function toneText(tone: Tone): string {
  const classes: Record<Tone, string> = {
    neutral: "text-[var(--color-text)]",
    attention: "text-[var(--color-warning)]",
    danger: "text-[var(--color-danger)]",
    success: "text-[var(--color-success)]",
    info: "text-[var(--color-info)]",
  };

  return classes[tone];
}

function toneBg(tone: Tone): string {
  const classes: Record<Tone, string> = {
    neutral: "bg-[var(--chart-slate)]",
    attention: "bg-[var(--chart-amber)]",
    danger: "bg-[var(--chart-red)]",
    success: "bg-[var(--chart-teal)]",
    info: "bg-[var(--chart-cyan)]",
  };

  return classes[tone];
}
