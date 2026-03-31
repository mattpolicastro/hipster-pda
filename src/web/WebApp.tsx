import { useState, useEffect, useCallback } from "react";
import { HipsterPdaApp } from "../HipsterPdaApp";
import { createLocalStorageBridge, setPickerStateSetter } from "./localStorageBridge";
import type { PickerRequest } from "./localStorageBridge";
import { DestinationPicker } from "./DestinationPicker";
import { SettingsPanel } from "./SettingsPanel";
import { ExportImport } from "./ExportImport";

const bridge = createLocalStorageBridge();

export function WebApp() {
	const [pickerRequest, setPickerRequest] = useState<PickerRequest | null>(null);
	const [showSettings, setShowSettings] = useState(false);
	const [showExport, setShowExport] = useState(false);

	// Register the picker state setter so the bridge can trigger the modal
	useEffect(() => {
		setPickerStateSetter(setPickerRequest);
		return () => setPickerStateSetter(() => {});
	}, []);

	// Set animation duration CSS variable
	useEffect(() => {
		const duration = bridge.getSettings().animationDuration;
		document.documentElement.style.setProperty("--it-animation-duration", `${duration}ms`);
	}, []);

	const handlePickerDone = useCallback(() => {
		setPickerRequest(null);
	}, []);

	return (
		<>
			<div className="web-toolbar">
				<button
					className="web-toolbar-btn"
					onClick={() => setShowSettings(true)}
					title="Settings"
				>
					&#x2699;
				</button>
				<button
					className="web-toolbar-btn"
					onClick={() => setShowExport(true)}
					title="Export / Import"
				>
					&#x21C5;
				</button>
			</div>

			<HipsterPdaApp bridge={bridge} />

			{pickerRequest && (
				<DestinationPicker request={pickerRequest} onDone={handlePickerDone} />
			)}
			{showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
			{showExport && <ExportImport onClose={() => setShowExport(false)} />}
		</>
	);
}
