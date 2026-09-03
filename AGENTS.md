# AGENTS.md — Flow Prompt Typer

This file is the canonical coding-agent handoff for this repository.

## Mission

Maintain a small, local-first Chrome Manifest V3 extension that can enter large prompts into Google Flow and convert every supported asset-reference occurrence into an independent real Flow mention-selection attempt.

Current stable version: **5.1.0**.

## Non-negotiable behavior

Do not regress these properties without an explicit product decision:

1. **No hard-coded Flow project URL or project ID.** The extension must work from the active normal tab and discover editable targets dynamically.
2. **Repeated references remain repeated operations.** `@5 ... @5 ... @5` must produce three independent `@ → 5 → Enter` sequences.
3. **Do not broaden permissions casually.** Prefer `activeTab`; do not add `<all_urls>` unless a documented feature truly requires it.
4. **Keep execution local.** No telemetry, analytics, remote code, prompt uploads, or external APIs unless the owner explicitly requests them.
5. **Debugger usage stays narrow.** The extension currently uses CDP only for input dispatch/insertion.
6. **Flow editor replacement must be tolerated.** React/Flow may replace the prompt DOM node during a run. Preserve the target profile and reacquire the same visible editor safely.
7. **Never silently jump to an ambiguous textbox.** If reacquisition confidence is weak, fail visibly rather than type into another field.
8. **Zero timing values are valid where the UI permits them.** Do not use `Number(value) || fallback` for settings where `0` is meaningful.
9. **Cross-platform select-all.** macOS uses Meta/Command; Windows/Linux use Control.
10. **Keep the extension dependency-free unless there is a concrete need.** It should remain load-unpacked friendly.

## Current architecture

- `popup.html`, `popup.css`, `popup.js`: prompt/settings UI, page scan, run/stop commands.
- `background.js`: parser, run state, CDP debugger/input, timing, orchestration.
- `content.js`: editable-field discovery, target selection, target fingerprint/reacquisition, focus/caret management, click shield, progress toast.
- `manifest.json`: MV3 configuration and permissions.

The message namespace is `FPT51_*`. If protocol semantics change incompatibly, bump the namespace with the extension version so an old injected page agent cannot accidentally answer newer commands.

## Important v5.1 bug history

The previous build stored only a direct DOM reference to the selected editor. Google Flow can rerender its prompt composer and replace that DOM node while leaving a visually identical prompt box on screen. The old build then raised an error equivalent to:

> The selected text box is no longer available on this screen.

v5.1 fixes this by preserving a target profile containing semantic metadata and geometry, then reacquiring a replacement candidate using a confidence score. The active typing host is preferred when it strongly matches. Do not remove this mechanism.

## Known limitations / highest-value future work

Priority 1 is **state-aware reference verification**.

Today the extension does:

```text
focus → @ → filename → fixed wait → Enter → fixed wait → count as done
```

It does not yet prove that Flow displayed the intended autocomplete candidate or that Enter committed the exact asset mention. A future version should, if possible:

1. detect the Flow autocomplete/menu state;
2. wait for an exact filename candidate with a bounded timeout;
3. refuse ambiguous/non-matching results;
4. commit the candidate;
5. verify a resulting mention/chip/editor state before incrementing the success count.

Do this with resilient semantics rather than fragile generated class names. Preserve a timeout/fallback path because Flow DOM details can change.

Other limitations:

- cross-origin iframe editors are not scanned;
- closed Shadow DOM cannot be traversed;
- navigation/reload during a run terminates the injected context;
- another DevTools/debugger attachment can block `chrome.debugger.attach`;
- fixed timing remains sensitive to Flow/server/client latency;
- the Stop command is cooperative rather than instant during a sleep.

## Validation before committing

Run:

```bash
node scripts/validate.mjs
```

At minimum verify:

- `manifest.json` parses;
- `node --check` passes for `background.js`, `content.js`, `popup.js`;
- all manifest icon/popup/background files exist;
- no accidental `__MACOSX`, `.DS_Store`, secrets, or credentials;
- no unexpected network/telemetry primitives are introduced;
- the distributable ZIP contains the runtime extension at its root (not nested in an extra folder).

Manual Flow smoke test when possible:

1. page with one prompt editor;
2. page with multiple editable fields and chooser;
3. plain text only;
4. one asset reference;
5. repeated same asset reference;
6. several distinct references;
7. prompt long enough to trigger Flow editor rerenders/height changes;
8. clear-existing enabled and disabled;
9. timing value set to `0` where allowed;
10. Stop/reopen behavior;
11. Flow tab with DevTools open to verify the debugger-conflict error remains clear.

## Release procedure

When releasing a new version:

1. update `manifest.json` version;
2. update the version shown in `popup.html`;
3. update `VERSION` and, if needed, message namespace in `content.js`/`background.js`/`popup.js`;
4. update `CHANGELOG.md`;
5. update README/install docs where necessary;
6. run validation;
7. build `dist/Flow-Prompt-Typer-vX.Y.Z.zip` from runtime files only;
8. inspect ZIP contents;
9. commit source and distribution artifact together.

See `docs/RELEASE.md` for the exact packaging list.
