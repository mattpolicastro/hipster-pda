import { Plugin, WorkspaceLeaf } from "obsidian";
import { HipsterPdaView, VIEW_TYPE_HIPSTER_PDA } from "./HipsterPdaView";
import { HipsterPdaSettingTab } from "./settings";
import { DEFAULT_SETTINGS, type HipsterPdaSettings } from "./types";

export default class HipsterPdaPlugin extends Plugin {
	settings: HipsterPdaSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_HIPSTER_PDA,
			(leaf) => new HipsterPdaView(leaf, this)
		);

		this.addRibbonIcon("inbox", "Hipster PDA", () => {
			this.activateView();
		});

		this.addCommand({
			id: "open",
			name: "Open",
			callback: () => {
				this.activateView();
			},
		});

		this.addSettingTab(new HipsterPdaSettingTab(this.app, this));
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_HIPSTER_PDA);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_HIPSTER_PDA);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getLeaf("tab");
			await leaf.setViewState({
				type: VIEW_TYPE_HIPSTER_PDA,
				active: true,
			});
		}

		workspace.revealLeaf(leaf);
	}
}
