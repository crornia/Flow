# Project Handoff — Flow Prompt Typer

## Current state

The repository represents the finalized v5.1.0 project state as of 2026-09-03.

The extension was originally built to solve a Google Flow workflow problem: long generated prompts contain many references to already-uploaded visual assets. Simply pasting textual `@filename` strings is not equivalent to selecting the corresponding Flow media entry. The extension therefore enters the prompt and performs a separate Flow mention-selection sequence for every detected asset occurrence.

## Product behavior

Primary interaction:

1. User opens the relevant Google Flow page.
2. User opens the extension and pastes a complete prompt.
3. Extension scans the active page for editable text boxes.
4. One target is auto-selected, or multiple candidates are highlighted for manual selection.
5. Existing target content can be cleared.
6. Plain text is inserted efficiently.
7. Each asset reference triggers `@`, asset filename typing, a wait, Enter, and another wait.
8. Repeated references are processed independently.
9. Progress appears in an on-page toast.
10. Debugger/focus protection is cleaned up whether the run succeeds or fails.

## Incident that produced v5.1

A real Flow run produced this failure:

> The selected text box is no longer available on this screen. Run again and choose a box.

The visible Flow prompt composer had not actually disappeared. Flow had rerendered/replaced the editor element. The older logic relied on object identity (`document.contains(oldNode)`), so it interpreted the replacement as target loss.

v5.1 replaced that brittle assumption with target fingerprinting and safe reacquisition. The fix is implemented in `content.js` through `makeProfile`, `scoreCandidate`, `activeTypingHost`, and `reacquireTarget`.

## Other bugs addressed in v5.1

- Timing UI allowed zero, while `Number(value) || default` silently converted zero to the default. `numericSetting` now preserves valid zero values.
- Clearing used macOS Meta+A unconditionally. It now selects Meta on macOS and Control elsewhere.
- `tabs` permission was broader than needed and was removed.
- A v5.1 message namespace prevents a previously injected v5.0 agent from being mistaken for current code.
- Packaging/macOS metadata and installation text were cleaned.

## Design decisions to preserve

- Avoid hard-coded Flow project URLs and route selectors.
- Avoid `<all_urls>` and other broad permissions unless unavoidable.
- Keep user prompt data local.
- Prefer semantic/accessible DOM signals over generated CSS class names.
- Prioritize safe failure over typing into the wrong field.
- Preserve independent handling of repeated asset references.
- Keep the extension lightweight and unpacked-install friendly.

## Current technical debt

### 1. Asset-binding verification

This is the largest remaining issue.

The extension currently increments `refsDone` after executing the binding keystrokes. It does not inspect Flow's suggestion menu or resulting mention object to verify that the intended asset was actually selected.

A future state-aware implementation should distinguish at least:

- suggestion menu never appeared;
- requested asset not found;
- multiple ambiguous candidates;
- exact candidate selected;
- mention committed successfully;
- timeout/retry exhausted.

Do not implement this by binding to transient obfuscated class names if more semantic roles/text/state are available.

### 2. Timing waits

`afterAtMs`, `beforeEnterMs`, and `afterEnterMs` are fixed waits. They make the extension usable across varying Flow latency but are inherently less reliable than condition-based waits.

### 3. Frames and Shadow DOM

Open Shadow DOM is scanned. Closed Shadow DOM and cross-origin iframe editors are not.

### 4. Page navigation

Reloading/navigating the page invalidates the injected agent and target state. The current behavior is to fail/cleanup rather than silently continue in a new document.

## Suggested next version

A sensible v6 roadmap:

1. state-aware autocomplete detection;
2. exact asset candidate validation;
3. post-selection mention verification;
4. bounded retry/backoff rather than arbitrary fixed waits;
5. structured error codes (`ASSET_NOT_FOUND`, `MENU_TIMEOUT`, `TARGET_REPLACED_AMBIGUOUS`, etc.);
6. automated parser/unit tests extracted from background code;
7. optional run report listing each asset occurrence and its verified outcome.

## Files to read first

A new agent should read in this order:

1. `AGENTS.md`
2. `README.md`
3. `background.js`
4. `content.js`
5. `popup.js`
6. `docs/ARCHITECTURE.md`
7. `docs/KNOWN-LIMITATIONS.md`

## Definition of done for future changes

Do not call a release complete only because JavaScript syntax passes. A meaningful release should preserve the manual smoke tests listed in `AGENTS.md`, especially repeated references and long prompts that can trigger Flow rerenders.
