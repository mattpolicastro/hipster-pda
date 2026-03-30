import type { InboxItem } from "./types";

const TASK_PATTERN = /^- \[ \] (.+)$/;
const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})\s+/;

export function parseInboxItems(
	content: string,
	sourcePath: string
): InboxItem[] {
	return content
		.split("\n")
		.map((line, index) => {
			const match = line.match(TASK_PATTERN);
			if (!match) return null;

			let text = match[1];
			let createdDate: string | undefined;

			const dateMatch = text.match(DATE_PREFIX);
			if (dateMatch) {
				createdDate = dateMatch[1];
				text = text.slice(dateMatch[0].length);
			}

			return {
				id: crypto.randomUUID() as string,
				text,
				sourcePath,
				lineNumber: index,
				createdDate,
			} as InboxItem;
		})
		.filter((item): item is InboxItem => item !== null);
}

export function serializeItemsAsCheckboxes(
	items: InboxItem[],
	timestamp: boolean
): string {
	const today = new Date().toISOString().slice(0, 10);
	return items
		.map((item) => {
			const prefix = timestamp ? `${today} ` : "";
			return `- [ ] ${prefix}${item.text}`;
		})
		.join("\n");
}

export function removeItemLines(
	content: string,
	items: InboxItem[]
): string {
	const lines = content.split("\n");

	// Build a map of line number → expected text for verification
	const toRemove = new Map<number, string>();
	for (const item of items) {
		if (item.lineNumber !== undefined) {
			toRemove.set(item.lineNumber, item.text);
		}
	}

	return lines
		.filter((line, i) => {
			if (!toRemove.has(i)) return true;
			// Only remove if the line still contains the expected text
			const expectedText = toRemove.get(i)!;
			if (line.includes(expectedText)) return false;
			// Line doesn't match — file changed, keep it to avoid data loss
			console.warn(`[hipster-pda] Line ${i} changed since load, skipping removal: "${line}"`);
			return true;
		})
		.join("\n");
}

export function checkOffItem(
	content: string,
	item: InboxItem
): string {
	const lines = content.split("\n");
	const index = lines.findIndex((l) => l.includes(`- [ ] `) && l.includes(item.text));
	if (index === -1) return content;
	lines[index] = lines[index].replace("- [ ] ", "- [x] ");
	return lines.join("\n");
}

export function uncheckItem(
	content: string,
	item: InboxItem
): string {
	const lines = content.split("\n");
	const index = lines.findIndex((l) => l.includes(`- [x] `) && l.includes(item.text));
	if (index === -1) return content;
	lines[index] = lines[index].replace("- [x] ", "- [ ] ");
	return lines.join("\n");
}

export function removeLineByText(
	content: string,
	lineText: string
): string {
	const lines = content.split("\n");
	const index = lines.findIndex((l) => l.includes(lineText));
	if (index === -1) return content;
	lines.splice(index, 1);
	return lines.join("\n");
}
