import { useState, useEffect, useRef, useCallback } from "react";
import { listDestinations } from "./localStorageBridge";
import type { PickerRequest } from "./localStorageBridge";

interface DestinationPickerProps {
	request: PickerRequest;
	onDone: () => void;
}

export function DestinationPicker({ request, onDone }: DestinationPickerProps) {
	const [query, setQuery] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const allPaths = listDestinations();
	const filtered = allPaths.filter((p) => {
		const inFolder = request.folders.length === 0 || request.folders.some((f) => p.startsWith(f + "/"));
		const matchesQuery = !query.trim() || p.toLowerCase().includes(query.toLowerCase());
		return inFolder && matchesQuery;
	});

	const resolve = useCallback(
		(path: string | null) => {
			request.resolve(path);
			onDone();
		},
		[request, onDone]
	);

	const handleCreate = useCallback(() => {
		const raw = query.trim().replace(/[*?"<>|]/g, "");
		if (!raw) return;
		const startsWithFolder = request.folders.some((f) => raw.startsWith(f + "/"));
		const base = startsWithFolder ? raw : `${request.folders[0] ?? "Notes"}/${raw}`;
		const path = base.endsWith(".md") ? base : `${base}.md`;
		// Create the destination in localStorage
		const key = `hipster-pda:dest:${path}`;
		if (!localStorage.getItem(key)) {
			localStorage.setItem(key, "");
		}
		resolve(path);
	}, [query, request.folders, resolve]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				resolve(null);
			} else if (e.key === "Enter") {
				e.preventDefault();
				if (filtered.length > 0) {
					resolve(filtered[0]);
				} else if (query.trim()) {
					handleCreate();
				}
			}
		},
		[filtered, query, resolve, handleCreate]
	);

	return (
		<div className="dest-picker-overlay" onClick={() => resolve(null)}>
			<div className="dest-picker-modal" onClick={(e) => e.stopPropagation()}>
				<input
					ref={inputRef}
					type="text"
					className="dest-picker-input"
					placeholder="Search or create a note..."
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={handleKeyDown}
				/>
				<div className="dest-picker-list">
					{filtered.map((path) => (
						<button
							key={path}
							className="dest-picker-item"
							onClick={() => resolve(path)}
						>
							{path}
						</button>
					))}
					{query.trim() && (
						<button
							className="dest-picker-item dest-picker-create"
							onClick={handleCreate}
						>
							+ Create note: &ldquo;{query.trim()}&rdquo;
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
