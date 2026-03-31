import { App, PluginSettingTab, Setting } from "obsidian";
import type HipsterPdaPlugin from "./main";

export class HipsterPdaSettingTab extends PluginSettingTab {
	plugin: HipsterPdaPlugin;

	constructor(app: App, plugin: HipsterPdaPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Hipster PDA" });

		new Setting(containerEl)
			.setName("Inbox file path")
			.setDesc("Path to the inbox file to read and write")
			.addText((text) =>
				text
					.setPlaceholder("Inbox/Inbox.md")
					.setValue(this.plugin.settings.inboxPath)
					.onChange(async (value) => {
						this.plugin.settings.inboxPath = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Someday/Maybe file path")
			.setDesc("Path for someday/maybe items")
			.addText((text) =>
				text
					.setPlaceholder("Inbox/Someday.md")
					.setValue(this.plugin.settings.somedayPath)
					.onChange(async (value) => {
						this.plugin.settings.somedayPath = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Timestamp captures")
			.setDesc("Prepend YYYY-MM-DD to new captures in dump mode")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.timestampCaptures)
					.onChange(async (value) => {
						this.plugin.settings.timestampCaptures = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Context tags")
			.setDesc("Comma-separated tags shown in process mode (e.g. #home, #work)")
			.addText((text) =>
				text
					.setPlaceholder("#home, #work, #computer")
					.setValue(this.plugin.settings.contextTags.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.contextTags = value
							.split(",")
							.map((t) => t.trim())
							.filter((t) => t.length > 0);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show source info")
			.setDesc("Show source file and line number on process mode cards")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showSourceInfo)
					.onChange(async (value) => {
						this.plugin.settings.showSourceInfo = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Date format")
			.setDesc("How to interpret numeric dates like 3/4. ISO (YYYY-MM-DD) is always supported.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("us", "US (M/D/Y)")
					.addOption("eu", "EU (D/M/Y)")
					.addOption("iso", "ISO only")
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (value) => {
						this.plugin.settings.dateFormat = value as "us" | "eu" | "iso";
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h3", { text: "Tasks plugin" });

		new Setting(containerEl)
			.setName("Priority")
			.setDesc("Add a priority step when processing actionable items (⏫🔼🔽⏬)")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableTasksPriority)
					.onChange(async (value) => {
						this.plugin.settings.enableTasksPriority = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Recurrence")
			.setDesc('Add a recurrence step when processing actionable items (🔁 every …)')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableTasksRecurrence)
					.onChange(async (value) => {
						this.plugin.settings.enableTasksRecurrence = value;
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl("h3", { text: "Appearance" });

		new Setting(containerEl)
			.setName("Animation duration")
			.setDesc("Card transition duration in milliseconds (100–500)")
			.addSlider((slider) =>
				slider
					.setLimits(100, 500, 50)
					.setValue(this.plugin.settings.animationDuration)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.animationDuration = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
