import { useState, useEffect, useCallback } from "react";
import { HipsterPdaApp } from "../HipsterPdaApp";
import { createLocalStorageBridge, setPickerStateSetter } from "./localStorageBridge";
import type { PickerRequest } from "./localStorageBridge";
import { DestinationPicker } from "./DestinationPicker";
import { SettingsPanel } from "./SettingsPanel";
import { ExportImport } from "./ExportImport";

const bridge = createLocalStorageBridge();

type PanelType = "settings" | "data" | null;
type Theme = "light" | "dark" | "system";

function getInitialTheme(): Theme {
	return (localStorage.getItem("hipster-pda:theme") as Theme) ?? "system";
}

function applyTheme(theme: Theme) {
	const resolved = theme === "system"
		? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
		: theme;
	document.documentElement.setAttribute("data-theme", resolved);
}

const THEME_ICONS: Record<Theme, string> = {
	light: "\u2600",   // ☀
	dark: "\u263E",    // ☾
	system: "\u25D0",  // ◐
};

const THEME_CYCLE: Theme[] = ["light", "dark", "system"];

export function WebApp() {
	const [pickerRequest, setPickerRequest] = useState<PickerRequest | null>(null);
	const [openPanel, setOpenPanel] = useState<PanelType>(null);
	const [theme, setTheme] = useState<Theme>(getInitialTheme);

	useEffect(() => {
		setPickerStateSetter(setPickerRequest);
		return () => setPickerStateSetter(() => {});
	}, []);

	useEffect(() => {
		const duration = bridge.getSettings().animationDuration;
		document.documentElement.style.setProperty("--it-animation-duration", `${duration}ms`);
	}, []);

	// Apply theme and listen for system changes
	useEffect(() => {
		applyTheme(theme);
		localStorage.setItem("hipster-pda:theme", theme);

		if (theme === "system") {
			const mq = window.matchMedia("(prefers-color-scheme: dark)");
			const handler = () => applyTheme("system");
			mq.addEventListener("change", handler);
			return () => mq.removeEventListener("change", handler);
		}
	}, [theme]);

	const cycleTheme = useCallback(() => {
		setTheme((prev) => {
			const idx = THEME_CYCLE.indexOf(prev);
			return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
		});
	}, []);

	const handlePickerDone = useCallback(() => {
		setPickerRequest(null);
	}, []);

	const togglePanel = useCallback((panel: PanelType) => {
		setOpenPanel((prev) => (prev === panel ? null : panel));
	}, []);

	const closePanel = useCallback(() => setOpenPanel(null), []);

	return (
		<>
			{openPanel && (
				<div className="web-toolbar-backdrop" onClick={closePanel} />
			)}

			<div className="web-toolbar">
				<div className="web-toolbar-buttons">
					<button
						className="web-toolbar-btn"
						onClick={cycleTheme}
						title={`Theme: ${theme}`}
					>
						{THEME_ICONS[theme]}
					</button>
					<button
						className={`web-toolbar-btn${openPanel === "settings" ? " web-toolbar-btn-active" : ""}`}
						onClick={() => togglePanel("settings")}
						title="Settings"
					>
						&#x2699;
					</button>
					<button
						className={`web-toolbar-btn${openPanel === "data" ? " web-toolbar-btn-active" : ""}`}
						onClick={() => togglePanel("data")}
						title="Export / Import"
					>
						&#x21C5;
					</button>
				</div>

				{openPanel === "settings" && <SettingsPanel onClose={closePanel} />}
				{openPanel === "data" && <ExportImport onClose={closePanel} />}
			</div>

			<HipsterPdaApp bridge={bridge} />

			{pickerRequest && (
				<DestinationPicker request={pickerRequest} onDone={handlePickerDone} />
			)}
		</>
	);
}
