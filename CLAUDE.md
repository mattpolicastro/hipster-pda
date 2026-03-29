# Inbox Triage — Obsidian Plugin

A card-based GTD inbox plugin for Obsidian with two modes: a dump mode for rapid brain-dump capture, and a swipe-to-triage mode for processing items into PARA destinations. Built with React 19 and TypeScript.

## Tech Stack

- **Language:** TypeScript (strict mode)
- **UI:** React 19 (bundled into main.js)
- **Build:** esbuild
- **Styling:** Plain CSS with Obsidian CSS variables (no frameworks)
- **Gestures:** Vanilla pointer events (no gesture libraries)

## Development

```bash
# Watch mode (rebuilds on change)
npm run dev

# Production build
npm run build
```

Output files (`main.js`, `manifest.json`, `styles.css`) live in the project root. The plugin is symlinked into the Obsidian vault for testing:

```bash
# Symlink already created at:
# {vault}/.obsidian/plugins/inbox-triage/ -> ~/Projects/inbox-triage/
```

After `npm run dev`, reload Obsidian (Cmd+R) or use the Hot Reload plugin to pick up changes.

## File Structure

```
src/
  main.ts              # Plugin entry point (onload/onunload, command + ribbon registration)
  InboxTriageView.ts   # ItemView subclass, mounts/unmounts React root
  InboxTriageApp.tsx   # Root React component
styles.css             # Plugin styles using Obsidian CSS variables
manifest.json          # Obsidian plugin manifest
esbuild.config.mjs     # Build configuration
```

## Requirements

Full requirements document: Obsidian vault at `Projects/Inbox Triage/Inbox Triage Requirements.md`

## Conventions

- No external gesture, animation, or CSS framework libraries
- All file I/O through Obsidian Vault API (never direct filesystem access)
- CSS uses Obsidian theme variables (`--background-primary`, `--text-normal`, etc.)
- Touch targets minimum 44x44px for mobile compatibility
