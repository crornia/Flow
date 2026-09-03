# Security and Privacy

## Current trust model

Flow Prompt Typer is designed as a local Chrome extension. The current v5.1.0 source does not intentionally send prompts, browsing data, credentials, or usage telemetry to an external service.

The codebase currently contains no application-level use of:

- `fetch`;
- XMLHttpRequest;
- WebSocket;
- `navigator.sendBeacon`;
- cookies APIs;
- remote JavaScript execution;
- analytics/telemetry SDKs.

Prompt text and extension settings are persisted with `chrome.storage.local`.

## Chrome permissions

### `activeTab`

Provides temporary access to the tab where the user invokes the extension. This is intentionally used instead of broad permanent host permissions.

### `scripting`

Required to inject `content.js` into the active normal page.

### `storage`

Stores the prompt and extension preferences locally.

### `debugger`

This is the most sensitive permission. It permits access to Chrome DevTools Protocol capabilities. The project currently uses it only for CDP `Input` operations required to emulate browser-level typing and key presses.

Any future change that adds other debugger domains, network interception, cookie/storage extraction, or remote transmission should be treated as a security-significant change and documented explicitly.

## Restricted pages

Chrome blocks extension injection on browser-internal/restricted pages. The extension reports this rather than attempting to bypass the browser security model.

## Reporting issues

For this personal project, open a GitHub issue describing the security/privacy concern without including secrets, account tokens, or private prompt content.
