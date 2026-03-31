import { useState, useCallback } from "react";
import type { HipsterPdaSettings, DateFormatLocale } from "../types";
import { DEFAULT_SETTINGS } from "../types";

const KEYS = {
	settings: "hipster-pda:settings",
} as const;

function loadSettings(): HipsterPdaSettings {
	const raw = localStorage.getItem(KEYS.settings);
	if (!raw) return { ...DEFAULT_SETTINGS };
	try {
		return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

function saveSettings(settings: HipsterPdaSettings): void {
	localStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

interface SettingsPanelProps {
	onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
	const [settings, setSettings] = useState(loadSettings);

	const update = useCallback((patch: Partial<HipsterPdaSettings>) => {
		setSettings((prev) => {
			const next = { ...prev, ...patch };
			saveSettings(next);
			return next;
		});
	}, []);

	return (
		<div className="settings-panel" onClick={(e) => e.stopPropagation()}>
			<div className="settings-header">
				<h2>Settings</h2>
				<button className="settings-close" onClick={onClose}>&times;</button>
			</div>

			<div className="settings-body">
					<label className="settings-field">
						<span className="settings-label">Inbox file path</span>
						<input
							type="text"
							className="settings-input"
							value={settings.inboxPath}
							onChange={(e) => update({ inboxPath: e.target.value })}
						/>
					</label>

					<label className="settings-field">
						<span className="settings-label">Someday/Maybe file path</span>
						<input
							type="text"
							className="settings-input"
							value={settings.somedayPath}
							onChange={(e) => update({ somedayPath: e.target.value })}
						/>
					</label>

					<label className="settings-field settings-toggle">
						<span className="settings-label">Timestamp captures</span>
						<input
							type="checkbox"
							checked={settings.timestampCaptures}
							onChange={(e) => update({ timestampCaptures: e.target.checked })}
						/>
					</label>

					<label className="settings-field">
						<span className="settings-label">Date format</span>
						<select
							className="settings-input"
							value={settings.dateFormat}
							onChange={(e) => update({ dateFormat: e.target.value as DateFormatLocale })}
						>
							<option value="us">US (M/D/Y)</option>
							<option value="eu">EU (D/M/Y)</option>
							<option value="iso">ISO only</option>
						</select>
					</label>

					<label className="settings-field">
						<span className="settings-label">Context tags (comma-separated)</span>
						<input
							type="text"
							className="settings-input"
							value={settings.contextTags.join(", ")}
							onChange={(e) =>
								update({
									contextTags: e.target.value
										.split(",")
										.map((t) => t.trim())
										.filter(Boolean),
								})
							}
						/>
					</label>

					<label className="settings-field settings-toggle">
						<span className="settings-label">Show source info</span>
						<input
							type="checkbox"
							checked={settings.showSourceInfo}
							onChange={(e) => update({ showSourceInfo: e.target.checked })}
						/>
					</label>

					<label className="settings-field">
						<span className="settings-label">Animation duration (ms)</span>
						<input
							type="number"
							className="settings-input"
							min={0}
							max={1000}
							step={50}
							value={settings.animationDuration}
							onChange={(e) => update({ animationDuration: Number(e.target.value) })}
						/>
					</label>

					<h3 className="settings-section-heading">Tasks plugin</h3>

					<label className="settings-field settings-toggle">
						<span className="settings-label">Priority step</span>
						<input
							type="checkbox"
							checked={settings.enableTasksPriority}
							onChange={(e) => update({ enableTasksPriority: e.target.checked })}
						/>
					</label>

					<label className="settings-field settings-toggle">
						<span className="settings-label">Recurrence step</span>
						<input
							type="checkbox"
							checked={settings.enableTasksRecurrence}
							onChange={(e) => update({ enableTasksRecurrence: e.target.checked })}
						/>
					</label>
			</div>
		</div>
	);
}
