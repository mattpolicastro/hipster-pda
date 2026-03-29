import { Plugin, WorkspaceLeaf } from "obsidian";
import { InboxTriageView, VIEW_TYPE_INBOX_TRIAGE } from "./InboxTriageView";

export default class InboxTriagePlugin extends Plugin {
	async onload() {
		this.registerView(
			VIEW_TYPE_INBOX_TRIAGE,
			(leaf) => new InboxTriageView(leaf)
		);

		this.addRibbonIcon("inbox", "Inbox Triage", () => {
			this.activateView();
		});

		this.addCommand({
			id: "open",
			name: "Open",
			callback: () => {
				this.activateView();
			},
		});
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_INBOX_TRIAGE);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_INBOX_TRIAGE);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({
				type: VIEW_TYPE_INBOX_TRIAGE,
				active: true,
			});
		}

		workspace.revealLeaf(leaf);
	}
}
