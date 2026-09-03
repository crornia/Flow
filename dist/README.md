# Distribution output

Release ZIPs are generated here and intentionally not required as source-of-truth binaries in Git.

Build the current package from repository source:

```bash
bash scripts/package.sh
```

Expected output for the current release:

```text
dist/Flow-Prompt-Typer-v5.1.0.zip
```

GitHub Actions also builds the ZIP as a workflow artifact after validation.
