import { useState, useEffect, useCallback, useMemo } from "react";
import type {
	InboxItem,
	ObsidianBridge,
	ProcessedItem,
	Disposition,
	TasksPriority,
} from "./types";
import { parseFuzzyDate, formatDate } from "./dateParser";

type Phase =
	| "swipe"
	| "act-2min" | "act-delegate" | "act-delegate-note"
	| "act-scope" | "act-next" | "act-due" | "act-priority" | "act-recurrence" | "act-tags" | "act-dest"
	| "act-project-next" | "act-project-dest"
	| "not-actionable"
	| "done";

const PRIORITY_OPTIONS: { value: TasksPriority; label: string; emoji: string; key: string }[] = [
	{ value: "highest", label: "Highest", emoji: "⏫", key: "1" },
	{ value: "high", label: "High", emoji: "🔼", key: "2" },
	{ value: "medium", label: "Medium", emoji: "", key: "3" },
	{ value: "low", label: "Low", emoji: "🔽", key: "4" },
	{ value: "lowest", label: "Lowest", emoji: "⏬", key: "5" },
];

interface ProcessModeProps {
	bridge: ObsidianBridge;
	items: InboxItem[];
	startIndex?: number;
	onExit: (processedCount: number) => void;
}

function summarizeOutcome(entry: ProcessedItem): string {
	const name = entry.item.text.length > 40
		? entry.item.text.slice(0, 40) + "…"
		: entry.item.text;
	const disp = entry.disposition;
	switch (disp.type) {
		case "actionable":
			return `"${name}" → ${disp.destination}`;
		case "reference":
			return `"${name}" → ${disp.destination}`;
		case "delegate":
			return `"${name}" → ${disp.destination} (waiting)`;
		case "project":
			return `"${name}" → ${disp.destination}`;
		case "someday":
			return `"${name}" → Someday/Maybe`;
		case "trash":
			return `"${name}" → Trashed`;
		case "done-now":
			return `"${name}" → Done`;
	}
}

