export interface ServiceToolResult<T = unknown> {
	ok: boolean;
	data?: T;
	error?: string;
	citations?: string[];
	handoffSuggested?: boolean;
	handoffReason?: string;
}

export function createServiceToolResult<T>(result: ServiceToolResult<T>): ServiceToolResult<T> {
	return result;
}

export function isServiceToolResult(value: unknown): value is ServiceToolResult {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return typeof candidate.ok === "boolean";
}
