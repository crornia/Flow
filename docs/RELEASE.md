# Release Procedure

## Runtime package contents

The distributable ZIP must contain these files at the ZIP root:

```text
manifest.json
background.js
content.js
popup.html
popup.css
popup.js
INSTALL-ME.txt
README.md
icons/icon16.png
icons/icon32.png
icons/icon48.png
icons/icon128.png
```

Do not package `.git`, `docs`, `.github`, `scripts`, `.DS_Store`, or `__MACOSX` into the load-unpacked release ZIP.

## Release checklist

1. Update version in `manifest.json`.
2. Update visible popup version.
3. Update content-script `VERSION`.
4. Change the internal `FPTxx_*` namespace only when required for incompatible content/background messaging.
5. Update `CHANGELOG.md`.
6. Run `node scripts/validate.mjs`.
7. Run `bash scripts/package.sh`.
8. Run `unzip -l dist/Flow-Prompt-Typer-vX.Y.Z.zip` and inspect paths.
9. Test Load unpacked from a clean permanent folder.
10. Run the manual Flow smoke tests from `AGENTS.md`.
11. GitHub Actions will also publish the generated ZIP as a workflow artifact.
