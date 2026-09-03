# Changelog

All notable project changes should be recorded here.

## 5.1.0 — 2026-09-03

### Fixed

- Reacquires the selected Flow prompt editor when Flow/React replaces the underlying DOM node during typing.
- Uses semantic metadata and geometry scoring to avoid silently switching to the wrong textbox after a rerender.
- Correctly honors `0 ms` values for timing fields that permit zero.
- Uses Command+A on macOS and Ctrl+A on Windows/Linux when clearing an existing prompt.
- Prevents an old v5.0 injected agent from handling v5.1 commands by moving to the `FPT51_*` message namespace.

### Changed

- Removed the unnecessary `tabs` permission.
- Added `minimum_chrome_version: 118`.
- Cleaned installation/distribution guidance.

### Known limitation

- A reference is currently counted after the extension performs the `@ → filename → Enter` sequence. The extension does not yet verify the exact Flow autocomplete result/mention chip before declaring that attempt complete.

## 5.0.0

- Dynamic active-tab injection instead of project-specific Flow URLs.
- Editable-field discovery and on-page target chooser.
- Repeated asset references processed independently.
- Chrome debugger/CDP input dispatch.
- Configurable timing and local prompt/settings persistence.
