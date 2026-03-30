import { useState, useRef, useCallback, useEffect } from "react";
import type { InboxItem, ObsidianBridge } from "./types";
import { ProcessMode } from "./ProcessMode";

interface AppProps {
	bridge: ObsidianBridge;
}

export function HipsterPdaApp({ bridge }: AppProps) {
	const [inputValue, setInputValue] = useState("");
	const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
	const [isProcessing, setIsProcessing] = useState(false);
	const [processStartIndex, setProcessStartIndex] = useState(0);
	const [processKey, setProcessKey] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	const reloadInbox = useCallback(async () => {
		const loaded = await bridge.readInboxFile();
		setInboxItems(loaded);
	}, [bridge]);

	// Load inbox items on mount
	useEffect(() => {
		reloadInbox();
	}, [reloadInbox]);

	// Stack displayed in reverse (newest on top)
	const stackItems = [...inboxItems].reverse();

	// --- Capture ---

	const addItem = useCallback(async () => {
		const text = inputValue.trim();
		if (!text) return;
		setInputValue("");
		await bridge.writeItemsToInbox([{ id: crypto.randomUUID(), text }]);
		await reloadInbox();
		inputRef.current?.focus();
	}, [inputValue, bridge, reloadInbox]);

	const handleInputKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				addItem();
			}
		},
		[addItem]
	);

	// --- Processing ---

	const startProcessing = useCallback(async () => {
		const loaded = await bridge.readInboxFile();
		setInboxItems(loaded);
		if (loaded.length === 0) return;
		setProcessStartIndex(0);
		setProcessKey((k) => k + 1);
		setIsProcessing(true);
	}, [bridge]);

	const handleExitProcessing = useCallback(async () => {
		setIsProcessing(false);
		await reloadInbox();
	}, [reloadInbox]);

	const handleReturnToCapture = useCallback(() => {
		setIsProcessing(false);
		reloadInbox();
	}, [reloadInbox]);

	return (
		<div className="hipster-pda-container">
			{isProcessing ? (
				<ProcessMode
					key={processKey}
					bridge={bridge}
					items={inboxItems}
					startIndex={processStartIndex}
					onExit={handleExitProcessing}
				/>
			) : (
				<>
					{stackItems.length > 0 && (
						<div className="card-stack-anchor" onClick={startProcessing}>
							<p className="card-stack-hint card-stack-hint-above">
								{stackItems.length} {stackItems.length === 1 ? "card" : "cards"} to process
							</p>
							<div className="card-stack-list">
								{stackItems.slice(0, 5).map((item, index) => {
									const seed = item.id.charCodeAt(0) + item.id.charCodeAt(1);
									const rotation = ((seed % 7) - 3) * 1.0;
									return (
										<div
											key={item.id}
											className="card-stack-item"
											style={index > 0 ? { transform: `rotate(${rotation}deg) translateX(${((seed % 5) - 2) * 2}px)` } : undefined}
										>
											<span className="card-stack-item-text">
												{item.text}
											</span>
										</div>
									);
								})}
							</div>
						</div>
					)}

					<div className="notecard-input-wrapper">
						<div className="notecard-stack">
							<div className="notecard-stack-bg notecard-stack-bg-5" />
							<div className="notecard-stack-bg notecard-stack-bg-4" />
							<div className="notecard-stack-bg notecard-stack-bg-3" />
							<div className="notecard-stack-bg notecard-stack-bg-2" />
							<div className="notecard-input">
								<div className="notecard-input-row">
									<input
										ref={inputRef}
										type="text"
										className="notecard-field"
										placeholder="What's on your mind?"
										value={inputValue}
										onChange={(e) => setInputValue(e.target.value)}
										onKeyDown={handleInputKeyDown}
										autoFocus
									/>
								</div>
							</div>
						</div>
					</div>

					{stackItems.length === 0 && (
						<p className="hipster-pda-status">
							Inbox zero. Capture something above.
						</p>
					)}
				</>
			)}
		</div>
	);
}
