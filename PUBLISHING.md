# Publishing Plan

Track work needed before submitting Hipster PDA to the Obsidian community plugins directory.

## Dev ergonomics

- [ ] Hook `install-to-vault.mjs` into `esbuild.config.mjs` so `npm run dev` also copies build artifacts into the vault on every rebuild (currently only `npm run build` triggers it via `postbuild`).

## Manifest & repo hygiene

- [ ] Audit `manifest.json` against [submission requirements](https://docs.obsidian.md/Plugins/Releasing/Submission+requirements+for+plugins): no "Obsidian" in name, no "plugin" in description, sensible `minAppVersion`, correct `isDesktopOnly`.
- [ ] Confirm `versions.json` is present and accurate for update compatibility.
- [ ] Add `LICENSE` file at repo root (MIT, matching `package.json`).
- [ ] Flesh out `README.md` (currently WIP): real install instructions, screenshot, feature overview.
- [ ] Optional: `fundingUrl` in manifest.

## Code review checklist (common reviewer flags)

- [ ] Remove any `console.log` debug output.
- [ ] No `as any` casts on `app` or other Obsidian internals.
- [ ] No `innerHTML` — use `createEl` / `setText`.
- [ ] All event listeners, intervals, and observers cleaned up in `onunload`.
- [ ] Do NOT detach leaves in `onunload` (reviewers explicitly flag this).
- [ ] No leftover sample-plugin boilerplate.
- [ ] No hardcoded paths.
- [ ] All file I/O via Vault API (already a project convention — verify).

## Product readiness

- [ ] Decide whether the bypassed delegate/scope GTD steps ship in v1 or are removed/finished.
- [ ] Test on mobile; set `isDesktopOnly` to reflect reality.
- [ ] Test fresh-vault behavior when `inbox.md` doesn't exist yet.
- [ ] Verify settings tab covers all user-facing config.

## Submission

- [ ] Tag a release matching `manifest.json` version; attach `main.js`, `manifest.json`, `styles.css`.
- [ ] Open PR against `obsidianmd/obsidian-releases` adding the plugin entry.
