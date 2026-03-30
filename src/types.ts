export interface HipsterPdaSettings {
	inboxPath: string;
	somedayPath: string;
	timestampCaptures: boolean;
	contextTags: string[];
	showSourceInfo: boolean;
	animationDuration: number;
}

export const DEFAULT_SETTINGS: HipsterPdaSettings = {
	inboxPath: "Inbox/Inbox.md",
	somedayPath: "Inbox/Someday.md",
	timestampCaptures: false,
	contextTags: ["#home", "#work", "#computer", "#errands", "#phone"],
	showSourceInfo: true,
	animationDuration: 250,
};

export interface InboxItem {
	id: string;
	text: string;
	sourcePath?: string;
	lineNumber?: number;
	createdDate?: string;
}

export type Disposition =
	| { type: "actionable"; destination: string; tags: string[]; dueDate?: string; nextActions?: string[] }
	| { type: "delegate"; destination: string; waitingOn: string }
	| { type: "project"; destination: string; nextAction: string }
	| { type: "reference"; destination: string }
	| { type: "someday" }
	| { type: "trash" }
	| { type: "done-now" };

export interface ProcessedItem {
	item: InboxItem;
	disposition: Disposition;
}

export interface ObsidianBridge {
	readInboxFile(): Promise<InboxItem[]>;
	writeItemsToInbox(items: InboxItem[]): Promise<void>;
	writeItemToDestination(
		item: InboxItem,
		disposition: Disposition
	): Promise<void>;
	removeProcessedFromInbox(items: InboxItem[]): Promise<void>;
	removeLineFromFile(filePath: string, lineText: string): Promise<void>;
	markItemDone(item: InboxItem): Promise<void>;
	unmarkItemDone(item: InboxItem): Promise<void>;
	createNote(name: string, folder: string): Promise<string>;
	pickDestinationFile(folders: string[]): Promise<string | null>;
	closeView(): void;
	getSettings(): HipsterPdaSettings;
}
