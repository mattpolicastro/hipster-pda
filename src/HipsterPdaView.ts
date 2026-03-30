import {
	ItemView,
	WorkspaceLeaf,
	TFile,
	SuggestModal,
	App,
} from "obsidian";
import { createRoot, Root } from "react-dom/client";
import { createElement } from "react";
import { HipsterPdaApp } from "./HipsterPdaApp";
import type HipsterPdaPlugin from "./main";
import type { Disposition, InboxItem, ObsidianBridge } from "./types";
import {
	parseInboxItems,
	serializeItemsAsCheckboxes,
	removeItemLines,
	removeLineByText,
	checkOffItem,
	uncheckItem,
} from "./fileOps";

export const VIEW_TYPE_HIPSTER_PDA = "hipster-pda-view";

class DestinationPickerModal extends SuggestModal<TFile | null> {
	private files: TFile[];
	private folders: string[];
	private resolve: (path: string | null) => void;

	constructor(
		app: App,
		files: TFile[],
		folders: string[],
		resolve: (path: string | null) => void
	) {
		super(app);
		this.files = files;
		this.folders = folders;
		this.resolve = resolve;
	}

	getSuggestions(query: string): (TFile | null)[] {
		const lower = query.toLowerCase();
		const filtered: (TFile | null)[] = this.files.filter((f) =>
			f.path.toLowerCase().includes(lower)
		);
		if (query.trim()) {
			filtered.push(null);
		}
		return filtered;
	}

	renderSuggestion(item: TFile | null, el: HTMLElement): void {
		if (item === null) {
			const query = this.inputEl.value.trim();
			el.createEl("div", {
				text: `+ Create note: "${query}"`,
				cls: "suggestion-create",
			});
		} else {
			el.createEl("div", { text: item.path });
		}
	}

