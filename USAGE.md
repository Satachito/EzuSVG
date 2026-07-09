# EzuSVG — AI & dev workflow guide

This document summarizes how to edit SVG documents with **Cursor, Claude, Codex**, the dev server, and MCP. For editor features and keyboard shortcuts, see **[README.md](README.md)**.

**What is shared across clients:** live reload (`?svg=…`), HTTP/WebSocket bridge, MCP tool names (`ezu_status`, `ezu_apply`, …), and troubleshooting for the dev server / browser.

**What differs:** where you register the MCP server (Cursor settings vs Claude config vs Codex `config.toml`).

## Three layers (Phase 2 / 3 / 4)

| Layer | What it is | When it runs |
|-------|------------|--------------|
| **Phase 2 — live reload** | Save an `.svg` on disk → browser reloads that file | `watchPath` is set (see below) |
| **Phase 3 — WebSocket bridge** | `ezu-server` RPCs into the open tab via `window.EZU` | `npm run dev` + browser tab open |
| **Phase 4 — MCP** | Chat agent calls MCP tools → Phase 3 → canvas | MCP enabled + same session as Phase 3 |

All three can be used together, or separately:

- **Edit `.svg` files, preview on save** → Phase 2 (`?svg=…`)
- **Script or curl changes the live canvas** → Phase 3 (`/__ezu/rpc`)
- **Natural language in chat** → Phase 4 (`ezu_apply`, etc.)

Phase 4 does **not** replace Phase 2. MCP changes the **in-memory** document until you call `ezu_save_file`.

---

## One-time setup

```bash
cd Web && npm install
cd ../tools && npm install
```

### MCP server (all clients)

Every client runs the same stdio server:

| File | Role |
|------|------|
| **`tools/ezu-mcp.mjs`** | MCP tools (`ezu_status`, `ezu_get_svg`, …) |
| **`tools/ezu-mcp-run.sh`** | Launcher — `cd`s into `tools/` so `node_modules` resolves |

The MCP process talks to **`ezu-server`** (Phase 3) on port **8283** by default. If you use another port, set **`EZU_PORT`** in the MCP server's environment **and** when starting the dev server.

---

## Start the dev server (every session)

```bash
cd Web
npm run dev
```

Leave a browser tab open on the dev server (see [Which URL to open](#which-url-to-open)).

The server binds to **`127.0.0.1` only** (override with `EZU_HOST`). The HTTP/WebSocket RPC bridge has **no authentication** — it is for same-machine clients (browser tab + MCP). Do not tunnel or publish this port.

In-app Claude / OpenAI panels store your API key in **`localStorage`** and call the provider from the browser. Anything that can run script in this origin (XSS, a malicious extension, DevTools on a shared machine) can read it. Use a low-privilege key; do not paste keys on a shared or public demo machine.

---

## Register your MCP client

Replace **`/path/to/EzuSVG`** with your clone path (Claude Desktop requires absolute paths).

### Cursor

1. Open this repo at **`EzuSVG/`** (project root, not `Web/` alone).
2. **Settings → Tools & MCP**: find **`ezusvg`** under **Workspace MCP Servers**.
3. Turn the toggle **ON**.
4. If it does not appear: **Cmd+Q** to quit Cursor completely, reopen, or **Cmd+Shift+P → Developer: Reload Window**.

Config file: **[`.cursor/mcp.json`](.cursor/mcp.json)** (uses `tools/ezu-mcp-run.sh`).

### Claude Desktop

Add under `mcpServers` in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ezusvg": {
      "command": "/bin/bash",
      "args": ["/path/to/EzuSVG/tools/ezu-mcp-run.sh"],
      "env": {
        "EZU_PORT": "8283"
      }
    }
  }
}
```

Fully quit Claude Desktop (**Cmd+Q**) and reopen.

### Claude Code (CLI)

```bash
claude mcp add ezusvg --scope project --env EZU_PORT=8283 -- /bin/bash tools/ezu-mcp-run.sh
```

Or use **[`.mcp.json`](.mcp.json)** at the project root.

### OpenAI Codex

```bash
codex mcp add ezusvg --env EZU_PORT=8283 -- /bin/bash /path/to/EzuSVG/tools/ezu-mcp-run.sh
```

---

## Which URL to open

| URL | Phase 2 (auto-reload on save) | Phase 3 / 4 (live MCP) |
|-----|------------------------------|-------------------------|
| `http://localhost:8283/?svg=Samples/Icons.svg` | **Yes** — watches that file | **Yes** |
| `http://localhost:8283/` | **No** (unless `ezu-watch` left in sessionStorage) | **Yes** |
| Sample button in the app | **Yes** — sets watch path | **Yes** |

**Recommended for file + AI editing:** use `?svg=Samples/YourFile.svg`.

**MCP-only experiments:** `http://localhost:8283/` is fine; live edits apply to whatever is on the canvas. They are **not** written to disk until `ezu_save_file`.

