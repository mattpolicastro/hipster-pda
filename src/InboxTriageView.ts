import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import { createElement } from "react";
import { InboxTriageApp } from "./InboxTriageApp";

export const VIEW_TYPE_INBOX_TRIAGE = "inbox-triage-view";

export class InboxTriageView extends ItemView {
	root: Root | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_INBOX_TRIAGE;
	}

	getDisplayText(): string {
		return "Inbox Triage";
	}

	getIcon(): string {
		return "inbox";
	}

	async onOpen() {
		this.root = createRoot(this.contentEl);
		this.root.render(createElement(InboxTriageApp));
	}

	async onClose() {
		this.root?.unmount();
		this.root = null;
	}
}
