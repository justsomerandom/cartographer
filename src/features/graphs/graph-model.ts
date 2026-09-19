import type { SourceModule, SourceRelationshipAnalysis } from "@/types/repository";

export const GRAPH_NODE_LIMIT = 250;

export interface GraphFilters {
  query: string;
  languages: string[];
  projects: string[];
  cyclesOnly: boolean;
  crossProjectOnly: boolean;
}

export interface GraphModel {
  nodes: SourceModule[];
  edges: Array<{ source: string; target: string; crossProject: boolean }>;
  cyclePaths: Set<string>;
  omittedNodeCount: number;
}

export const defaultGraphFilters: GraphFilters = {
  query: "",
  languages: [],
  projects: [],
  cyclesOnly: false,
  crossProjectOnly: false,
};

export function buildGraphModel(analysis: SourceRelationshipAnalysis, filters: GraphFilters, limit = GRAPH_NODE_LIMIT): GraphModel {
  const cyclePaths = new Set(analysis.cycles.flatMap((cycle) => cycle.modules));
  const query = filters.query.trim().toLowerCase();
  const eligible = analysis.modules.filter((module) => {
    const languageMatches = filters.languages.length === 0 || filters.languages.includes(module.language);
    const projectMatches = filters.projects.length === 0 || filters.projects.includes(module.projectId ?? "(unassigned)");
    const queryMatches = !query || module.path.toLowerCase().includes(query);
    return languageMatches && projectMatches && queryMatches && (!filters.cyclesOnly || cyclePaths.has(module.path));
  });
  const internalEdges = analysis.relationships
    .filter((relationship) => relationship.status === "internal" && relationship.targetPath)
    .map((relationship) => ({ source: relationship.sourcePath, target: relationship.targetPath as string, crossProject: relationship.crossProject }));
  const crossProjectNodes = new Set(internalEdges.filter((edge) => edge.crossProject).flatMap((edge) => [edge.source, edge.target]));
  const filtered = filters.crossProjectOnly ? eligible.filter((module) => crossProjectNodes.has(module.path)) : eligible;
  const ranked = [...filtered].sort((a, b) => (b.incomingCount + b.outgoingCount) - (a.incomingCount + a.outgoingCount) || a.path.localeCompare(b.path));
  const nodes = ranked.slice(0, limit);
  const nodePaths = new Set(nodes.map((node) => node.path));
  const edges = internalEdges.filter((edge) => nodePaths.has(edge.source) && nodePaths.has(edge.target) && (!filters.crossProjectOnly || edge.crossProject));

  return { nodes, edges, cyclePaths, omittedNodeCount: Math.max(0, filtered.length - nodes.length) };
}

export function graphNeighbors(model: GraphModel, path: string): Set<string> {
  const neighbors = new Set<string>([path]);
  for (const edge of model.edges) {
    if (edge.source === path) neighbors.add(edge.target);
    if (edge.target === path) neighbors.add(edge.source);
  }
  return neighbors;
}
