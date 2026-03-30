import { useRef, useState, useCallback, useEffect } from "react";
import type { InboxItem } from "./types";

interface SwipeCardProps {
	item: InboxItem;
	showSource: boolean;
	onSwipeLeft: () => void;
	onSwipeRight: () => void;
}

const SWIPE_THRESHOLD = 80;

export function SwipeCard({
	item,
	showSource,
	onSwipeLeft,
	onSwipeRight,
}: SwipeCardProps) {
	const cardRef = useRef<HTMLDivElement>(null);
	const [offsetX, setOffsetX] = useState(0);
	const [isDragging, setIsDragging] = useState(false);
	const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
	const startX = useRef(0);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (exitDir) return;
			startX.current = e.clientX;
			setIsDragging(true);
			cardRef.current?.setPointerCapture(e.pointerId);
		},
		[exitDir]
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!isDragging || exitDir) return;
			setOffsetX(e.clientX - startX.current);
		},
		[isDragging, exitDir]
	);

	const handlePointerUp = useCallback((e: React.PointerEvent) => {
		if (!isDragging || exitDir) return;
		cardRef.current?.releasePointerCapture(e.pointerId);
		setIsDragging(false);

		if (offsetX < -SWIPE_THRESHOLD) {
			setExitDir("left");
		} else if (offsetX > SWIPE_THRESHOLD) {
			setExitDir("right");
		} else {
			setOffsetX(0);
		}
	}, [isDragging, offsetX, exitDir]);

	const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
		if (e.propertyName !== "transform") return;
		if (exitDir === "left") {
			onSwipeLeft();
		} else if (exitDir === "right") {
			onSwipeRight();
		}
	}, [exitDir, onSwipeLeft, onSwipeRight]);

	// Reset state when item changes
	useEffect(() => {
		setOffsetX(0);
		setIsDragging(false);
		setExitDir(null);
	}, [item.id]);

	const rotation = isDragging ? offsetX * 0.08 : 0;
	const exitTransform = exitDir === "left"
		? "translateX(-150%) rotate(-30deg)"
		: exitDir === "right"
			? "translateX(150%) rotate(30deg)"
			: undefined;

	const style: React.CSSProperties = exitDir
		? { transform: exitTransform, opacity: 0 }
		: {
				transform: `translateX(${offsetX}px) rotate(${rotation}deg)`,
				transition: isDragging ? "none" : undefined,
			};

	const directionClass = offsetX < -30
		? " swipe-hint-left"
		: offsetX > 30
			? " swipe-hint-right"
			: "";

	return (
		<div
			ref={cardRef}
			className={`swipe-card${directionClass}`}
			style={style}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
			onTransitionEnd={handleTransitionEnd}
		>
			<div className="swipe-card-content">
				<p className="swipe-card-text">{item.text}</p>
				{showSource && item.sourcePath && (
					<p className="swipe-card-source">{item.sourcePath}</p>
				)}
			</div>
		</div>
	);
}
