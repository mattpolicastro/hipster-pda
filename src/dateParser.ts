const WEEKDAYS = [
	"sunday", "monday", "tuesday", "wednesday",
	"thursday", "friday", "saturday",
];

const MONTHS = [
	"january", "february", "march", "april", "may", "june",
	"july", "august", "september", "october", "november", "december",
];

const RELATIVE_RE = /^(\d+)\s*(day|week|month|year)s?$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFuzzyDate(input: string): Date | null {
	const trimmed = input.trim().toLowerCase();
	if (!trimmed) return null;

	// "today" / "tomorrow"
	if (trimmed === "today") return startOfDay(new Date());
	if (trimmed === "tomorrow") {
		const d = new Date();
		d.setDate(d.getDate() + 1);
		return startOfDay(d);
	}

	// Relative: "3 days", "2 weeks", "1 month"
	const rel = trimmed.match(RELATIVE_RE);
	if (rel) {
		const n = parseInt(rel[1], 10);
		const unit = rel[2].toLowerCase();
		const d = new Date();
		if (unit === "day") d.setDate(d.getDate() + n);
		else if (unit === "week") d.setDate(d.getDate() + n * 7);
		else if (unit === "month") d.setMonth(d.getMonth() + n);
		else if (unit === "year") d.setFullYear(d.getFullYear() + n);
		return startOfDay(d);
	}

	// Weekday: "monday", "friday"
	const weekdayIdx = WEEKDAYS.indexOf(trimmed);
	if (weekdayIdx !== -1) {
		const d = new Date();
		const today = d.getDay();
		let diff = weekdayIdx - today;
		if (diff <= 0) diff += 7;
		d.setDate(d.getDate() + diff);
		return startOfDay(d);
	}

	// ISO: "2026-05-01"
	if (ISO_RE.test(trimmed)) {
		const [y, m, day] = trimmed.split("-").map(Number);
		return new Date(y, m - 1, day);
	}

	// "Month Day" or "Month Day, Year": "May 1", "April 19, 2026"
	const monthMatch = trimmed.match(/^([a-z]+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?$/);
	if (monthMatch) {
		const monthIdx = MONTHS.indexOf(monthMatch[1]);
		if (monthIdx !== -1) {
			const day = parseInt(monthMatch[2], 10);
			const year = monthMatch[3] ? parseInt(monthMatch[3], 10) : new Date().getFullYear();
			return new Date(year, monthIdx, day);
		}
	}

	return null;
}

export function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function startOfDay(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
