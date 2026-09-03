# Known Limitations

## Binding completion is currently optimistic

`refsDone` is incremented after the extension executes the expected key sequence for a reference. v5.1 does not inspect Flow's autocomplete result and resulting mention object to prove the exact requested asset was committed.

Consequence: a slow menu, a missing asset, or an unexpected first result can theoretically be counted as completed even when Flow did not bind the intended media.

Mitigation today: increase timing values and visually verify critical runs.

Preferred future fix: condition-based exact-candidate and mention verification.

## Fixed waits

Flow/server/browser latency varies. The extension exposes delays rather than assuming one machine-independent timing profile.

## Cross-origin iframes

The current injection and scan operate in the main page context. Editors inside inaccessible cross-origin frames are not supported.

## Closed Shadow DOM

Open Shadow DOM is traversed. Closed Shadow roots are intentionally not bypassed.

## Navigation/reload during execution

A page reload or route transition that destroys the current document can terminate target state. The run should be restarted after the new screen settles.

## Existing debugger session

Chrome only permits compatible debugger attachment. Opening DevTools or another debugging extension on the same tab can block Flow Prompt Typer. Close the conflicting debugger and retry.

## Cooperative Stop

Stop marks the run aborted and cancels target selection, but an already-running sleep is not interrupted mid-timer. The abort takes effect at the next run check.

## Keyboard assumptions

Asset names are dispatched through CDP with a small explicit key map and a generic fallback. Standard filenames are supported; unusual keyboard-layout-specific characters may warrant additional testing.
