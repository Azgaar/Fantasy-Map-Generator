# Workspace UI Conventions

This document defines the UI rules for the incremental Kantzen migration. It supplements
`docs/architecture/ui_migration_plan.md` and applies to new React workspace panels, dialogs, and editor surfaces.

## Architecture Boundary

- React components present state and collect user intent.
- Controllers validate and apply user-driven world mutations.
- Renderers update SVG or other visual output from world state.
- UI components must not mutate `pack`, `grid`, or SVG directly.
- Compatibility adapters may invoke legacy controls temporarily, but each use must be removed with its owning workflow.
- Editor-specific UI should be lazy-loaded and release listeners, temporary selections, and resources when closed.

## Kantzen Usage

- Prefer an exported Kantzen component before creating a project-level composition.
- Project-level components may combine Kantzen primitives with Fantasia-specific semantics and scoped styles.
- Import the Kantzen theme and only the feature styles in use. Do not import the global reset while legacy UI remains.
- Keep shared workspace components in `src/components/ui/`.
- Do not copy Kantzen component implementations into the repository.

## Layout and Spacing

- Use a 4px base spacing rhythm.
- Common gaps are 4px, 8px, 12px, 16px, and 20px.
- Workspace panel content uses 16px horizontal padding on desktop.
- Group related controls into sections; separate sections with spacing or a subtle token border, not decorative cards.
- Keep primary map context visible unless a task requires a focused modal workflow.
- Avoid horizontal scrolling in panels and dialogs at supported mobile widths.

## Typography

- Panel and dialog titles: 17–18px, semibold.
- Control labels and body copy: 11–12px.
- Section labels: 10px, semibold, uppercase, with restrained letter spacing.
- Secondary descriptions: 10–11px using `--kui-text-muted`.
- Shortcuts and machine values use the project monospace stack.
- Preserve domain vocabulary from `docs/domain/glossary.md`.

## Color and Surfaces

- Use Kantzen semantic tokens instead of literal application colors.
- Primary surfaces use `--kui-surface-panel`; raised controls use `--kui-surface-raised`.
- Hover states use `--kui-surface-hover`.
- Borders use `--kui-line`, `--kui-line-soft`, or `--kui-line-strong`.
- Accent, success, warning, and danger states use their semantic HSL tokens.
- Color must not be the only indicator of selection, validation, or destructive intent.

## Icons

- Use `Icon` and `IconName` from `@patkepa/kantzen-ui/icons`.
- Pair icons with visible labels for primary navigation and actions.
- Icon-only controls require an `aria-label` and tooltip where the meaning is not universally understood.
- Use one icon consistently for the same command across navigation, panels, and dialogs.

## Forms

- Every input has a programmatic label.
- Supporting text is linked with `aria-describedby`.
- Validation errors set `aria-invalid` and remain visible until resolved.
- Required fields show a visual marker and the native `required` attribute where applicable.
- Sliders and color fields display their current value as text.
- Persist settings through controllers or settings services, not inside generic form components.
- Use immediate updates only when they are cheap and safely reversible; otherwise provide Apply and Cancel actions.

## Focus and Keyboard Behavior

- All interactive controls must be reachable and operable by keyboard.
- `:focus-visible` uses the accent token and must not be removed without a replacement.
- Escape closes the topmost dismissible dialog or cancels the active map mode.
- Dialogs move focus inside on open, contain Tab navigation, and restore the prior focus on close.
- Keyboard shortcuts do not fire while the user is editing a text, number, select, or content-editable control.
- Shortcut labels describe implemented behavior; do not display inactive shortcuts.

## Feedback

- Use inline notices for contextual information and recoverable errors.
- Use status semantics for informative or successful updates and alert semantics for errors requiring attention.
- Use empty states when a list has no items or a search has no results.
- Long-running actions expose progress and prevent duplicate submission.
- Error messages explain what happened and what the user can do next.

## Destructive Actions

- Keep destructive and generative actions visually separate from ordinary editing actions.
- State the affected feature and consequence in confirmation copy.
- Confirmation labels use a concrete verb such as Delete, Reset, Replace, or Regenerate.
- Do not use confirmation dialogs for safe, quickly reversible actions.
- Session-level confirmation preferences are acceptable only when the action and scope remain unchanged.

## Responsive Behavior

- Desktop workspace navigation is 260px wide and collapses to a 60px rail.
- Contextual panels must remain usable within the remaining viewport width.
- At narrow widths, panels may overlay the map but must not create horizontal page overflow.
- Touch targets should be at least 28px in dense desktop editors and preferably 36px on touch-oriented layouts.
- Verify the first viewport, scroll behavior, overlays, tooltips, and map gestures at desktop and mobile sizes.

## Verification

For each migrated workflow:

- Add unit coverage for state adapters and reusable UI contracts.
- Update targeted Playwright selectors and expectations without automatically running the full E2E suite.
- Run `npm run lint`, `npm run build`, and `npm run test -- --run`.
- Perform rendered desktop and mobile checks through the in-app Browser when its backend is available.
- Confirm that opening and closing the workflow repeatedly does not duplicate listeners or retain stale state.
