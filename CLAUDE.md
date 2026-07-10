# EzuSVG

Browser SVG editor (絵図 + SVG). Static, no build: plain ES modules + Web Components loaded
directly by `Web/index.html`. Open it from any static server:

```sh
cd Web && python3 -m http.server 8283
```

Sibling of Zukai (`../Zukai`) — same repo layout, look & feel, and code style.

- **Lint:** `cd Web && npm run lint` (`eslint *.js`). Keep it clean.
- **Code style:** leading-comma / leading-semicolon layout, tab indentation,
  `$`/`_` shorthand identifiers. Match the surrounding code.

## Architecture

- The document **is** the live inline `<svg>` inside `<svg-editor>`
  (`Web/svg-editor.js`); serialization is `XMLSerializer` on that element.
- Undo / redo (`Web/Jobs.js`) is snapshot-based: `Mutate( label, fn )` /
  `Commit( label, before )` in `Web/Application.js` record serialized
  before / after strings. Interactions mutate live during a drag and commit
  once on pointerup.
- Panels are Web Components wired by global element ids (Zukai style):
  `MAIN_EDITOR`, `PROP_EDITOR`, `TREE_PANEL`. They sync on the window events
  `doc-changed` / `selection-changed` / `tool-changed`.
- Geometry math runs in each element's local user space via
  `getScreenCTM().inverse()`; elements without positional attributes are
  moved / resized by appending to `transform`, consolidated on release.
- Samples in `Samples/` (served via `Web/Samples` symlink); autosave key
  `tokyo.828.ezusvg` in localStorage.
- AI assistants: SAT `<ai-assistant>` (`Web/SAT/ai/`) + domain prompt
  `Web/ai-system.js` + `Web/ai-api.js`
  (`window.EZU.getSVG / getSelection / apply( ops )` — ops address elements by
  CSS selector; one `apply` call = one undo step, full rollback on failure).
- MCP mirrors Zukai: `tools/ezu-server.mjs` (serves `Web/` + WS bridge
  `/__ezu/ws` + HTTP RPC), `Web/live-reload.js` (browser side: WS ↔ `window.EZU`,
  plus `?svg=path` load & live reload), `tools/ezu-mcp.mjs` (stdio MCP).
  Run `cd Web && npm run dev` + an open browser tab for the live tools to work.
