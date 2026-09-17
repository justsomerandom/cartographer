# AGENTS.md

## Project Purpose

Cartographer is intended to become a local-first repository intelligence and visualization tool for understanding project structure, language usage, dependencies, Git activity, and module relationships.

## Engineering Priorities

- Accuracy and transparency in repository analysis.
- Clear separation between UI features and server-side source analysis.
- Safe local filesystem access with explicit user-selected repositories.
- Maintainable TypeScript boundaries between features, analysis, parsing, and Git integration.
- Testability with fixture repositories.
- Minimal unnecessary dependencies.

## Architecture Rules

- Keep UI feature code under `src/features`.
- Keep reusable UI primitives in `src/components`.
- Keep local repository analysis under `src/server/analysis`.
- Keep Git-specific behavior under `src/server/git`.
- Keep parsing integrations under `src/server/parsers`.
- Keep shared types in `src/types`.
- Treat repository analysis output as structured data, not ad hoc UI-only state.
- Do not promise universal control-flow analysis unless implemented and tested.

## Coding Guidelines

- Use idiomatic TypeScript with explicit types at important boundaries.
- Prefer simple data structures before introducing complex graph abstractions.
- Do not introduce unnecessary abstractions.
- Do not silently change architecture or feature ownership.
- Do not add technologies merely for resume value.
- Prefer well-maintained libraries.
- Preserve backwards compatibility once public APIs exist.
- Validate external input, especially repository paths and parsed metadata.
- Keep secrets out of the repository.
- Avoid generated code unless justified and documented.
- Add tests with meaningful behavior changes.
- Document non-obvious design decisions.

## Testing

Future tests should use fixture repositories to cover file discovery, language statistics, Git metadata extraction, dependency parsing, graph construction, and UI rendering of analysis states.

## Documentation

Update `README.md` and `docs/` when architecture, analysis capabilities, data models, or user-visible behavior changes.

## Agent Workflow

Before making significant changes:

1. Inspect the existing architecture.
2. Understand relevant domain code.
3. Make the smallest coherent change.
4. Run relevant formatting, linting, and tests.
5. Summarize architectural consequences.

`AGENTS.md` may be expanded as this project matures.
