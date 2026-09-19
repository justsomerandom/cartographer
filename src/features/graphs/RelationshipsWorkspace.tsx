"use client";

import { useState } from "react";
import type { SourceRelationshipAnalysis } from "@/types/repository";
import { RelationshipGraph } from "./RelationshipGraph";

export function RelationshipsWorkspace({ sourceRelationships }: { sourceRelationships: SourceRelationshipAnalysis }) {
  const [selected, setSelected] = useState(sourceRelationships.summary.highestFanOut[0]?.path ?? sourceRelationships.modules[0]?.path);
  const dependencies = sourceRelationships.relationships.filter((entry) => entry.status === "internal" && entry.sourcePath === selected);
  const dependents = sourceRelationships.relationships.filter((entry) => entry.status === "internal" && entry.targetPath === selected);
  const moduleInfo = sourceRelationships.modules.find((entry) => entry.path === selected);
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"><RelationshipGraph analysis={sourceRelationships} onSelect={setSelected} /><aside className="rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4"><h3 className="text-[15px] font-semibold">Selected module</h3>{moduleInfo ? <dl className="mt-3 space-y-2 text-sm"><div><dt className="text-[var(--color-text-secondary)]">Path</dt><dd className="break-all font-mono text-xs">{moduleInfo.path}</dd></div><div><dt>Depends on</dt><dd>{dependencies.length}</dd></div><div><dt>Depended on by</dt><dd>{dependents.length}</dd></div><div><dt>External imports</dt><dd>{moduleInfo.externalImportCount}</dd></div><div><dt>Unresolved</dt><dd>{moduleInfo.unresolvedImportCount}</dd></div></dl> : <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Select a module in the graph.</p>}</aside></div>;
}
