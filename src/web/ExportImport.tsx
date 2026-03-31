import { useCallback, useRef } from "react";
import { exportAllData, importData } from "./localStorageBridge";

interface ExportImportProps {
	onClose: () => void;
}

export function ExportImport({ onClose }: ExportImportProps) {
	const fileRef = useRef<HTMLInputElement>(null);

	const handleExport = useCallback(() => {
		const json = exportAllData();
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `hipster-pda-backup-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}, []);

	const handleImport = useCallback(() => {
		fileRef.current?.click();
	}, []);

	const handleFileChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => {
				try {
					importData(reader.result as string);
					onClose();
					window.location.reload();
				} catch (err) {
					console.error("[hipster-pda] Import failed:", err);
					alert("Import failed. Check that the file is valid JSON.");
				}
			};
			reader.readAsText(file);
		},
		[onClose]
	);

	return (
		<div className="settings-panel" onClick={(e) => e.stopPropagation()}>
			<div className="settings-header">
				<h2>Data</h2>
				<button className="settings-close" onClick={onClose}>&times;</button>
			</div>
			<div className="settings-body">
				<p className="settings-description">
					Export your data as a JSON backup, or import a previous backup.
				</p>
				<button className="dump-btn-primary" onClick={handleExport} style={{ width: "100%", marginBottom: 8 }}>
					Export data
				</button>
				<button className="dump-btn-secondary" onClick={handleImport} style={{ width: "100%" }}>
					Import data
				</button>
				<input
					ref={fileRef}
					type="file"
					accept=".json"
					style={{ display: "none" }}
					onChange={handleFileChange}
				/>
			</div>
		</div>
	);
}
