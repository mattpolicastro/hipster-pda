# Hipster PDA — Obsidian Plugin

A card-based GTD inbox plugin for Obsidian inspired by the hipster PDA concept. A blank notecard for brain-dump capture, a stacked deck of cards to process, and a step-by-step GTD decision tree for triaging items into PARA destinations. Built with React 19 and TypeScript.

## Tech Stack

- **Language:** TypeScript (strict mode)
- **UI:** React 19 (bundled into main.js)
- **Build:** esbuild
- **Styling:** Plain CSS with Obsidian CSS variables (no frameworks)
- **Date parsing:** Custom fuzzy date parser (relative, weekday, ISO, natural)

## Development

```bash
# Watch mode (rebuilds on change)
npm run dev

# Production build
npm run build
```

Output files (`main.js`, `manifest.json`, `styles.css`) live in the project root. The plugin is symlinked into the Obsidian vault for testing:

```bash
# Symlink:
# {vault}/.obsidian/plugins/hipster-pda/ -> ~/Projects/inbox-triage/
```

After `npm run dev`, reload Obsidian (Cmd+R) or use the Hot Reload plugin to pick up changes.

## File Structure

```
src/
  main.ts              # Plugin entry point, settings load, view + command registration
  settings.ts          # PluginSettingTab with all user-facing settings
  types.ts             # InboxItem, Disposition, ObsidianBridge, HipsterPdaSettings
  fileOps.ts           # Pure functions: parse inbox, serialize, remove lines, check/uncheck
  dateParser.ts        # Fuzzy date parser (parseFuzzyDate, formatDate)
  HipsterPdaView.ts    # ItemView subclass, ObsidianBridge, DestinationPickerModal
  HipsterPdaApp.tsx    # Root React component: capture notecard + card stack + processing
  ProcessMode.tsx      # GTD triage flow: decision tree, keyboard nav, undo
  SwipeCard.tsx        # (legacy, unused) Draggable card component
styles.css             # All plugin styles using Obsidian CSS variables
manifest.json          # Obsidian plugin manifest (id: hipster-pda)
esbuild.config.mjs     # Build configuration
```

## Architecture

### ObsidianBridge
Bridges Obsidian's imperative APIs with React. The View constructs a plain object of async functions (closing over `this.app.vault`) and passes it as a prop to React. React components never import from `obsidian` directly.

### DestinationPickerModal
`SuggestModal<TFile | null>` with `selectSuggestion` override (Obsidian 1.12.3's `FuzzySuggestModal.onChooseItem` doesn't fire). Files sorted by mtime. A `null` sentinel renders as "+ Create note: {query}" for inline note creation.

### GTD Decision Tree
```
Card: Is it actionable?
  ├─ → Actionable
  │   ├─ 2-minute rule (←/→ buttons)
  │   │   ├─ ← Do it now → mark [x] in inbox
  │   │   └─ → Add details for later
  │   │       ├─ Next actions (inline card input, multiple)
  │   │       ├─ Due date (fuzzy parse, 📅 Tasks format)
  │   │       ├─ Context tags (combo input + quick picks)
  │   │       └─ File it away → destination picker
  │   └─ (delegate/scope steps built but bypassed)
  └─ ← Not Actionable
      ├─ 1: Trash
      ├─ 2: Reference → destination picker
      └─ 3: Someday/Maybe
```

### Data Flow
- Capture: items write directly to inbox.md on Enter
- Processing: reads inbox.md, processes in LIFO order (newest first)
- Filing: writes to destination under `## Hipster PDA` section
- Safety: write verification (re-read after write), content-matched line removal
- Undo: reverses the last write by removing the line from the destination

### UI Layout
- **Capture:** blank notecard (centered, with stack of empty cards behind) + to-be-processed stack at top
- **Processing:** card centered with inline inputs, nav bar above (← Back / Next →), choice buttons below, empty notecard stack at bottom to exit

## Conventions

- No external gesture, animation, or CSS framework libraries
- All file I/O through Obsidian Vault API (never direct filesystem access)
- CSS uses Obsidian theme variables via `--it-*` custom property aliases
- Touch targets minimum 44px for mobile compatibility
- Keyboard shortcuts: arrow keys for choices, Escape to back up, Enter to advance/skip
- Text inputs inside the card; buttons/nav outside the card
