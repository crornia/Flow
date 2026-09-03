# Flow Prompt Typer

Chrome Manifest V3 extension for entering long prompts into Google Flow while converting asset references such as `@5`, `@1.01.jpg`, `{{filename.png}}`, and `@[filename with spaces.png]` into repeated Flow mention-selection sequences.

Current release: **v5.1.0**.

## Why it exists

Large Flow prompts often contain many media references. Pasting the prompt as plain text does not necessarily create real Flow asset bindings. Flow Prompt Typer automates the interaction required for each occurrence:

```text
@ → exact asset name → Enter
```

Repeated references stay repeated. For example:

```text
@5 ... @5 ... @5
```

is processed as three independent mention operations, not as one alias reused three times.

## v5.1.0 status

v5.1.0 fixes the editor-loss failure seen when Google Flow/React replaces the prompt editor DOM node while a run is active. The selected editor is fingerprinted and can be reacquired using semantic metadata and screen geometry instead of relying on one stale DOM object.

Additional v5.1 fixes:

- honors valid `0 ms` timing values rather than replacing them with defaults;
- uses `Command+A` on macOS and `Ctrl+A` on Windows/Linux;
- removes the unnecessary `tabs` permission;
- requires Chrome 118+ for more reliable Manifest V3 service-worker behavior during an active debugger session;
- uses a v5.1 message namespace so older injected v5.0 agents do not answer v5.1 commands;
- keeps project/screen discovery dynamic rather than hard-coding a Google Flow project URL.

## Install

1. Download or build `dist/Flow-Prompt-Typer-v5.1.0.zip`.
2. Unzip it into a **permanent folder** that you will not rename, move, or delete.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Remove older Flow Prompt Typer builds if present.
6. Click **Load unpacked**.
7. Select the extracted extension folder.
8. Open a normal Google Flow page and invoke the extension.

If Chrome shows `ERR_FILE_NOT_FOUND`, the unpacked-extension folder Chrome remembered was moved, renamed, or deleted. Reinstall it from a permanent folder.

## Usage

1. Open the Flow screen containing the target prompt box.
2. Open Flow Prompt Typer.
3. Paste the complete prompt into the extension popup.
4. Confirm the detected reference count.
5. Click **Type into Current Page**.
6. If one editable target exists, it is selected automatically. If multiple exist, click the desired field in the on-page chooser.
7. Keep the Flow tab active while the run completes.

Supported reference syntax:

```text
@1
@5
@1.01.jpg
{{filename.png}}
@[filename with spaces.png]
```

Raw `@...` parsing can be disabled in the popup.

## Default timing

| Setting | Default |
|---|---:|
| Filename key delay | 6 ms |
| After `@` | 45 ms |
| Before Enter | 220 ms |
| After Enter | 160 ms |

These are compatibility waits, not proof that Flow has finished rendering its mention menu. Increase them if Flow is slow or asset selection becomes unreliable.

## Architecture

```text
Popup UI
   ↓ runtime messages
MV3 service worker (`background.js`)
   ↓
Injected page agent (`content.js`)
   ↓ focus/reacquisition
Selected Flow editor
   ↑
Chrome Debugger / CDP Input events
```

The extension deliberately uses `activeTab` and runtime injection instead of a broad host permission or hard-coded Flow URL.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for implementation details.

## Privacy and permissions

The current source contains no telemetry, remote code loading, analytics, `fetch`, XHR, WebSocket, cookie access, or credential collection. Prompt/settings data is stored locally with `chrome.storage.local`.

Permissions:

- `activeTab` — temporary access to the tab where the user invokes the extension;
- `scripting` — injects the page agent;
- `storage` — persists the prompt and settings locally;
- `debugger` — sends browser-level keyboard input through Chrome DevTools Protocol.

`debugger` is a powerful Chrome permission. This project intentionally uses it only for CDP `Input` commands.

See [SECURITY.md](SECURITY.md).

## Known limitations

The current implementation is robust against the editor-rerender bug, but it is still partly timing-driven.

Most importantly, the completion counter means the extension **attempted** each `@ → filename → Enter` binding sequence. It does not yet inspect Flow's autocomplete DOM and cryptographically/deterministically prove that the intended asset was selected. This is the main remaining reliability improvement for a future version.

Other limitations include cross-origin iframes, closed Shadow DOM, page navigation/reload during a run, and conflicts when DevTools or another debugger is already attached to the same tab.

See [docs/KNOWN-LIMITATIONS.md](docs/KNOWN-LIMITATIONS.md).

## Development

No package manager or build step is required. The extension is plain HTML/CSS/JavaScript.

Validate locally:

```bash
node scripts/validate.mjs
```

The repository also runs the same checks through GitHub Actions.

## Repository map

```text
.
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.css
├── popup.js
├── icons/
├── dist/
├── docs/
├── scripts/
├── .github/workflows/validate.yml
├── AGENTS.md
├── CHANGELOG.md
├── SECURITY.md
└── INSTALL-ME.txt
```

## Handoff

For the complete project state, design constraints, known issues, and next-step priorities, read:

- [AGENTS.md](AGENTS.md)
- [docs/PROJECT-HANDOFF.md](docs/PROJECT-HANDOFF.md)

Those files are intended to let a new coding agent continue the project without this ChatGPT conversation.
