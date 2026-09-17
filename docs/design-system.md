# Cartographer Design System

Cartographer is an engineering analysis tool. The interface should feel precise, calm, dense, and trustworthy. Visual polish is useful only when it improves scan order, comprehension, or confidence in the analysis.

## Design Principles

- Information hierarchy comes before decoration. Page composition should answer the page's main question first.
- Color is scarce and semantic. Neutral surfaces carry the interface; cyan marks interaction and information; green, amber, and red are reserved for state.
- Dense does not mean cramped. Related items sit close together, while major analytical sections have clear separation.
- Tables remain first-class. Repository intelligence contains long paths, counts, manifests, and commits, so table readability matters as much as chart space.
- Future visualizations should occupy intentional regions, not retrofitted cards.

## Palette And Semantics

Cartographer uses a neutral gray base with a subtle cool tint. The primary accent is cyan because it reads well against both the light content area and the dark sidebar without competing with warning or success states.

- Background: quiet cool neutral for the full app canvas.
- Primary surface: white for core analytical content.
- Subtle surface: cool off-white for grouped details and placeholders.
- Sidebar: dark graphite so navigation recedes behind repository analysis.
- Accent: cyan for navigation selection, primary action, links, and informational emphasis.
- Success: green for saved, clean, and steady states.
- Warning: amber for attention states such as dirty Git, cycles, unresolved imports, and elevated hotspots.
- Danger: red only for missing resources, errors, and destructive actions.

Hotspot importance is not represented as red by default. A high hotspot is an investigation priority, not necessarily a failure.

## Visualization Colors

Chart tokens are separate from UI semantic tokens. Planned visualization hues include blue, cyan, teal, green, amber, red, indigo, and slate. These should be used as stable categorical colors where practical, supported by labels, legends, ordering, and shape or size encodings where needed.

Avoid rainbow palettes and decorative gradients. Use gradients only for true sequential scales.

## Typography

The interface uses a system sans-serif stack for UI text and a monospace stack only for technical values such as paths, branches, commit hashes, manifests, and package identifiers.

Scale:

- Page title: 24px, semibold.
- Section title: 20px, semibold.
- Panel title: 15px, semibold.
- Body/table text: 14px.
- Supporting text: 13px.
- Metadata and badges: 12px.

Font weight is deliberately restrained: 400 for body, 500 for labels/navigation, 600 for headings and important metrics, and 700 only when a value must dominate.

## Spacing And Grid

The spacing scale is 8px-oriented: 4, 8, 12, 16, 24, 32, 40, 48, and 64px. Components use tighter spacing internally and larger gaps between analytical sections.

The desktop layout targets 1366-1920px engineering workspaces:

- Sidebar: 256px.
- Main page padding: 24-32px.
- Content max width: 100rem.
- Major sections: 24-32px separation.

## Surfaces, Borders, And Radius

Panels use 8px radius, subtle borders, and little to no shadow. Normal analytical content is not elevated; elevation is reserved for future menus, dialogs, and overlays.

Surface roles:

- Primary panels contain analytical summaries, tables, or details.
- Subtle panels contain contextual or secondary content.
- Visualization panels reserve canvas-like space for future charts and graphs.
- Dashed empty states communicate absence without visual drama.

## Icons

Icons are used for navigation recognition, app identity, actions, and compact status concepts. They are line-based, 14-16px in normal UI, and never placed in oversized decorative circles. Icon-only controls should have accessible labels or visible text.

## Dashboard Hierarchy

Overview answers: what is this repository, what is its overall state, and where should I look first? Its hierarchy is:

1. Repository state and engineering attention.
2. Core repository metrics.
3. Purposeful visualization regions.
4. Recent Git and project context.

Detail pages answer narrower questions:

- Files: what files dominate the repository footprint?
- Dependencies: what projects and declarations exist?
- Relationships: how is the source structurally connected?
- Hotspots: which files deserve investigation and why?
- Git: what does local history say about activity and churn?
- Project: what repository metadata signals exist?

## Accessibility

Semantic color is paired with labels and text. Focus states use the accent color and remain visible. Tables use readable row heights, explicit headers, tabular numerals for numeric comparisons, and selected-row state via both color and `aria-selected`.

Future charts must include close legends, non-color encodings for critical distinctions, and text equivalents for important findings.

## Density

Cartographer should feel closer to serious developer tools than to marketing dashboards. The design avoids giant cards, decorative hero areas, excessive shadows, glass effects, and ornamental gradients. Density is achieved through grouped metrics, compact tables, and reserved visualization regions sized for real analysis.
