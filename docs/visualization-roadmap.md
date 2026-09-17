# Cartographer Visualization Roadmap

Visualization regions are layout commitments for future analytical work. They should be populated only with real repository data and clear interaction models.

## Overview: Repository Composition

- User question: What is this repository made of?
- Type: compact bar or stacked composition chart.
- Data source: `RepositoryAnalysis.languages`, `DependencyAnalysis.summary.technologies`.
- Semantics: language share by lines/bytes, technology categories by detected evidence.
- Color: stable categorical chart colors; TypeScript/JavaScript should keep consistent hues across views where practical.
- Interactions: hover detail, click to filter Files or Dependencies later.
- Priority: medium.

## Overview/Git: Engineering Activity

- User question: How active is this repository?
- Type: compact activity sparkline or small time-series panel.
- Data source: `GitSummary.recentCommits`, future historical bucket aggregation.
- Semantics: commits over time, file touches, contributor count.
- Color: cyan for commits, slate for supporting history, amber overlays for unusually high churn.
- Interactions: range selection and link to Git detail later.
- Priority: medium.

## Overview/Relationships: Architecture Summary

- User question: How connected is the codebase at a glance?
- Type: compact structural summary or mini network overview.
- Data source: `SourceRelationshipAnalysis.summary`, modules, relationships, cycles.
- Semantics: modules, internal edges, unresolved imports, cyclic groups.
- Color: neutral graph base, cyan selected elements, amber cycle overlays.
- Interactions: link to Relationships page.
- Priority: medium.

## Dependencies: Dependency And Workspace Map

- User question: How are projects and dependencies arranged?
- Type: bipartite or grouped dependency map.
- Data source: `DependencyAnalysis.projects`, direct dependencies, repeated dependency declarations.
- Semantics: projects connect to direct dependencies; dependency category and ecosystem are encoded separately.
- Color: ecosystem/category colors from visualization palette, not status colors unless warning overlays are needed.
- Interactions: filter by ecosystem/category, select project/dependency, highlight repeated declarations.
- Priority: medium-high.

## Relationships: Architecture Network Graph

- User question: How is this project structurally connected?
- Type: interactive network graph.
- Data source: `SourceRelationshipAnalysis.modules`, `relationships`, `cycles`, unresolved imports.
- Node semantics: source module path, language, project id, fan-in/fan-out, cycle membership.
- Edge semantics: resolved internal import relationship.
- Color: module language/project category; amber outline for cycle membership; distinct unresolved import indicators outside the core graph.
- Interactions: pan, zoom, search, filter, hover, select node, highlight direct neighbors, reset view.
- Priority: high.

## Hotspots: Churn Vs Centrality Scatter

- User question: Which files combine high churn and high structural importance?
- Type: scatter plot.
- Data source: `HotspotAnalysis.hotspots`.
- X: Git churn percentile.
- Y: incoming relationship centrality percentile.
- Size: file size or line count.
- Overlays: cycle membership, marker density, test-awareness flag.
- Color: neutral-to-cyan intensity for score; amber outline for cycle/attention overlays.
- Interactions: hover reason summary, select hotspot, filter by category.
- Priority: high.

## Git: Commit And Churn Timeline

- User question: How has work changed over time?
- Type: wide time-series chart.
- Data source: `GitSummary.recentCommits`, future bucketed history from Git analysis.
- Semantics: commits, file touches, contributor activity, churn distribution.
- Color: cyan for commit count, indigo/slate for secondary series, amber for notable spikes.
- Interactions: range brush, contributor filter, selected time window.
- Priority: medium-high.

## Future: Repository Evolution

- User question: How did repository structure and hotspots evolve?
- Type: historical snapshots and trend comparisons.
- Data source: future saved analysis snapshots.
- Semantics: language mix, dependency count, graph complexity, hotspot movement.
- Color: sequential intensity for change over time, semantic overlays only for warnings/errors.
- Interactions: compare snapshots, inspect delta, link to changed files.
- Priority: later.
