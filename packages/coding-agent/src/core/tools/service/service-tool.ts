import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { Static, TSchema } from "@sinclair/typebox";
import type { ExtensionContext, ToolDefinition } from "../../extensions/types.js";
import { wrapToolDefinition } from "../tool-definition-wrapper.js";
import { createServiceToolResult, type ServiceToolResult } from "./service-tool-result.js";

export interface CreateServiceToolDefinitionOptions<TParams extends TSchema, TData = unknown> {
	name: string;
	label?: string;
	description: string;
	promptSnippet?: string;
	promptGuidelines?: string[];
	parameters: TParams;
	execute: (
		params: Static<TParams>,
		ctx: ExtensionContext | undefined,
		signal: AbortSignal | undefined,
	) => Promise<ServiceToolResult<TData>>;
	formatResultText?: (result: ServiceToolResult<TData>) => string;
}

export function createServiceToolDefinition<TParams extends TSchema, TData = unknown>(
	options: CreateServiceToolDefinitionOptions<TParams, TData>,
): ToolDefinition<TParams, ServiceToolResult<TData>> {
	return {
		name: options.name,
		label: options.label ?? options.name,
		description: options.description,
		promptSnippet: options.promptSnippet,
		promptGuidelines: options.promptGuidelines,
		parameters: options.parameters,
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const result = createServiceToolResult(await options.execute(params, ctx, signal));
			const formatResultText = options.formatResultText ?? defaultFormatServiceToolResult;
			return {
				content: [{ type: "text", text: formatResultText(result) }],
				details: result,
			};
		},
	};
}

export function createServiceTool<TParams extends TSchema, TData = unknown>(
	options: CreateServiceToolDefinitionOptions<TParams, TData>,
): AgentTool<TParams, ServiceToolResult<TData>> {
	return wrapToolDefinition(createServiceToolDefinition(options));
}

function defaultFormatServiceToolResult(result: ServiceToolResult<unknown>): string {
	const sections: string[] = [];

	if (result.ok) {
		if (typeof result.data === "string" && result.data.trim()) {
			sections.push(result.data.trim());
		} else if (result.data !== undefined) {
			sections.push(formatData(result.data));
		} else {
			sections.push("Request completed.");
		}
	} else {
		sections.push(result.error?.trim() ? `Request failed: ${result.error.trim()}` : "Request failed.");
	}

	if (result.citations && result.citations.length > 0) {
		sections.push(`Sources: ${result.citations.join(", ")}`);
	}

	if (result.handoffSuggested) {
		sections.push(
			result.handoffReason?.trim()
				? `Escalation suggested: ${result.handoffReason.trim()}`
				: "Escalation suggested.",
		);
	}

	return sections.join("\n\n");
}

function formatData(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "number" || typeof value === "boolean" || value === null) {
		return String(value);
	}
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}