	selectSuggestion(item: TFile | null, evt: MouseEvent | KeyboardEvent): void {
		if (item === null) {
			const name = this.inputEl.value.trim().replace(/[\\/:*?"<>|]/g, "");
			if (!name) return;
			const folder = this.folders[0];
			const path = `${folder}/${name}.md`;
			const existing = this.app.vault.getFileByPath(path);
			if (existing) {
				this.resolve(path);
				this.close();
			} else {
				this.app.vault.create(path, "").then(() => {
					this.resolve(path);
					this.close();
				});
			}
			return;
		}
		this.resolve(item.path);
		this.close();
	}

	onChooseSuggestion(item: TFile | null): void {
		// Not called when selectSuggestion is overridden
	}

	onClose(): void {
		super.onClose();
		this.resolve(null);
	}
}

export class HipsterPdaView extends ItemView {
	root: Root | null = null;
	plugin: HipsterPdaPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: HipsterPdaPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_HIPSTER_PDA;
	}

	getDisplayText(): string {
		return "Hipster PDA";
	}

	getIcon(): string {
		return "inbox";
	}

	async onOpen() {
		const bridge = this.createBridge();

		// Set animation duration CSS variable
		const duration = this.plugin.settings.animationDuration;
		this.contentEl.style.setProperty(
			"--it-animation-duration",
			`${duration}ms`
		);

		this.root = createRoot(this.contentEl);
		this.root.render(createElement(HipsterPdaApp, { bridge }));
	}

	async onClose() {
		this.root?.unmount();
		this.root = null;
	}

	private createBridge(): ObsidianBridge {
		const { vault } = this.app;
		const plugin = this.plugin;

		return {
			readInboxFile: async () => {
				const settings = plugin.settings;
				const file = vault.getFileByPath(settings.inboxPath);
				if (!file) return [];
				const content = await vault.read(file);
				return parseInboxItems(content, settings.inboxPath);
			},

			writeItemsToInbox: async (items: InboxItem[]) => {
				const settings = plugin.settings;
				const serialized = serializeItemsAsCheckboxes(
					items,
					settings.timestampCaptures
				);
				const file = vault.getFileByPath(settings.inboxPath);
				if (file) {
					const content = await vault.read(file);
					const separator = content.endsWith("\n") ? "" : "\n";
					await vault.modify(file, content + separator + serialized + "\n");
				} else {
					await vault.create(settings.inboxPath, serialized + "\n");
				}
			},

			writeItemToDestination: async (
				item: InboxItem,
				disposition: Disposition
			) => {
				let destPath: string;
				let line: string;

				switch (disposition.type) {
					case "actionable": {
						destPath = disposition.destination;
						const tags =
							disposition.tags.length > 0
								? " " + disposition.tags.join(" ")
								: "";
						const due = disposition.dueDate
							? ` 📅 ${disposition.dueDate}`
							: "";
						line = `- [ ] ${item.text}${tags}${due}`;
						if (disposition.nextActions && disposition.nextActions.length > 0) {
							const subs = disposition.nextActions
								.map((a) => `\t- [ ] ${a}`)
								.join("\n");
							line += "\n" + subs;
						}
						break;
					}
					case "reference": {
						destPath = disposition.destination;
						line = `- ${item.text}`;
						break;
					}
					case "someday": {
						destPath = plugin.settings.somedayPath;
						line = `- [ ] ${item.text} #someday`;
						break;
					}
					case "delegate": {
						destPath = disposition.destination;
						line = `- [ ] ${item.text} #waiting ${disposition.waitingOn}`;
						break;
					}
					case "project": {
						destPath = disposition.destination;
						line = `- [ ] ${disposition.nextAction}`;
						break;
					}
					case "trash":
						return; // Don't write anything
					case "done-now":
						return; // Handled by markItemDone
				}

				const SECTION_HEADING = "## Hipster PDA";
				const firstLine = line.split("\n")[0];
				const file = vault.getFileByPath(destPath);
				if (file) {
					const content = await vault.read(file);
					const sectionIdx = content.indexOf(SECTION_HEADING);
					if (sectionIdx !== -1) {
						const afterHeading = content.indexOf("\n", sectionIdx);
						if (afterHeading !== -1) {
							const before = content.slice(0, afterHeading + 1);
							const after = content.slice(afterHeading + 1);
							await vault.modify(file, before + line + "\n" + after);
						} else {
							await vault.modify(file, content + "\n" + line + "\n");
						}
					} else {
						const separator = content.endsWith("\n") ? "\n" : "\n\n";
						await vault.modify(file, content + separator + SECTION_HEADING + "\n" + line + "\n");
					}
				} else {
					await vault.create(destPath, SECTION_HEADING + "\n" + line + "\n");
				}

				// Verify the write landed
				const verifyFile = vault.getFileByPath(destPath);
				if (!verifyFile) {
					throw new Error(`Failed to write to ${destPath}: file not found after write`);
				}
				const verifyContent = await vault.read(verifyFile);
				if (!verifyContent.includes(firstLine)) {
					throw new Error(`Failed to verify write to ${destPath}: content not found`);
				}
			},

			removeProcessedFromInbox: async (items: InboxItem[]) => {
				const settings = plugin.settings;
				const file = vault.getFileByPath(settings.inboxPath);
				if (!file) return;
				const content = await vault.read(file);
				const updated = removeItemLines(content, items);
				await vault.modify(file, updated);
			},

			removeLineFromFile: async (
				filePath: string,
				lineText: string
			) => {
				const file = vault.getFileByPath(filePath);
				if (!file) return;
				const content = await vault.read(file);
				const updated = removeLineByText(content, lineText);
				await vault.modify(file, updated);
			},

			markItemDone: async (item: InboxItem) => {
					const settings = plugin.settings;
					const file = vault.getFileByPath(settings.inboxPath);
					if (!file) return;
					const content = await vault.read(file);
					const updated = checkOffItem(content, item);
					await vault.modify(file, updated);
				},

				unmarkItemDone: async (item: InboxItem) => {
					const settings = plugin.settings;
					const file = vault.getFileByPath(settings.inboxPath);
					if (!file) return;
					const content = await vault.read(file);
					const updated = uncheckItem(content, item);
					await vault.modify(file, updated);
				},

				createNote: async (name: string, folder: string) => {
					const path = `${folder}/${name}.md`;
					const existing = vault.getFileByPath(path);
					if (existing) return path;
					await vault.create(path, "");
					return path;
				},

				pickDestinationFile: (folders: string[]) => {
				return new Promise<string | null>((resolve) => {
					const files = vault
						.getMarkdownFiles()
						.filter((f) =>
							folders.some((folder) =>
								f.path.startsWith(folder + "/")
							)
						)
						.sort((a, b) => b.stat.mtime - a.stat.mtime);

					const modal = new DestinationPickerModal(
						this.app,
						files,
						folders,
						resolve
					);
					modal.open();
				});
			},

			closeView: () => {
				this.leaf.detach();
			},

			getSettings: () => plugin.settings,
		};
	}
}
