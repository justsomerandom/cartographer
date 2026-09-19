"use client";

import { useCallback, useMemo, useState } from "react";
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node, type NodeMouseHandler, useReactFlow } from "@xyflow/react";

import { buildGraphModel, defaultGraphFilters, graphNeighbors, type GraphFilters } from "./graph-model";
import type { SourceRelationshipAnalysis } from "@/types/repository";

const languageColors: Record<string, string> = { typescript: "#2874a6", javascript: "#b7791f", python: "#18886f", rust: "#b44b52", go: "#5665a8" };

export function RelationshipGraph({ analysis, onSelect }: { analysis: SourceRelationshipAnalysis; onSelect?: (path: string) => void }) {
  const [filters, setFilters] = useState<GraphFilters>(defaultGraphFilters);
  const [selected, setSelected] = useState<string>();
  const model = useMemo(() => buildGraphModel(analysis, filters), [analysis, filters]);
  const neighborPaths = useMemo(() => (selected ? graphNeighbors(model, selected) : new Set<string>()), [model, selected]);
  const nodes: Node[] = useMemo(() => model.nodes.map((module, index) => ({
    id: module.path, position: { x: (index % 16) * 150, y: Math.floor(index / 16) * 90 },
    data: { label: module.path.split("/").at(-1) },
    style: { width: 128, borderRadius: 6, padding: "7px 9px", fontSize: 11, border: `2px solid ${model.cyclePaths.has(module.path) ? "#b7791f" : languageColors[module.language] ?? "#667682"}` },
    className: selected && !neighborPaths.has(module.path) ? "opacity-25" : "",
  })), [model, neighborPaths, selected]);
  const edges: Edge[] = useMemo(() => model.edges.map((edge, index) => ({ id: `${edge.source}-${edge.target}-${index}`, source: edge.source, target: edge.target, animated: edge.crossProject, style: { stroke: edge.crossProject ? "#b7791f" : "#8fa2ad", opacity: selected && !neighborPaths.has(edge.source) && !neighborPaths.has(edge.target) ? 0.1 : 1 } })), [model, neighborPaths, selected]);
  const select: NodeMouseHandler = useCallback((_, node) => { setSelected(node.id); onSelect?.(node.id); }, [onSelect]);
  const languages = [...new Set(analysis.modules.map((module) => module.language))].sort();
  const projects = [...new Set(analysis.modules.map((module) => module.projectId ?? "(unassigned)"))].sort();
  const toggle = (field: "languages" | "projects", value: string) => setFilters((current) => ({ ...current, [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : [...current[field], value] }));

  if (analysis.modules.length === 0) return <p className="text-sm text-[var(--color-text-secondary)]">No supported source modules were detected.</p>;
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2" aria-label="Graph filters">
      <input aria-label="Search modules" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Search modules" className="min-h-8 rounded border border-[var(--color-border)] bg-white px-2 text-sm" />
      {languages.map((language) => <FilterButton key={language} active={filters.languages.includes(language)} onClick={() => toggle("languages", language)}>{language}</FilterButton>)}
      {projects.length > 1 ? projects.map((project) => <FilterButton key={project} active={filters.projects.includes(project)} onClick={() => toggle("projects", project)}>{project}</FilterButton>) : null}
      <FilterButton active={filters.cyclesOnly} onClick={() => setFilters((current) => ({ ...current, cyclesOnly: !current.cyclesOnly }))}>cycles</FilterButton>
      <FilterButton active={filters.crossProjectOnly} onClick={() => setFilters((current) => ({ ...current, crossProjectOnly: !current.crossProjectOnly }))}>cross-project</FilterButton>
    </div>
    {model.omittedNodeCount > 0 ? <p className="text-xs text-[var(--color-text-secondary)]">Showing the {model.nodes.length} most connected matching modules; {model.omittedNodeCount} are omitted to keep this graph responsive. Narrow the filters or search to inspect them.</p> : null}
    <div className="h-[34rem] overflow-hidden rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)]" aria-label="Interactive module relationship graph">
      <ReactFlow nodes={nodes} edges={edges} onNodeClick={select} fitView minZoom={0.15} maxZoom={2} nodesDraggable={false} proOptions={{ hideAttribution: true }}>
        <Background gap={18} size={1} color="#d8e2e7" /><Controls showInteractive={false} /><MiniMap zoomable pannable nodeColor={(node) => node.style?.borderColor as string ?? "#667682"} />
      </ReactFlow>
    </div>
    <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)]"><span>Node border: language</span><span className="text-[var(--color-warning)]">Amber: cycle member</span><span>Animated edge: cross-project</span>{selected ? <span>Selected: {selected}</span> : null}</div>
  </div>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`min-h-8 rounded border px-2 text-xs font-medium ${active ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]" : "border-[var(--color-border)] bg-white text-[var(--color-text-secondary)]"}`}>{children}</button>;
}
