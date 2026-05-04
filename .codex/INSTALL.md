# CUBE Codex Installation

This file is intended for Codex agents. Follow these steps to install the CUBE workflow plugin from the canonical GitHub repository:

`https://github.com/wangding75/wf`

## Prerequisites

- Git
- Node.js 18 or newer
- A Codex environment that supports local plugins and marketplace metadata

## Install Or Upgrade

1. Clone the repository to a temporary location:

```bash
git clone --depth 1 https://github.com/wangding75/wf.git /tmp/wf-cube-install
```

If `/tmp/wf-cube-install` already exists, remove it or choose another temporary path before cloning.

2. Install the plugin under the home-local Codex plugin directory:

```bash
mkdir -p "$HOME/plugins"
if [ -e "$HOME/plugins/cube" ]; then
  mv "$HOME/plugins/cube" "$HOME/plugins/cube.backup.$(date +%Y%m%d%H%M%S)"
fi
cp -R /tmp/wf-cube-install/plugins/cube "$HOME/plugins/cube"
chmod +x "$HOME/plugins/cube/bin/"*
npm install --prefix "$HOME/plugins/cube"
```

3. Ensure `$HOME/.agents/plugins/marketplace.json` contains this entry. If the file does not exist, create it with the following content. If it already exists, merge the `cube` plugin entry into the existing `plugins` array without removing other plugins.

```json
{
  "name": "wangding75-wf",
  "interface": {
    "displayName": "Wangding75 Workflow Plugins"
  },
  "plugins": [
    {
      "name": "cube",
      "source": {
        "source": "local",
        "path": "./plugins/cube"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

4. Verify the installed plugin:

```bash
test -f "$HOME/plugins/cube/.codex-plugin/plugin.json"
test -x "$HOME/plugins/cube/bin/cube-check"
node "$HOME/plugins/cube/engine/check-schema-coverage.mjs" "$HOME/plugins/cube/presets/java"
```

5. Restart Codex if the plugin list is already loaded. Then install or enable the `cube` plugin from the local marketplace if Codex prompts for it.

## Usage

After installation, use the Codex skill names:

- `$init [language]`
- `$dev`
- `$check [stage]`
- `$advance`
- `$status`
- `$unlock <reason>`
- `$iterate [branch]`

The Claude Code slash-command equivalents remain documented in the repository `README.md`.
