"use client";

import { useMemo, useState } from "react";

import type { FileInfo, GitFileHistory, MarkerSummary, SourceRelationshipAnalysis } from "@/types/repository";

interface ExplorerNode { name: string; path: string; children: Map<string, ExplorerNode>; file?: FileInfo }

export function RepositoryExplorer({ files, markers, gitHistory, relationships }: { files: FileInfo[]; markers: MarkerSummary; gitHistory: GitFileHistory[]; relationships: SourceRelationshipAnalysis }) {
  const [query, setQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState<string>();
  const root = useMemo(() => buildTree(files.filter((file) => file.path.toLowerCase().includes(query.toLowerCase()))), [files, query]);
  const selected = files.find((file) => file.path === selectedPath);
  const history = new Map(gitHistory.map((entry) => [entry.path, entry]));
  const markerCount = new Map(markers.files.map((entry) => [entry.path, entry.count]));
  const moduleInfo = relationships.modules.find((entry) => entry.path === selectedPath);
  const outgoing = relationships.relationships.filter((entry) => entry.status === "internal" && entry.sourcePath === selectedPath);
  const incoming = relationships.relationships.filter((entry) => entry.status === "internal" && entry.targetPath === selectedPath);
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
    <section className="rounded border border-[var(--color-border)] bg-white">
      <div className="border-b border-[var(--color-border-subtle)] p-3"><input aria-label="Filter files" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter paths" className="min-h-9 w-full rounded border border-[var(--color-border)] px-2 text-sm" /></div>
      <div className="max-h-[38rem] overflow-auto p-2"><TreeItems nodes={[...root.children.values()]} onSelect={setSelectedPath} selectedPath={selectedPath} /></div>
    </section>
    <aside className="rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
      {selected ? <div className="space-y-3"><h3 className="break-all font-mono text-sm font-semibold">{selected.path}</h3><Facts facts={[
        ["Language", selected.language ?? "Unknown"], ["Size", formatBytes(selected.bytes)], ["Lines", selected.lineCount?.toLocaleString() ?? "Not counted"], ["Git touches", history.get(selected.path)?.touchCount.toLocaleString() ?? "No history"], ["Recent touches", history.get(selected.path)?.recentTouchCount.toLocaleString() ?? "0"], ["Hotspot score", "Not ranked in explorer"], ["Markers", (markerCount.get(selected.path) ?? 0).toLocaleString()], ["Incoming refs", moduleInfo?.incomingCount.toLocaleString() ?? "0"], ["Outgoing refs", moduleInfo?.outgoingCount.toLocaleString() ?? "0"],
      ]} />
      {outgoing.length > 0 ? <PathList title="Imports" paths={outgoing.map((entry) => entry.targetPath as string)} /> : null}
      {incoming.length > 0 ? <PathList title="Referenced by" paths={incoming.map((entry) => entry.sourcePath)} /> : null}
      </div> : <p className="text-sm text-[var(--color-text-secondary)]">Select a file to inspect size, source details, Git churn, markers, and supported module references.</p>}
    </aside>
  </div>;
}

function buildTree(files: FileInfo[]): ExplorerNode { const root: ExplorerNode = { name: "", path: "", children: new Map() }; for (const file of files) { let node = root; for (const part of file.path.split("/")) { const path = node.path ? `${node.path}/${part}` : part; node = node.children.get(part) ?? (() => { const created = { name: part, path, children: new Map<string, ExplorerNode>() }; node.children.set(part, created); return created; })(); } node.file = file; } return root; }
function TreeItems({ nodes, onSelect, selectedPath, depth = 0 }: { nodes: ExplorerNode[]; onSelect: (path: string) => void; selectedPath?: string; depth?: number }) { return <ul>{nodes.sort((a, b) => Number(Boolean(a.file)) - Number(Boolean(b.file)) || a.name.localeCompare(b.name)).map((node) => <li key={node.path}>{node.file ? <button type="button" onClick={() => onSelect(node.path)} aria-pressed={selectedPath === node.path} className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ${selectedPath === node.path ? "bg-[var(--color-accent-soft)]" : "hover:bg-[var(--color-surface-hover)]"}`} style={{ paddingLeft: `${depth * 14 + 8}px` }}><span className="font-mono text-xs">{node.name}</span><span className="ml-auto text-xs text-[var(--color-text-muted)]">{node.file.language ?? ""}</span></button> : <details open={depth < 1}><summary className="cursor-pointer px-2 py-1 text-sm font-medium" style={{ paddingLeft: `${depth * 14 + 8}px` }}>{node.name}</summary><TreeItems nodes={[...node.children.values()]} onSelect={onSelect} selectedPath={selectedPath} depth={depth + 1} /></details>}</li>)}</ul>; }
function Facts({ facts }: { facts: Array<[string, string]> }) { return <dl className="space-y-1 text-sm">{facts.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-[var(--color-text-secondary)]">{label}</dt><dd className="text-right">{value}</dd></div>)}</dl>; }
function PathList({ title, paths }: { title: string; paths: string[] }) { return <div><h4 className="text-xs font-medium uppercase text-[var(--color-text-muted)]">{title}</h4><ul className="mt-1 space-y-1">{paths.slice(0, 8).map((path) => <li key={path} className="break-all font-mono text-xs">{path}</li>)}</ul></div>; }
function formatBytes(bytes: number) { if (!bytes) return "0 B"; const units = ["B", "KB", "MB", "GB"]; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
