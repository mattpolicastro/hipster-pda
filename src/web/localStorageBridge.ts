import type { Disposition, HipsterPdaSettings, InboxItem, ObsidianBridge } from "../types";
import { DEFAULT_SETTINGS } from "../types";
import {
	parseInboxItems,
	serializeItemsAsCheckboxes,
	removeItemLines,
	removeLineByText,
	checkOffItem,
	uncheckItem,
} from "../fileOps";

const KEYS = {
	inbox: "hipster-pda:inbox",
	settings: "hipster-pda:settings",
	destPrefix: "hipster-pda:dest:",
} as const;

function readFile(key: string): string {
	return localStorage.getItem(key) ?? "";
}

function writeFile(key: string, content: string): void {
	localStorage.setItem(key, content);
}

const priorityEmoji: Record<string, string> = {
	highest: " ⏫",
	high: " 🔼",
	low: " 🔽",
	lowest: " ⏬",
};

const SECTION_HEADING = "## Hipster PDA";

/**
 * State holder for the destination picker modal.
 * The bridge stores a pending resolve here; the React component reads and clears it.
 */
export interface PickerRequest {
	folders: string[];
	resolve: (path: string | null) => void;
}

export type PickerStateSetter = (request: PickerRequest | null) => void;

let _pickerSetter: PickerStateSetter | null = null;

export function setPickerStateSetter(setter: PickerStateSetter): void {
	_pickerSetter = setter;
}

