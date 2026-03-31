const WEEKDAYS = [
	"sunday", "monday", "tuesday", "wednesday",
	"thursday", "friday", "saturday",
];

const MONTHS = [
	"january", "february", "march", "april", "may", "june",
	"july", "august", "september", "october", "november", "december",
];

const RELATIVE_RE = /^(\d+)\s*(day|week|month|year)s?$/i;
const NEXT_RE = /^next\s+(\d+\s+)?(day|week|month|year|[a-z]+)s?$/i;
const THIS_RE = /^this\s+(\d+\s+)?(day|week|month|year|[a-z]+)s?$/i;
const ISO_RE = /^\d{4}-\d{1,2}-\d{1,2}$/;
const SLASH_DATE_RE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;
const DOT_DATE_RE = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/;

const TIME_OF_DAY_TODAY = new Set([
	"tonight", "this evening", "this afternoon", "this morning",
]);
const TIME_OF_DAY_TOMORROW = new Set([
	"tomorrow morning", "tomorrow afternoon", "tomorrow evening", "tomorrow night",
]);

import type { DateFormatLocale } from "./types";

export function parseFuzzyDate(input: string, locale: DateFormatLocale = "us"): Date | null {
	const trimmed = input.trim().toLowerCase();
	if (!trimmed) return null;

	// Time-of-day phrases → today or tomorrow
	if (trimmed === "today" || TIME_OF_DAY_TODAY.has(trimmed)) return startOfDay(new Date());
	if (TIME_OF_DAY_TOMORROW.has(trimmed)) {
		const d = new Date();
		d.setDate(d.getDate() + 1);
		return startOfDay(d);
	}
	if (trimmed === "tomorrow") {
		const d = new Date();
		d.setDate(d.getDate() + 1);
		return startOfDay(d);
	}
	if (trimmed === "yesterday") {
		const d = new Date();
		d.setDate(d.getDate() - 1);
		return startOfDay(d);
	}

	// "end of week" / "eow" — next Friday
	if (trimmed === "eow" || trimmed === "end of week") {
		const d = new Date();
		const day = d.getDay();
		let diff = 5 - day; // 5 = Friday
		if (diff <= 0) diff += 7;
		d.setDate(d.getDate() + diff);
		return startOfDay(d);
	}

	// "end of month" / "eom"
	if (trimmed === "eom" || trimmed === "end of month") {
		const d = new Date();
		return new Date(d.getFullYear(), d.getMonth() + 1, 0);
	}

	// "end of year" / "eoy"
	if (trimmed === "eoy" || trimmed === "end of year") {
		return new Date(new Date().getFullYear(), 11, 31);
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

	// "next" phrases: "next week", "next monday", "next fri", "next 3 weeks"
	const nextMatch = trimmed.match(NEXT_RE);
	if (nextMatch) {
		const n = nextMatch[1] ? parseInt(nextMatch[1].trim(), 10) : 1;
		const unit = nextMatch[2].toLowerCase();
		const d = new Date();
		const weekdayTarget = matchWeekday(unit);
		const monthTarget = matchMonth(unit);
		if (weekdayTarget !== -1) {
			// "next monday" — always at least 7 days out (skip this week)
			const today = d.getDay();
			let diff = weekdayTarget - today;
			if (diff <= 0) diff += 7;
			diff += 7 * (n - 1);
			d.setDate(d.getDate() + diff);
		} else if (monthTarget !== -1) {
			// "next august" — 1st of that month; if it's past, jump to next year
			let year = d.getFullYear();
			if (monthTarget <= d.getMonth()) year += 1;
			return new Date(year, monthTarget, 1);
		} else if (unit === "day") {
			d.setDate(d.getDate() + n);
		} else if (unit === "week") {
			d.setDate(d.getDate() + n * 7);
		} else if (unit === "month") {
			d.setMonth(d.getMonth() + n);
		} else if (unit === "year") {
			d.setFullYear(d.getFullYear() + n);
		}
		return startOfDay(d);
	}

	// "this" phrases: "this week" (→ this Friday), "this friday", "this month" (→ end of month)
	const thisMatch = trimmed.match(THIS_RE);
	if (thisMatch) {
		const n = thisMatch[1] ? parseInt(thisMatch[1].trim(), 10) : 1;
		const unit = thisMatch[2].toLowerCase();
		const d = new Date();
		const weekdayTarget = matchWeekday(unit);
		const monthTarget = matchMonth(unit);
		if (weekdayTarget !== -1) {
			// "this friday" — this week, even if it's today; never wraps to next week
			const today = d.getDay();
			let diff = weekdayTarget - today;
			if (diff < 0) diff += 7;
			diff += 7 * (n - 1);
			d.setDate(d.getDate() + diff);
			return startOfDay(d);
		} else if (monthTarget !== -1) {
			// "this august" — 1st of that month in the current year
			return new Date(d.getFullYear(), monthTarget, 1);
		} else if (unit === "week") {
			// "this week" → this coming Friday
			const today = d.getDay();
			let diff = 5 - today; // 5 = Friday
			if (diff <= 0) diff += 7;
			d.setDate(d.getDate() + diff);
			return startOfDay(d);
		} else if (unit === "month") {
			// "this month" → last day of current month
			return new Date(d.getFullYear(), d.getMonth() + 1, 0);
		} else if (unit === "year") {
			return new Date(d.getFullYear(), 11, 31);
		}
	}

	// Weekday: "monday", "friday" (also short forms: "mon", "fri")
	const weekdayIdx = matchWeekday(trimmed);
	if (weekdayIdx !== -1) {
		const d = new Date();
		const today = d.getDay();
		let diff = weekdayIdx - today;
		if (diff <= 0) diff += 7;
		d.setDate(d.getDate() + diff);
		return startOfDay(d);
	}

	// ISO: "2026-05-01", "2026-8-1"
	if (ISO_RE.test(trimmed)) {
		const [y, m, day] = trimmed.split("-").map(Number);
		return new Date(y, m - 1, day);
	}

	// Regional numeric dates: M/D/Y (US), D/M/Y (EU), D.M.Y (EU)
	const slashMatch = locale !== "iso" ? trimmed.match(SLASH_DATE_RE) : null;
	const dotMatch = locale === "eu" ? trimmed.match(DOT_DATE_RE) : null;
	const numMatch = slashMatch || dotMatch;
	if (numMatch) {
		const a = parseInt(numMatch[1], 10);
		const b = parseInt(numMatch[2], 10);
		let year = numMatch[3] ? parseInt(numMatch[3], 10) : new Date().getFullYear();
		if (year < 100) year += 2000;
		if (locale === "us") {
			// M/D/Y
			return new Date(year, a - 1, b);
		} else {
			// D/M/Y or D.M.Y
			return new Date(year, b - 1, a);
		}
	}

	// "Month Day" or "Month Day, Year": "May 1", "Apr 19", "April 19, 2026"
	const monthMatch = trimmed.match(/^([a-z]+)\.?\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?$/);
	if (monthMatch) {
		const monthIdx = matchMonth(monthMatch[1]);
		if (monthIdx !== -1) {
			const day = parseInt(monthMatch[2], 10);
			const year = monthMatch[3] ? parseInt(monthMatch[3], 10) : new Date().getFullYear();
			return new Date(year, monthIdx, day);
		}
	}

	// "Day Month" or "Day Month Year": "19 April", "1 May 2026"
	const dayMonthMatch = trimmed.match(/^(\d{1,2})\s+([a-z]+)\.?(?:\s+(\d{4}))?$/);
	if (dayMonthMatch) {
		const monthIdx = matchMonth(dayMonthMatch[2]);
		if (monthIdx !== -1) {
			const day = parseInt(dayMonthMatch[1], 10);
			const year = dayMonthMatch[3] ? parseInt(dayMonthMatch[3], 10) : new Date().getFullYear();
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

const WEEKDAY_ABBREVS: Record<string, number> = {
	sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
};

function matchWeekday(s: string): number {
	const full = WEEKDAYS.indexOf(s);
	if (full !== -1) return full;
	return WEEKDAY_ABBREVS[s] ?? -1;
}

const MONTH_ABBREVS: Record<string, number> = {
	jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
	jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

function matchMonth(s: string): number {
	const full = MONTHS.indexOf(s);
	if (full !== -1) return full;
	return MONTH_ABBREVS[s] ?? -1;
}