To clear a stale watch path: DevTools → Application → Session Storage → delete `ezu-watch`, or upload a file with **↑** (upload clears the watch).

---

## Phase 2 — edit `.svg`, see it in the browser

1. `npm run dev`
2. Open `http://localhost:8283/?svg=Samples/Icons.svg`
3. Edit `Samples/Icons.svg` in your editor and **save**
4. The browser reloads that file

If the canvas has **unsaved edits** (different from the last loaded disk version), the browser asks before reloading. Declining keeps your in-memory work; the next disk save will ask again. If the canvas already matches disk (e.g. you just ran `ezu_save_file`), reload is skipped silently.

Port already in use:

```bash
lsof -ti:8283 | xargs kill
# or: EZU_PORT=8280 npm run dev
```

---

## Phase 3 — HTTP / WebSocket bridge

Requires a connected browser tab (`ezu_status` → `"connected": true`).

```bash
# Connection check
curl -s http://127.0.0.1:8283/__ezu/status

# Read live SVG
curl -s http://127.0.0.1:8283/__ezu/svg

# Apply ops (example: turn #sun red)
curl -s -X POST http://127.0.0.1:8283/__ezu/rpc \
  -H 'Content-Type: application/json' \
  -d '{"method":"apply","params":{"ops":[{"op":"update","select":"#sun","attrs":{"fill":"red"}}]}}'
```

Endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/__ezu/status` | Browser connected? watch path, element count |
| GET | `/__ezu/svg` | Live SVG markup + selection + size |
| POST | `/__ezu/rpc` | Body: `{ "method": "apply", "params": { "ops": […] } }` |

DevTools: `window.EZU` in the browser — see **`Web/ai-api.js`**.

---

## Phase 4 — MCP from chat

**Prerequisites:** `npm run dev`, browser tab open, **`ezusvg` MCP enabled**.

### Check connection

> Run `ezu_status`.

Expect `"connected": true` and a `watchPath` if you opened with `?svg=…`.

### Example — change fill (no save)

> Make the star yellow. Use MCP. Do not save to disk.

Typical agent steps:

1. `ezu_get_svg` or `ezu_select` — find `#star`
2. `ezu_apply` — `{ "op": "update", "select": "#star", "attrs": { "fill": "#fbbf24" } }`

### Example — persist

> Save the current document to `Samples/MyIcon.svg`.

Calls `ezu_save_file`.

### MCP tools

| Tool | Purpose |
|------|---------|
| `ezu_status` | Connection, document size, element count, selection |
| `ezu_get_svg` | Live SVG snapshot |
| `ezu_get_selection` | CSS selectors of selected elements |
| `ezu_select` | Select by CSS selector (highlights + syncs panels) |
| `ezu_apply` | Apply ops (`add`, `update`, `remove`, `restack`, `setCanvas`, `setDoc`) |
| `ezu_load_file` | Load `.svg` into browser (path under `Web/`) |
| `ezu_save_file` | Write live SVG to disk |

### `ezu_apply` ops

Elements are addressed by CSS selector (`select`). One `ezu_apply` call = one undo step.

```
{ "op": "add",       "svg": "<circle .../>", "parent"?, "before"? }
{ "op": "update",    "select": "#sun", "attrs"?: { "fill": "red" }, "text"? }
{ "op": "remove",    "select" }
{ "op": "restack",   "select", "toFront"? }
{ "op": "setCanvas", "width", "height", "viewBox"? }
{ "op": "setDoc",    "svg" }
```

### Rules for agents

- Prefer **`#id`** selectors when elements have ids.
- **`attrs` values** are strings; use `null` to remove an attribute.
- **Undo:** live MCP edits are undoable in the browser (⌘Z).
- Only **one browser tab** should connect to `ezu-server` at a time (last connection wins).

---

## Quick troubleshooting

| Problem | Fix |
|---------|-----|
| **Cursor:** `ezusvg` not in MCP list | Open repo root; Reload Window or quit Cursor (Cmd+Q) |
| **Cursor:** MCP listed but Disabled | Toggle **ON** in Settings → Tools & MCP |
| `connected: false` | Open dev URL in browser; keep tab open |
| RPC timeout | Restart `npm run dev`; close duplicate `:8283` tabs |
| Phase 2 not reloading | Use `?svg=…` or Sample button; check `ezu-watch` in sessionStorage |
| Port 8283 in use | `lsof -ti:8283 \| xargs kill` or `EZU_PORT=8280 npm run dev` (+ set `EZU_PORT` in MCP env) |
| GitHub Pages shows README | Run `bash tools/fix-pages.sh` — see README |

---

## Project layout (dev / AI)

```
EzuSVG/
├── Web/              App + ai-api.js (window.EZU)
├── Samples/          Example .svg files
├── tools/
│   ezu-server.mjs    Dev server + bridge
│   ezu-mcp.mjs       MCP server (stdio)
│   ezu-mcp-run.sh    MCP launcher
├── .cursor/mcp.json  Cursor workspace MCP config
└── .mcp.json         Project MCP config
```
