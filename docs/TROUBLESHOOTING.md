# Troubleshooting

## `ERR_FILE_NOT_FOUND`

Cause: Chrome remembers the exact folder used for an unpacked extension. The folder was moved, renamed, deleted, or is temporarily unavailable.

Fix:

1. remove the broken extension from `chrome://extensions`;
2. unzip/copy the release into a permanent folder;
3. choose **Load unpacked** again;
4. do not move that folder while installed.

This is not a Google Flow project/URL error.

## “No visible editable text boxes detected”

- Make sure the Flow prompt composer is actually visible and enabled.
- Close overlays/modals that hide the composer.
- Wait for the Flow screen to finish loading, reopen the extension, and rescan.
- An editor inside an unsupported cross-origin iframe or closed Shadow DOM will not be detected.

## “Flow replaced the selected text box and it could not be identified safely”

v5.1 automatically handles ordinary React editor replacement. This message means the replacement was too ambiguous to select safely.

Recommended action:

1. keep the intended prompt panel open and visible;
2. remove/close other competing text boxes if possible;
3. run again and manually choose the intended box.

Do not weaken the match threshold merely to suppress this error; typing into the wrong textbox is worse than a controlled failure.

## Debugger/DevTools conflict

If the extension reports that another debugger or DevTools session is attached, close DevTools for that Flow tab and retry.

## References do not bind reliably

Increase, in this order:

1. **Before Enter** — gives Flow more time to populate/filter the reference menu;
2. **After @** — gives Flow time to enter mention mode;
3. **After Enter** — gives Flow time to commit the chosen mention before continuing.

The current release is timing-driven and does not yet verify the exact menu item before Enter.

## Existing text was not cleared

The primary clear path uses browser-level select-all + Backspace. A DOM fallback exists for editors that do not respond normally. If Flow changes its editor semantics, inspect `clearTarget` in `background.js` and `clearTargetDom` in `content.js`.

## Run stops after page navigation

Restart the extension after the destination Flow screen finishes rendering. Current run state is tied to the active document/tab context and selected editor.
