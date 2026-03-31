import type { AssistantMessage, ToolResultMessage } from "@mariozechner/pi-ai";
import type { CustomerContextEnvelope } from "./customer-context.js";
import type { ServicePolicyDecision } from "./service-policy.js";
import type { SkillRouteResult } from "./skill-router.js";
import type { Skill } from "./skills.js";
import { isServiceToolResult } from "./tools/service/service-tool-result.js";

export interface CustomerSupportResponse {
	answer: string;
	nextAction: "reply" | "clarify" | "handoff";
	confidence: number;
	usedSkills: string[];
	usedContextTypes: string[];
	citations: string[];
	handoff: boolean;
	handoffReason?: string;
}

export interface BuildCustomerSupportResponseOptions {
	assistantMessage: AssistantMessage;
	route: SkillRouteResult;
	selectedSkills: Skill[];
	contextEnvelopes: CustomerContextEnvelope[];
	policyDecision: ServicePolicyDecision;
	toolResults?: ToolResultMessage[];
	additionalCitations?: string[];
}

export function buildCustomerSupportResponse(options: BuildCustomerSupportResponseOptions): CustomerSupportResponse {
	const citations = new Set<string>();
	for (const skill of options.selectedSkills) {
		for (const source of skill.kbSources ?? []) {
			const normalized = source.trim();
			if (normalized) {
				citations.add(normalized);
			}
		}
	}
	for (const envelope of options.contextEnvelopes) {
		const normalized = envelope.source.trim();
		if (normalized) {
			citations.add(normalized);
		}
	}
	const toolMetadata = extractServiceToolMetadata(options.toolResults ?? []);
	for (const citation of toolMetadata.citations) {
		const normalized = citation.trim();
		if (normalized) {
			citations.add(normalized);
		}
	}
	for (const citation of options.additionalCitations ?? []) {
		const normalized = citation.trim();
		if (normalized) {
			citations.add(normalized);
		}
	}

	const nextAction = resolveNextAction(options.policyDecision, toolMetadata.handoffSuggested);
	const handoff = nextAction === "handoff";

	return {
		answer: extractAssistantText(options.assistantMessage),
		nextAction,
		confidence: options.route.confidence,
		usedSkills: options.selectedSkills.map((skill) => skill.name),
		usedContextTypes: Array.from(
			new Set(options.contextEnvelopes.map((envelope) => envelope.customType ?? "customer_context")),
		),
		citations: Array.from(citations),
		handoff,
		handoffReason: handoff
			? (toolMetadata.handoffReason ?? options.policyDecision.reason ?? options.route.reason)
			: undefined,
	};
}

function resolveNextAction(
	policyDecision: ServicePolicyDecision,
	toolSuggestedHandoff: boolean,
): "reply" | "clarify" | "handoff" {
	if (toolSuggestedHandoff) {
		return "handoff";
	}
	if (policyDecision.action === "handoff") {
		return "handoff";
	}
	if (policyDecision.action === "clarify" || policyDecision.action === "reject") {
		return "clarify";
	}
	return "reply";
}

function extractAssistantText(message: AssistantMessage): string {
	return message.content
		.filter(
			(content): content is Extract<AssistantMessage["content"][number], { type: "text" }> =>
				content.type === "text",
		)
		.map((content) => content.text)
		.join("")
		.trim();
}

function extractServiceToolMetadata(toolResults: ToolResultMessage[]): {
	citations: string[];
	handoffSuggested: boolean;
	handoffReason?: string;
} {
	const citations = new Set<string>();
	let handoffSuggested = false;
	let handoffReason: string | undefined;

	for (const toolResult of toolResults) {
		if (!isServiceToolResult(toolResult.details)) {
			continue;
		}

		for (const citation of toolResult.details.citations ?? []) {
			const normalized = citation.trim();
			if (normalized) {
				citations.add(normalized);
			}
		}

		if (toolResult.details.handoffSuggested) {
			handoffSuggested = true;
			handoffReason ??= toolResult.details.handoffReason;
		}
	}

	return {
		citations: Array.from(citations),
		handoffSuggested,
		handoffReason,
	};
}
