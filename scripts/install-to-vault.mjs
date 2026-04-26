#!/usr/bin/env node
// Copies build artifacts into an Obsidian vault's plugin folder so the
// plugin can be committed alongside the vault. Set HIPSTER_PDA_VAULT to
// the absolute vault path. If unset, this script is a no-op.

import { existsSync, mkdirSync, copyFileSync, lstatSync, rmSync } from "node:fs";
import { join } from "node:path";

const vault = process.env.HIPSTER_PDA_VAULT;
if (!vault) {
  console.log("[install-to-vault] HIPSTER_PDA_VAULT not set; skipping.");
  process.exit(0);
}

const dest = join(vault, ".obsidian", "plugins", "hipster-pda");

if (existsSync(dest) && lstatSync(dest).isSymbolicLink()) {
  rmSync(dest);
}
mkdirSync(dest, { recursive: true });

for (const file of ["main.js", "manifest.json", "styles.css"]) {
  if (!existsSync(file)) {
    console.error(`[install-to-vault] missing build artifact: ${file}`);
    process.exit(1);
  }
  copyFileSync(file, join(dest, file));
}

console.log(`[install-to-vault] copied to ${dest}`);
