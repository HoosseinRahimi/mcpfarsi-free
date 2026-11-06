# MCPfarsi — Free static edition

A free, self-hostable, offline-first view of the [MCPfarsi](https://mcpfarsi.ir/) marketplace:
**72 Iranian MCP servers, 896 tools**, one HTML file, no backend, no account, no router.

The hosted site runs an MCP router: you sign in and your API keys are stored (encrypted) on its
servers so the router can call services for you. This edition removes that middle layer. Every
server here runs **on your own machine** via `uvx`, and the only thing this page does is help you
find a server and assemble a client config.

## What it is

| | This edition | Hosted router |
|---|---|---|
| Account | not needed | required |
| Where servers run | your machine (`uvx`) | the router's servers |
| API keys | pasted into a local command only | stored encrypted in your account |
| Cost | free, MIT-style source you can read | per the hosted site's terms |
| Network | only to install and to call the service | always depends on the router |

## Files

```
index.html            the site — one self-contained file (≈490 KB), no dependencies
data/servers.json     snapshot of the public catalog this build reads
build.py              assembles index.html from src/ + data/
check.py              offline-purity + data sanity checks
src/
  index.template.html page shell
  styles.css          design tokens, layout, RTL handling
  app.js              search, filters, selection, config builder
  copy_fa.json        Persian UI strings + per-server Persian copy
  fonts/              Vazirmatn 400/500/700 (SIL OFL), embedded at build time
```

## Rebuild

```bash
python build.py        # writes index.html
python check.py        # verifies no external resources, data counts
```

The build reads `data/servers.json` — a snapshot of the public manifest from
`github.com/sepehr071/iran-mcp`. To refresh the catalog, replace that file with a newer copy and
rebuild. Nothing else is required: no Node, no bundler, no network at build time.

## Deploy

Any static host works; the file has no dependencies:

- **GitHub Pages** — this repo is already Pages-ready: enable Pages for the `main` branch root.
- **Netlify / Cloudflare Pages** — drop the file in, no build command.
- **Local** — double-click it. It works from `file://`, fully offline.

## Features

- Instant search (Ctrl/⌘ K) over server names, package names, descriptions and **tool names**, with
  Persian normalization (ی/ك variants, ZWNJ, Arabic-Indic digits).
- 13 category filters, sort by tool count or name.
- Per-server expansion: every tool with its one-line summary, plus required/optional env vars.
- Read-only vs. write-capable badges, and a "hosted" badge for remote servers.
- Selection dock → **config generator** for Claude Desktop, Claude Code, Cursor, VS Code and
  Windsurf, with `<YOUR_KEY>` placeholders, copy and download. Generated in the browser only.
- Dark/light theme, Persian/English toggle (RTL ↔ LTR), keyboard-first, `prefers-reduced-motion`.
- No analytics, no cookies, no external requests. Theme/language/selection live in `localStorage`.

## Scope and honesty

- The catalog and tool summaries come from the public `iran-mcp` manifest. Tool counts, versions and
  `read_only` flags are read from that data, not hardcoded.
- Written **Skills** are not part of this edition — only the server catalog.
- Three servers are **not** read-only by design: `payping-mcp` (creates payment links/coupons),
  `bale-mcp` (sends messages as your bot), `okala-mcp` (OTP login). They are badged "نوشتن دارد".
- Two entries are **hosted remote** servers (`pasavard.ir`, `swapwallet.app`) whose code you cannot
  inspect; they are badged "میزبانی‌شده". Treat them as third parties.
- The comparison table paraphrases the hosted site's own published description of its router; it
  makes no claims about pricing or internals beyond that.

## License

The page code in this folder is yours to use and modify. The server catalog belongs to its authors
(`sepehr071/iran-mcp`); each server repo carries its own MIT license. Vazirmatn is licensed under the
SIL Open Font License.
