# CUBE Codex Update

This file is intended for Codex agents. Follow these steps to update the installed CUBE workflow plugin, clear stale plugin cache, and verify that the refreshed install includes the TypeScript preset files required by stage checks.

Canonical repository:

`https://github.com/wangding75/wf`

## Prerequisites

- Git
- Node.js 18 or newer
- A Codex environment that supports local plugins and marketplace metadata

## Update

1. Refresh a temporary clone of the repository:

```bash
rm -rf /tmp/wf-cube-update
git clone --depth 1 https://github.com/wangding75/wf.git /tmp/wf-cube-update
```

2. Replace the installed local plugin under the home-local Codex plugin directory:

```bash
mkdir -p "$HOME/plugins"
if [ -e "$HOME/plugins/cube" ]; then
  mv "$HOME/plugins/cube" "$HOME/plugins/cube.backup.$(date +%Y%m%d%H%M%S)"
fi
cp -R /tmp/wf-cube-update/plugins/cube "$HOME/plugins/cube"
chmod +x "$HOME/plugins/cube/bin/"*
npm install --prefix "$HOME/plugins/cube"
```

3. Clear stale cached plugin versions so Codex does not keep using an older package snapshot:

```bash
rm -rf "$HOME/.codex/plugins/cache/wangding75-wf/cube"
```

4. Verify the refreshed install:

```bash
test -f "$HOME/plugins/cube/.codex-plugin/plugin.json"
test -x "$HOME/plugins/cube/bin/cube-check"
test -f "$HOME/plugins/cube/presets/typescript/deliverables/01-prd.yaml"
node "$HOME/plugins/cube/engine/check-schema-coverage.mjs" "$HOME/plugins/cube/presets/typescript"
```

5. Restart Codex if the plugin list is already loaded. Then install or enable the `cube` plugin again from the local marketplace if Codex prompts for it.

## Result

After the update, Codex should load the refreshed `cube` plugin instead of an older cached version that may be missing non-Java presets. This specifically fixes failures like:

- `01-prd.yaml not found at .../presets/typescript/deliverables/01-prd.yaml`

## Usage

In Codex, run:

```text
Fetch and follow instructions from https://raw.githubusercontent.com/wangding75/wf/refs/heads/main/UPDATE.md
```
