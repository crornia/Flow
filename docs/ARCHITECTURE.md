# Architecture

## Overview

Flow Prompt Typer is a dependency-free Chrome Manifest V3 extension. It separates the popup UI, browser-level input orchestration, and page DOM interaction into three modules.

```text
popup.js
  │
  │ chrome.runtime messages
  ▼
background.js (MV3 service worker)
  │                         │
  │ chrome.tabs messages    │ chrome.debugger / CDP Input
  ▼                         ▼
content.js               browser input pipeline
  │
  ▼
Flow page/editor DOM
```

## `popup.js`

Responsibilities:

- obtains the active tab;
- asks the service worker to scan the page;
- displays detected editor count;
- stores/restores prompt and timing settings using `chrome.storage.local`;
- parses/analyzes prompt reference counts through the service worker;
- starts/stops runs.

The popup closes shortly after starting a run. Progress remains visible through the on-page toast. Reopening the popup can discover an active run through `FPT51_STATUS`.

## `background.js`

Responsibilities:

- parses supported reference syntax;
- calculates reference statistics;
- injects/validates the v5.1 content agent;
- attaches `chrome.debugger` to the active tab;
- sends CDP input events;
- clears the selected target when requested;
- coordinates text segments and reference segments;
- owns per-tab run/abort state;
- publishes progress;
- detaches the debugger and removes focus protection in `finally` cleanup.

### Prompt parser

When raw-at parsing is enabled, the parser recognizes:

```text
{{asset}}
@[asset with spaces]
@asset
```

The raw-at pattern deliberately requires a left boundary that avoids common email-like text.

The parsed prompt becomes an ordered segment list such as:

```json
[
  {"type":"text","value":"Use "},
  {"type":"reference","value":"5"},
  {"type":"text","value":" again "},
  {"type":"reference","value":"5"}
]
```

Text segments are inserted with CDP `Input.insertText`. Reference segments are executed as explicit key sequences.

## `content.js`

Responsibilities:

- recursively discovers editable typing hosts in the document and open Shadow DOM;
- filters invisible/disabled/readonly/non-typing wrappers;
- labels candidates using ARIA, placeholder, associated labels, nearby text, and current content;
- provides an on-page chooser when several candidates exist;
- fingerprints the selected target;
- reacquires the target after a Flow/React rerender;
- focuses the editor and places the caret at the end;
- provides DOM-level clearing fallback;
- optionally installs a click shield while typing;
- displays on-page progress/error/success messages.

## Editor reacquisition

### Problem

Modern React applications can replace a DOM node rather than mutate it. A direct JavaScript reference to the original editor then becomes stale even though the same apparent textbox remains visible.

### v5.1 solution

When an editor is selected, `content.js` records a profile:

- tag name;
- role;
- ARIA label;
- placeholder;
- derived label;
- bounding rectangle.

If the original target is no longer valid, candidates are rescanned. The active typing host is preferred when it strongly matches the profile. Otherwise candidates are scored using semantic equality and geometric similarity.

A replacement is accepted only when sufficiently confident. Ambiguous matches cause a visible failure rather than typing into an arbitrary editor.

## Why CDP input is used

Flow's rich UI may distinguish actual browser input behavior from JavaScript-created synthetic DOM events. The background service worker therefore attaches Chrome's debugger API and uses DevTools Protocol `Input` commands for the main typing path.

The project intentionally avoids using unrelated CDP domains.

## Permissions philosophy

The extension uses `activeTab` so access is user-invoked and temporary. There is no permanent Flow host permission and no project URL whitelist. This also makes the core mechanism reusable if Flow routes change.
