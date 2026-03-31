import { useState, useEffect, useCallback } from "react";
import { HipsterPdaApp } from "../HipsterPdaApp";
import { createLocalStorageBridge, setPickerStateSetter } from "./localStorageBridge";
import type { PickerRequest } from "./localStorageBridge";
import { DestinationPicker } from "./DestinationPicker";
import { SettingsPanel } from "./SettingsPanel";
import { ExportImport } from "./ExportImport";

const bridge = createLocalStorageBridge();

type PanelType = "settings" | "data" | null;

export function WebApp() {
	const [pickerRequest, setPickerRequest] = useState<PickerRequest | null>(null);
	const [openPanel, setOpenPanel] = useState<PanelType>(null);

	useEffect(() => {
		setPickerStateSetter(setPickerRequest);
		return () => setPickerStateSetter(() => {});
	}, []);

	useEffect(() => {
		const duration = bridge.getSettings().animationDuration;
		document.documentElement.style.setProperty("--it-animation-duration", `${duration}ms`);
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