export function ProcessMode({ bridge, items, startIndex = 0, onExit }: ProcessModeProps) {
	// Process in LIFO order (newest first, matching the stack visual)
	const reversedItems = useMemo(() => [...items].reverse(), [items]);
	const [currentIndex, setCurrentIndex] = useState(startIndex);
	const [processed, setProcessed] = useState<ProcessedItem[]>([]);
	const [phase, setPhase] = useState<Phase>("swipe");

	// Actionable flow state
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState("");
	const [dueInput, setDueInput] = useState("");
	const [waitingOnInput, setWaitingOnInput] = useState("");
	const [nextActionInput, setNextActionInput] = useState("");
	const [nextActions, setNextActions] = useState<string[]>([]);
	const [priority, setPriority] = useState<TasksPriority>(null);
	const [recurrenceInput, setRecurrenceInput] = useState("");

	const settings = bridge.getSettings();
	const currentItem = reversedItems[currentIndex] ?? null;
	const parsedDue = useMemo(() => parseFuzzyDate(dueInput, settings.dateFormat), [dueInput, settings.dateFormat]);

	// Dynamic phase chain: due → [priority] → [recurrence] → tags
	const phaseAfterDue: Phase = settings.enableTasksPriority ? "act-priority"
		: settings.enableTasksRecurrence ? "act-recurrence" : "act-tags";
	const phaseAfterPriority: Phase = settings.enableTasksRecurrence ? "act-recurrence" : "act-tags";
	const phaseBeforeTags: Phase = settings.enableTasksRecurrence ? "act-recurrence"
		: settings.enableTasksPriority ? "act-priority" : "act-due";

	const resetSubRouting = useCallback(() => {
		setSelectedTags([]);
		setTagInput("");
		setDueInput("");
		setWaitingOnInput("");
		setNextActionInput("");
		setNextActions([]);
		setPriority(null);
		setRecurrenceInput("");
	}, []);

	// --- Card advancement ---

	const advanceCard = useCallback(
		async (disposition: Disposition) => {
			if (!currentItem) return;

			try {
				await bridge.writeItemToDestination(currentItem, disposition);
			} catch (err) {
				console.error("[hipster-pda] Write failed, item kept in inbox:", err);
				return; // Don't advance — item stays in inbox
			}

			// Remove from inbox immediately (except done-now, which is checked off in place)
			if (disposition.type !== "done-now") {
				await bridge.removeProcessedFromInbox([currentItem]);
			}

			const entry: ProcessedItem = { item: currentItem, disposition };
			const newProcessed = [...processed, entry];
			setProcessed(newProcessed);

			const nextIndex = currentIndex + 1;
			if (nextIndex >= reversedItems.length) {
				onExit(newProcessed.length);
			} else {
				setCurrentIndex(nextIndex);
				setPhase("swipe");
			}
			resetSubRouting();
		},
		[currentItem, currentIndex, reversedItems.length, processed, bridge, resetSubRouting, onExit]
	);

	const handleDoItNow = useCallback(async () => {
		if (!currentItem) return;

		try {
			await bridge.markItemDone(currentItem);
		} catch (err) {
			console.error("[hipster-pda] Mark done failed, item kept in inbox:", err);
			return;
		}

		const entry: ProcessedItem = { item: currentItem, disposition: { type: "done-now" } };
		const newProcessed = [...processed, entry];
		setProcessed(newProcessed);

		const nextIndex = currentIndex + 1;
		if (nextIndex >= reversedItems.length) {
			onExit(newProcessed.length);
		} else {
			setCurrentIndex(nextIndex);
			setPhase("swipe");
		}
		resetSubRouting();
	}, [currentItem, processed, currentIndex, reversedItems.length, bridge, resetSubRouting]);

	// --- Actionable flow ---

	const handleSwipeLeft = useCallback(() => setPhase("act-2min"), []);
	const handleSwipeRight = useCallback(() => setPhase("not-actionable"), []);

	const handleConfirmDelegate = useCallback(() => {
		if (!waitingOnInput.trim()) return;
		bridge.pickDestinationFile(["Projects", "Areas"]).then((path) => {
			if (path) {
				advanceCard({
					type: "delegate",
					destination: path,
					waitingOn: waitingOnInput.trim(),
				});
			} else {
				setPhase("act-delegate-note");
			}
		});
	}, [bridge, waitingOnInput, advanceCard]);

	const handleAdvanceToDest = useCallback(() => {
		setPhase("act-dest");
		bridge.pickDestinationFile(["Projects", "Areas"]).then((path) => {
			if (path) {
				advanceCard({
					type: "actionable",
					destination: path,
					tags: selectedTags,
					dueDate: parsedDue ? formatDate(parsedDue) : undefined,
					nextActions: nextActions.length > 0 ? nextActions : undefined,
					priority: priority,
					recurrence: recurrenceInput.trim() || undefined,
				});
			} else {
				setPhase("act-tags");
			}
		});
	}, [bridge, selectedTags, parsedDue, nextActions, priority, recurrenceInput, advanceCard]);

	const handleConfirmProject = useCallback(() => {
		if (!nextActionInput.trim()) return;
		setPhase("act-project-dest");
		bridge.pickDestinationFile(["Projects"]).then((path) => {
			if (path) {
				advanceCard({
					type: "project",
					destination: path,
					nextAction: nextActionInput.trim(),
				});
			} else {
				setPhase("act-project-next");
			}
		});
	}, [bridge, nextActionInput, advanceCard]);

	const handleCreateProjectNote = useCallback(async () => {
		if (!currentItem || !nextActionInput.trim()) return;
		const name = currentItem.text.slice(0, 60).replace(/[\\/:*?"<>|]/g, "");
		const path = await bridge.createNote(name, "Projects");
		advanceCard({
			type: "project",
			destination: path,
			nextAction: nextActionInput.trim(),
		});
	}, [currentItem, nextActionInput, bridge, advanceCard]);

	// --- Not actionable flow ---

	const handleNotActionable = useCallback(
		(subType: "trash" | "reference" | "someday") => {
			if (subType === "reference") {
				bridge.pickDestinationFile(["Resources"]).then((path) => {
					if (path) {
						advanceCard({ type: "reference", destination: path });
					} else {
						setPhase("not-actionable");
					}
				});
			} else if (subType === "someday") {
				advanceCard({ type: "someday" });
			} else {
				advanceCard({ type: "trash" });
			}
		},
		[bridge, advanceCard]
	);

	// --- Undo ---

	const handleUndo = useCallback(async () => {
		if (processed.length === 0) return;

		const last = processed[processed.length - 1];
		const disp = last.disposition;

		if (disp.type === "actionable") {
			const tags = disp.tags.length > 0 ? " " + disp.tags.join(" ") : "";
			const priorityEmoji: Record<string, string> = { highest: " ⏫", high: " 🔼", low: " 🔽", lowest: " ⏬" };
			const pri = disp.priority ? (priorityEmoji[disp.priority] ?? "") : "";
			const rec = disp.recurrence ? ` 🔁 ${disp.recurrence}` : "";
			const due = disp.dueDate ? ` 📅 ${disp.dueDate}` : "";
			await bridge.removeLineFromFile(disp.destination, `- [ ] ${last.item.text}${tags}${pri}${rec}${due}`);
			if (disp.nextActions) {
				for (const action of disp.nextActions) {
					await bridge.removeLineFromFile(disp.destination, `\t- [ ] ${action}`);
				}
			}
		} else if (disp.type === "delegate") {
			await bridge.removeLineFromFile(disp.destination, `- [ ] ${last.item.text} #waiting ${disp.waitingOn}`);
		} else if (disp.type === "project") {
			await bridge.removeLineFromFile(disp.destination, `- [ ] ${disp.nextAction}`);
		} else if (disp.type === "reference") {
			await bridge.removeLineFromFile(disp.destination, `- ${last.item.text}`);
		} else if (disp.type === "someday") {
			await bridge.removeLineFromFile(settings.somedayPath, `- [ ] ${last.item.text} #someday`);
		} else if (disp.type === "done-now") {
			await bridge.unmarkItemDone(last.item);
		}

		// Re-add item to inbox (except done-now, which was checked off in place)
		if (disp.type !== "done-now") {
			await bridge.writeItemsToInbox([last.item]);
		}

		setProcessed(processed.slice(0, -1));
		setCurrentIndex(currentIndex - 1);
		setPhase("swipe");
		resetSubRouting();
	}, [processed, currentIndex, bridge, settings.somedayPath, resetSubRouting]);

	// --- Custom tags ---

	const tagSuggestions = useMemo(() => {
		const q = tagInput.trim().toLowerCase();
		if (!q) return [];
		return settings.contextTags.filter(
			(t) => t.toLowerCase().includes(q) && !selectedTags.includes(t)
		);
	}, [tagInput, settings.contextTags, selectedTags]);

	const handleAddTag = useCallback(() => {
		const raw = tagInput.trim();
		if (!raw) return;
		// If there's a matching suggestion, use it
		if (tagSuggestions.length > 0) {
			const match = tagSuggestions[0];
			if (!selectedTags.includes(match)) {
				setSelectedTags((prev) => [...prev, match]);
			}
		} else {
			const tag = raw.startsWith("#") ? raw : `#${raw}`;
			if (!selectedTags.includes(tag)) {
				setSelectedTags((prev) => [...prev, tag]);
			}
		}
		setTagInput("");
	}, [tagInput, tagSuggestions, selectedTags]);

	const handleExitToCapture = useCallback(() => {
		onExit(processed.length);
	}, [onExit, processed.length]);

	// --- Keyboard navigation ---

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement)?.tagName;
			const inInput = tag === "INPUT" || tag === "TEXTAREA";

			switch (phase) {
				case "swipe":
					if (e.key === "ArrowLeft") handleSwipeRight();
					else if (e.key === "ArrowRight") handleSwipeLeft();
					else if (e.key === "Escape") handleExitToCapture();
					break;
				case "act-2min":
					if (e.key === "Escape") { setPhase("swipe"); resetSubRouting(); }
					else if (e.key === "ArrowLeft") { e.preventDefault(); handleDoItNow(); }
					else if (e.key === "ArrowRight") { e.preventDefault(); setPhase("act-next"); }
					break;
				case "act-delegate":
					if (e.key === "Escape") setPhase("act-2min");
					else if (e.key === "d") { e.preventDefault(); setPhase("act-delegate-note"); }
					else if (e.key === "m" || e.key === "Enter") { e.preventDefault(); setPhase("act-2min"); }
					break;
				case "act-delegate-note":
					if (e.key === "Escape") setPhase("act-delegate");
					break;
				case "act-scope":
					if (e.key === "Escape") setPhase("act-delegate");
					else if (e.key === "s" || e.key === "1") { e.preventDefault(); setPhase("act-due"); }
					else if (e.key === "p" || e.key === "2") { e.preventDefault(); setPhase("act-project-next"); }
					break;
				case "act-next":
					if (e.key === "Escape") setPhase("act-2min");
					break;
				case "act-due":
					if (e.key === "Escape") setPhase("act-next");
					break;
				case "act-priority":
					if (e.key === "Escape") setPhase("act-due");
					else if (!inInput) {
						const opt = PRIORITY_OPTIONS.find((o) => o.key === e.key);
						if (opt) { setPriority(opt.value === "medium" ? null : opt.value); setPhase(phaseAfterPriority); }
					}
					break;
				case "act-recurrence":
					if (e.key === "Escape") setPhase(settings.enableTasksPriority ? "act-priority" : "act-due");
					break;
				case "act-tags":
					if (e.key === "Escape") setPhase(phaseBeforeTags);
					break;
				case "act-dest":
					if (e.key === "Escape") setPhase("act-tags");
					break;
				case "act-project-next":
					if (e.key === "Escape") setPhase("act-2min");
					break;
				case "act-project-dest":
					if (e.key === "Escape") setPhase("act-project-next");
					break;
				case "not-actionable":
					if (e.key === "Escape") { setPhase("swipe"); resetSubRouting(); }
					else if (e.key === "ArrowRight") handleNotActionable("reference");
					else if (e.key === "ArrowLeft") handleNotActionable("someday");
					else if (e.key === "ArrowDown") { e.preventDefault(); handleNotActionable("trash"); }
					break;
			}
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [phase, handleSwipeLeft, handleSwipeRight, handleDoItNow, handleAdvanceToDest, handleNotActionable, resetSubRouting, handleExitToCapture]);

	// --- Render ---

	const allTags = [
		...new Set([
			...settings.contextTags,
			...selectedTags.filter((t) => !settings.contextTags.includes(t)),
		]),
	];

	// --- Nav targets per phase ---
	const phaseNav: Record<string, { back?: () => void; next?: () => void; nextLabel?: string }> = {
		"swipe": {},
		"act-2min": { back: () => { setPhase("swipe"); resetSubRouting(); } },
		"act-next": {
			back: () => setPhase("act-2min"),
			next: () => setPhase("act-due"),
			nextLabel: nextActions.length > 0 ? "Next →" : "Skip →",
		},
		"act-due": {
			back: () => setPhase("act-next"),
			next: dueInput.trim() ? () => setPhase(phaseAfterDue) : () => { setDueInput(""); setPhase(phaseAfterDue); },
			nextLabel: dueInput.trim() ? "Next →" : "Skip →",
		},
		"act-priority": {
			back: () => setPhase("act-due"),
			next: () => setPhase(phaseAfterPriority),
			nextLabel: "Skip →",
		},
		"act-recurrence": {
			back: () => setPhase(settings.enableTasksPriority ? "act-priority" : "act-due"),
			next: recurrenceInput.trim() ? () => setPhase("act-tags") : () => { setRecurrenceInput(""); setPhase("act-tags"); },
			nextLabel: recurrenceInput.trim() ? "Next →" : "Skip →",
		},
		"act-tags": {
			back: () => setPhase(phaseBeforeTags),
			next: handleAdvanceToDest,
			nextLabel: "File it away →",
		},
		"act-dest": { back: () => setPhase("act-tags") },
		"not-actionable": { back: () => { setPhase("swipe"); resetSubRouting(); } },
		"act-delegate": { back: () => setPhase("act-2min") },
		"act-delegate-note": {
			back: () => setPhase("act-delegate"),
			next: handleConfirmDelegate,
			nextLabel: waitingOnInput.trim() ? "File it away →" : undefined,
		},
		"act-scope": { back: () => setPhase("act-delegate") },
		"act-project-next": {
			back: () => setPhase("act-2min"),
			next: handleConfirmProject,
			nextLabel: nextActionInput.trim() ? "File it away →" : undefined,
		},
		"act-project-dest": { back: () => setPhase("act-project-next") },
	};

	const nav = phaseNav[phase] ?? {};

	const lastProcessed = processed.length > 0 ? processed[processed.length - 1] : null;

	return (
		<div className="process-mode">
			{lastProcessed && phase === "swipe" && (
				<div className="process-outcome-anchor">
					{phase === "swipe" && (
						<p className="card-stack-hint card-stack-hint-above">
							<a className="process-outcome-undo" onClick={handleUndo}>Undo</a>
						</p>
					)}
					<div className="process-outcome-card">
						<span className="process-outcome-check">&#x2713;</span>
						<span className="process-outcome-text">
							{summarizeOutcome(lastProcessed)}
						</span>
					</div>
				</div>
			)}
			<div className="process-card-wrapper">
					<div className="process-nav-bar">
					<div className="process-nav-left">
						{nav.back && <a className="nav-link" onClick={nav.back}>&larr; Back</a>}
					</div>
					<div className="process-nav-right">
						{nav.next && nav.nextLabel && <a className="nav-link" onClick={nav.next}>{nav.nextLabel}</a>}
					</div>
				</div>
				{currentItem && (
					<div className="process-card-stack">
					<div key={currentItem.id} className="process-item-context">
						<span className="process-item-text">{currentItem.text}</span>

						{/* Next actions — show input when on that phase, otherwise show values */}
						{phase === "act-next" ? (
							<div className="process-card-details">
								<span className="process-card-label">Next</span>
								{nextActions.map((action, i) => (
									<div key={i} className="process-card-detail-row">
										<span className="process-card-detail">- {action}</span>
										<span className="process-card-remove" onClick={() => setNextActions((prev) => prev.filter((_, j) => j !== i))}>&times;</span>
									</div>
								))}
								<input
									type="text"
									className="card-inline-input"
									placeholder={nextActions.length === 0 ? "e.g. 'Call the dentist' · Enter to skip" : "Add another · Enter to continue"}
									value={nextActionInput}
									onChange={(e) => setNextActionInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											if (nextActionInput.trim()) {
												setNextActions((prev) => [...prev, nextActionInput.trim()]);
												setNextActionInput("");
											} else {
												setPhase("act-due");
											}
										}
									}}
									autoFocus
								/>
							</div>
						) : nextActions.length > 0 ? (
							<div className="process-card-details">
								<span className="process-card-label">Next</span>
								{nextActions.map((action, i) => (
									<div key={i} className="process-card-detail-row">
										<span className="process-card-detail">- {action}</span>
										<span className="process-card-remove" onClick={() => setNextActions((prev) => prev.filter((_, j) => j !== i))}>&times;</span>
									</div>
								))}
							</div>
						) : null}

						{/* Due date — show input when on that phase, otherwise show value */}
						{phase === "act-due" ? (
							<div className="process-card-details">
								<span className="process-card-label">Due</span>
								<input
									type="text"
									className="card-inline-input"
									placeholder="e.g. '3 weeks', 'friday' · Enter to skip"
									value={dueInput}
									onChange={(e) => setDueInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") { e.preventDefault(); setPhase(phaseAfterDue); }
									}}
									autoFocus
								/>
								{dueInput && (
									<div className="process-card-detail" style={{ marginTop: 2 }}>
										{parsedDue ? `→ ${formatDate(parsedDue)}` : "Not recognized"}
									</div>
								)}
							</div>
						) : parsedDue ? (
							<div className="process-card-details">
								<span className="process-card-label">Due</span>
								<div className="process-card-detail">📅 {formatDate(parsedDue)}</div>
							</div>
						) : null}

						{/* Priority — show picker when on that phase, otherwise show value */}
						{settings.enableTasksPriority && phase === "act-priority" ? (
							<div className="process-card-details">
								<span className="process-card-label">Priority</span>
								<div className="priority-picks">
									{PRIORITY_OPTIONS.map((opt) => (
										<button
											key={opt.value}
											className={`priority-pick${priority === opt.value || (opt.value === "medium" && priority === null) ? " priority-pick-active" : ""}`}
											onClick={() => { setPriority(opt.value === "medium" ? null : opt.value); setPhase(phaseAfterPriority); }}
										>
											<kbd>{opt.key}</kbd> {opt.emoji ? `${opt.emoji} ` : ""}{opt.label}
										</button>
									))}
								</div>
							</div>
						) : settings.enableTasksPriority && priority ? (
							<div className="process-card-details">
								<span className="process-card-label">Priority</span>
								<div className="process-card-detail">{PRIORITY_OPTIONS.find((o) => o.value === priority)?.emoji} {priority}</div>
							</div>
						) : null}

						{/* Recurrence — show input when on that phase, otherwise show value */}
						{settings.enableTasksRecurrence && phase === "act-recurrence" ? (
							<div className="process-card-details">
								<span className="process-card-label">Recurrence</span>
								<input
									type="text"
									className="card-inline-input"
									placeholder="e.g. 'every week', 'every 2 months' · Enter to skip"
									value={recurrenceInput}
									onChange={(e) => setRecurrenceInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") { e.preventDefault(); setPhase("act-tags"); }
									}}
									autoFocus
								/>
							</div>
						) : settings.enableTasksRecurrence && recurrenceInput.trim() ? (
							<div className="process-card-details">
								<span className="process-card-label">Recurrence</span>
								<div className="process-card-detail">🔁 {recurrenceInput.trim()}</div>
							</div>
						) : null}

						{/* Tags — show input when on that phase, otherwise show value */}
						{phase === "act-tags" ? (
							<div className="process-card-details">
								<span className="process-card-label">Tags</span>
								<div className="tag-combo" style={{ marginBottom: 0 }}>
									<input
										type="text"
										className="card-inline-input"
										placeholder="Type a tag... · Enter to skip"
										value={tagInput}
										onChange={(e) => setTagInput(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												if (tagInput.trim()) { handleAddTag(); }
												else { handleAdvanceToDest(); }
											}
										}}
										autoFocus
									/>
									{tagSuggestions.length > 0 && (
										<div className="tag-combo-suggestions">
											{tagSuggestions.map((tag) => (
												<button key={tag} className="tag-combo-suggestion" onMouseDown={(e) => { e.preventDefault(); setSelectedTags((prev) => [...prev, tag]); setTagInput(""); }}>{tag}</button>
											))}
										</div>
									)}
								</div>
								{selectedTags.length > 0 && (
									<div className="tag-selected-pills" style={{ marginTop: 4 }}>
										{selectedTags.map((tag) => (
											<span key={tag} className={`tag-combo-pill${!settings.contextTags.includes(tag) ? " tag-pill-custom" : ""}`} onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}>{tag} &times;</span>
										))}
									</div>
								)}
							</div>
						) : selectedTags.length > 0 ? (
							<div className="process-card-details">
								<span className="process-card-label">Tags</span>
								<div className="process-card-detail">{selectedTags.join(" ")}</div>
							</div>
						) : null}
					</div>
					{/* Placeholder cards behind the current card showing remaining items */}
					{(() => {
						const remaining = reversedItems.length - currentIndex - 1;
						const count = Math.min(remaining, 4);
						if (count <= 0) return null;
						return Array.from({ length: count }, (_, i) => {
							const seed = (currentIndex + i + 1) * 7;
							const rotation = ((seed % 7) - 3) * 1.0;
							const offsetX = ((seed % 5) - 2) * 2;
							return (
								<div
									key={`placeholder-${i}`}
									className="process-placeholder-card"
									style={{ transform: `rotate(${rotation}deg) translateX(${offsetX}px)`, top: `${(i + 1) * 5}px` }}
								/>
							);
						});
					})()}
					</div>
				)}

				{phase === "swipe" && (
					<div className="sub-routing">
						<div className="gtd-lr-choices">
							<button className="gtd-lr-choice gtd-lr-left" onClick={handleSwipeRight}>
								<kbd>&larr;</kbd> Not Actionable
							</button>
							<button className="gtd-lr-choice gtd-lr-right" onClick={handleSwipeLeft}>
								Actionable <kbd>&rarr;</kbd>
							</button>
						</div>
					</div>
				)}

			{/* === ACTIONABLE: 2-minute rule === */}
			{phase === "act-2min" && (
				<div className="sub-routing">
					<p className="sub-routing-label">Can you do this in 2 minutes?</p>
					<div className="gtd-lr-choices">
						<button className="gtd-lr-choice gtd-lr-left" onClick={handleDoItNow}>
							<kbd>&larr;</kbd> Yes, doing it now
						</button>
						<button className="gtd-lr-choice gtd-lr-right" onClick={() => setPhase("act-next")}>
							No, process for later <kbd>&rarr;</kbd>
						</button>
					</div>
				</div>
			)}

			{/* === ACTIONABLE: Next actions === */}
			{phase === "act-next" && (
				<div className="sub-routing" />
			)}

			{/* === ACTIONABLE: Delegate === */}
			{phase === "act-delegate" && (
				<div className="sub-routing">
					<p className="sub-routing-label">Are you the right person for this?</p>
					<div className="gtd-choices">
						<button className="dump-btn-primary" onClick={() => setPhase("act-2min")}>
							<kbd>M</kbd> Yes &mdash; it&rsquo;s mine
						</button>
						<button className="dump-btn-secondary" onClick={() => setPhase("act-delegate-note")}>
							<kbd>D</kbd> No &mdash; delegate
						</button>
					</div>
				</div>
			)}

			{/* === ACTIONABLE: Delegate note === */}
			{phase === "act-delegate-note" && (
				<div className="sub-routing">
					<p className="sub-routing-label">Who or what are you waiting on?</p>
					<input
						type="text"
						className="gtd-text-input"
						placeholder="e.g. '@bob to review PR'"
						value={waitingOnInput}
						onChange={(e) => setWaitingOnInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") { e.preventDefault(); handleConfirmDelegate(); }
						}}
						autoFocus
					/>
				</div>
			)}

			{/* === ACTIONABLE: Scope === */}
			{phase === "act-scope" && (
				<div className="sub-routing">
					<p className="sub-routing-label">Single action or project?</p>
					<div className="gtd-choices">
						<button className="dump-btn-primary" onClick={() => setPhase("act-due")}>
							<kbd>S</kbd> Single action
						</button>
						<button className="dump-btn-secondary" onClick={() => setPhase("act-project-next")}>
							<kbd>P</kbd> Project (multiple steps)
						</button>
					</div>
				</div>
			)}

			{/* === ACTIONABLE: Due date === */}
			{phase === "act-due" && (
				<div className="sub-routing" />
			)}

			{/* === ACTIONABLE: Tags === */}
			{phase === "act-tags" && (
				<div className="sub-routing">
					<div className="tag-quick-picks">
						{settings.contextTags
							.filter((t) => !selectedTags.includes(t))
							.map((tag) => (
								<button
									key={tag}
									className="tag-quick-pick"
									onClick={() => setSelectedTags((prev) => [...prev, tag])}
								>
									{tag}
								</button>
							))}
					</div>
				</div>
			)}

			{/* === ACTIONABLE: File picker === */}
			{phase === "act-dest" && (
				<div className="sub-routing" />
			)}

			{/* === PROJECT: Next action === */}
			{phase === "act-project-next" && (
				<div className="sub-routing">
					<p className="sub-routing-label">What&rsquo;s the very next physical action?</p>
					<input
						type="text"
						className="gtd-text-input"
						placeholder="e.g. 'Call the shop for a quote'"
						value={nextActionInput}
						onChange={(e) => setNextActionInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") { e.preventDefault(); handleConfirmProject(); }
						}}
						autoFocus
					/>
				</div>
			)}

			{/* === PROJECT: File picker === */}
			{phase === "act-project-dest" && (
				<div className="sub-routing" />
			)}

			{/* === NOT ACTIONABLE === */}
			{phase === "not-actionable" && (
				<div className="sub-routing">
					<p className="sub-routing-label">What is it?</p>
					<div className="gtd-lr-choices">
						<button className="gtd-lr-choice gtd-lr-left" onClick={() => handleNotActionable("someday")}>
							<kbd>&larr;</kbd> Someday / Maybe
						</button>
						<button className="gtd-lr-choice gtd-lr-right" onClick={() => handleNotActionable("reference")}>
							Reference &mdash; file it <kbd>&rarr;</kbd>
						</button>
					</div>
					<button className="ref-btn ref-btn-danger ref-btn-full" onClick={() => handleNotActionable("trash")}>
						<kbd>&darr;</kbd> Trash
					</button>
				</div>
			)}
			</div>

			{/* Empty notecard stack at bottom — exit to capture */}
			<div className="process-exit-stack" onClick={handleExitToCapture}>
				<div className="notecard-stack">
					<div className="notecard-stack-bg notecard-stack-bg-5" />
					<div className="notecard-stack-bg notecard-stack-bg-4" />
					<div className="notecard-stack-bg notecard-stack-bg-3" />
					<div className="notecard-stack-bg notecard-stack-bg-2" />
					<div className="process-exit-card">
						<div className="notecard-input-row">
							<span className="notecard-field-placeholder">What&rsquo;s on your mind?</span>
						</div>
					</div>
				</div>
				<p className="card-stack-hint">Write more cards</p>
			</div>
		</div>
	);
}
