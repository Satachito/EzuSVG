# EzuSVG

Browser-based SVG editor (絵図 + SVG). Static, no build: plain ES modules + Web Components
loaded directly by `Web/index.html`. Open it from any static server, e.g.

```sh
cd Web && python3 -m http.server 8283
# → http://localhost:8283/
```

A sibling of [Zukai](https://github.com/Satachito/Zukai) — same look & feel,
same code style and repo layout, but the document here is a plain inline `<svg>`
edited in place (what you see is exactly what you save).

**Live demo:** [satachito.github.io/EzuSVG](https://satachito.github.io/EzuSVG/) (served from `Web/` via GitHub Actions)

If the root URL shows this README instead of the editor, Pages is still deploying the
repo root. Fix:

```sh
bash tools/fix-pages.sh
```

Or in GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**,
then run the **Deploy Web to GitHub Pages** workflow.

## Features

- **Tools** — Select `V` · Rect `R` · Ellipse `O` · Line `L` · Path (freehand) `P` · Text `T`.
  While in any tool, hold **⌘** and drag to draw a rect, **⌥** for an ellipse.
- **Select & edit** — click to select (click again to step up into the group,
  double-click to dive back in / edit text), drag to move, handles to resize
  (⇧ keeps aspect), per-point handles for line / polyline / polygon,
  drag on empty canvas for area select, ⇧click to extend.
- **Path WYSIWYG** — a selected `<path>` shows draggable anchors and Bézier
  control points (with guide lines) right on the canvas, and the Properties
  panel gets a *path d* textarea that previews live as you type.
  Both directions stay in sync and are undoable.
- **Document tree** (left panel) — every element, click to select, hover to highlight.
- **Properties** (right panel) — id / fill / stroke / stroke-width / opacity /
  font-size / text, plus a raw *attributes* editor for anything else.
  With nothing selected the fields set the defaults for new shapes.
- **Source** (right panel) — the live SVG markup; edit it and Apply.
- **AI assistants** (right panel) — Claude and OpenAI panels, same as Zukai:
  bring your own API key (stored in `localStorage`, requests go straight from
  the browser to the provider — no server, no account here). Anything that can
  run script in this origin can read the key; see **[USAGE.md](USAGE.md)**.
  Describe a change ("make the sun red", "add a snowman next to the tree") and
  the model edits the live document through an `apply_ops` tool; each tool call
  is one undo step. Panels float (⤢) into a draggable box over the canvas.
- **Undo / redo** — ⌘Z / ⇧⌘Z, snapshot-based, survives any operation.
- **Keyboard** — ⌫ delete · ⌘D duplicate · ⌘C/⌘V copy & paste · ⌘A select all ·
  arrows nudge (⇧ ×10) · Esc cancel / deselect.
- **Zoom** — toolbar −/+, ⌘-wheel, click the percentage to reset.
- **File** — open / save `.svg` (also opens path-only `.ve` from
  [Kiseki](https://satachito.github.io/Kiseki/)), copy SVG to clipboard,
  export PNG (2×), export PDF via print. The document autosaves to `localStorage`.
- **Clipboard interchange** — ⌘V pastes SVG markup from the system clipboard:
  fragments from this app's ⌘C, whole documents from Kiseki's Copy SVG / ⌘C,
  Figma, or hand-written markup.

Sample documents live in `Samples/` (symlinked as `Web/Samples`).

## Local development & MCP

Same design as Zukai: the dev server serves `Web/` and doubles as a WebSocket
bridge to the open browser tab; a stdio MCP server talks to it over HTTP.

```sh
cd Web && npm install && npm run dev
cd ../tools && npm install   # MCP (one-time)
```

Open `http://localhost:8283/?svg=Samples/Icons.svg`. Enable the **`ezusvg`**
MCP server in Cursor (**Settings → Tools & MCP**) or use [.mcp.json](.mcp.json).

## Feedback

Found a bug or have an idea for an SVG editing workflow? Please use the
[feedback form on GitHub](https://github.com/Satachito/EzuSVG/issues/new/choose).
Issue forms are available in English and Japanese. Do not include API keys or
other secrets.

Tools: `ezu_status` · `ezu_get_svg` · `ezu_get_selection` · `ezu_select` ·
`ezu_apply` (same ops as `window.EZU.apply`; one call = one undo step) ·
`ezu_load_file` · `ezu_save_file`.

`?svg=path` loads a file under `Web/` and watches it — editing the file on disk
live-reloads the browser.

## Lint

```sh
cd Web && npm run lint
```

Leading-comma / leading-semicolon layout, tab indentation, `$`/`_` shorthand
identifiers — match the surrounding code (see Zukai).

## Project layout

```
EzuSVG/
├── Web/              App (HTML + ES modules)
├── Samples/          Example .svg files
├── tools/            ezu-server, ezu-mcp, utilities
├── .mcp.json         Cursor MCP config
├── USAGE.md          AI & dev workflow guide
└── README.md
```