export function createLocalStorageBridge(): ObsidianBridge {
	const getSettings = (): HipsterPdaSettings => {
		const raw = localStorage.getItem(KEYS.settings);
		if (!raw) return { ...DEFAULT_SETTINGS };
		try {
			return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
		} catch {
			return { ...DEFAULT_SETTINGS };
		}
	};

	const saveSettings = (settings: HipsterPdaSettings): void => {
		localStorage.setItem(KEYS.settings, JSON.stringify(settings));
	};

	// Ensure defaults are persisted on first run
	if (!localStorage.getItem(KEYS.settings)) {
		saveSettings(DEFAULT_SETTINGS);
	}

	return {
		readInboxFile: async () => {
			const content = readFile(KEYS.inbox);
			if (!content) return [];
			return parseInboxItems(content, "inbox");
		},

		writeItemsToInbox: async (items: InboxItem[]) => {
			const settings = getSettings();
			const serialized = serializeItemsAsCheckboxes(items, settings.timestampCaptures);
			const existing = readFile(KEYS.inbox);
			if (existing) {
				const separator = existing.endsWith("\n") ? "" : "\n";
				writeFile(KEYS.inbox, existing + separator + serialized + "\n");
			} else {
				writeFile(KEYS.inbox, serialized + "\n");
			}
			// Verify
			const firstLine = serialized.split("\n")[0];
			const verify = readFile(KEYS.inbox);
			if (!verify.includes(firstLine)) {
				throw new Error("Failed to verify inbox write: content not found");
			}
		},

		writeItemToDestination: async (item: InboxItem, disposition: Disposition) => {
			let destKey: string;
			let line: string;

			switch (disposition.type) {
				case "actionable": {
					destKey = KEYS.destPrefix + disposition.destination;
					const tags = disposition.tags.length > 0 ? " " + disposition.tags.join(" ") : "";
					const due = disposition.dueDate ? ` 📅 ${disposition.dueDate}` : "";
					const pri = disposition.priority ? (priorityEmoji[disposition.priority] ?? "") : "";
					const rec = disposition.recurrence ? ` 🔁 ${disposition.recurrence}` : "";
					line = `- [ ] ${item.text}${tags}${pri}${rec}${due}`;
					if (disposition.nextActions && disposition.nextActions.length > 0) {
						const subs = disposition.nextActions.map((a) => `\t- [ ] ${a}`).join("\n");
						line += "\n" + subs;
					}
					break;
				}
				case "reference": {
					destKey = KEYS.destPrefix + disposition.destination;
					line = `- ${item.text}`;
					break;
				}
				case "someday": {
					const settings = getSettings();
					destKey = KEYS.destPrefix + settings.somedayPath;
					line = `- [ ] ${item.text} #someday`;
					break;
				}
				case "delegate": {
					destKey = KEYS.destPrefix + disposition.destination;
					line = `- [ ] ${item.text} #waiting ${disposition.waitingOn}`;
					break;
				}
				case "project": {
					destKey = KEYS.destPrefix + disposition.destination;
					line = `- [ ] ${disposition.nextAction}`;
					break;
				}
				case "trash":
					return;
				case "done-now":
					return;
			}

			const firstLine = line.split("\n")[0];
			const content = readFile(destKey);
			if (content) {
				const sectionIdx = content.indexOf(SECTION_HEADING);
				if (sectionIdx !== -1) {
					const afterHeading = content.indexOf("\n", sectionIdx);
					if (afterHeading !== -1) {
						const before = content.slice(0, afterHeading + 1);
						const after = content.slice(afterHeading + 1);
						writeFile(destKey, before + line + "\n" + after);
					} else {
						writeFile(destKey, content + "\n" + line + "\n");
					}
				} else {
					const separator = content.endsWith("\n") ? "\n" : "\n\n";
					writeFile(destKey, content + separator + SECTION_HEADING + "\n" + line + "\n");
				}
			} else {
				writeFile(destKey, SECTION_HEADING + "\n" + line + "\n");
			}

			// Verify
			const verify = readFile(destKey);
			if (!verify.includes(firstLine)) {
				throw new Error(`Failed to verify write to ${destKey}: content not found`);
			}
		},

		removeProcessedFromInbox: async (items: InboxItem[]) => {
			const content = readFile(KEYS.inbox);
			if (!content) return;
			const updated = removeItemLines(content, items);
			writeFile(KEYS.inbox, updated);
		},

		removeLineFromFile: async (filePath: string, lineText: string) => {
			const key = KEYS.destPrefix + filePath;
			const content = readFile(key);
			if (!content) return;
			const updated = removeLineByText(content, lineText);
			writeFile(key, updated);
		},

		markItemDone: async (item: InboxItem) => {
			const content = readFile(KEYS.inbox);
			if (!content) return;
			const updated = checkOffItem(content, item);
			writeFile(KEYS.inbox, updated);
		},

		unmarkItemDone: async (item: InboxItem) => {
			const content = readFile(KEYS.inbox);
			if (!content) return;
			const updated = uncheckItem(content, item);
			writeFile(KEYS.inbox, updated);
		},

		createNote: async (name: string, folder: string) => {
			const path = `${folder}/${name}.md`;
			const key = KEYS.destPrefix + path;
			if (!readFile(key)) {
				writeFile(key, "");
			}
			return path;
		},

		pickDestinationFile: (folders: string[]) => {
			return new Promise<string | null>((resolve) => {
				if (_pickerSetter) {
					_pickerSetter({ folders, resolve });
				} else {
					// Fallback: no picker registered, resolve null
					resolve(null);
				}
			});
		},

		closeView: () => {
			// No-op in web context
		},

		getSettings,
	};
}

/**
 * List all destination paths stored in localStorage.
 */
export function listDestinations(): string[] {
	const paths: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.startsWith(KEYS.destPrefix)) {
			paths.push(key.slice(KEYS.destPrefix.length));
		}
	}
	return paths.sort();
}

/**
 * Export all Hipster PDA data as a JSON string.
 */
export function exportAllData(): string {
	const data: Record<string, string> = {};
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.startsWith("hipster-pda:")) {
			data[key] = localStorage.getItem(key) ?? "";
		}
	}
	return JSON.stringify(data, null, 2);
}

/**
 * Import data from a JSON string, merging into localStorage.
 */
export function importData(json: string): void {
	const data = JSON.parse(json) as Record<string, string>;
	for (const [key, value] of Object.entries(data)) {
		if (key.startsWith("hipster-pda:")) {
			localStorage.setItem(key, value);
		}
	}
}
