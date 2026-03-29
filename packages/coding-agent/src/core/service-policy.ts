import type { SkillRouteResult } from "./skill-router.js";

export type ServiceMode = "off" | "customer-support";
export type SkillPolicy = "off" | "prefer" | "required";
export type ToolProfile = "coding" | "readonly" | "service";
export type ResponseFormat = "text" | "json";
export type HandoffPolicy = "manual" | "auto-on-no-skill" | "auto-on-low-confidence";

export interface ServicePolicyDecision {
	action: "continue" | "clarify" | "reject" | "handoff";
	reason?: string;
	message?: string;
}

export interface EvaluateServicePolicyOptions {
	route: SkillRouteResult;
	skillPolicy: SkillPolicy;
	handoffPolicy: HandoffPolicy;
}

const DEFAULT_CLARIFICATION_MESSAGE =
	"I can only answer using the configured customer support skills. Please rephrase your question with more specific product or policy details, or ask for a human agent.";

const DEFAULT_HANDOFF_MESSAGE =
	"I can only answer using the configured customer support skills, and I could not match your request to an approved skill. Please continue with a human agent.";

export function evaluateServicePolicy(options: EvaluateServicePolicyOptions): ServicePolicyDecision {
	const { route, skillPolicy, handoffPolicy } = options;

	if (skillPolicy === "off") {
		return { action: "continue" };
	}

	if (route.skills.length === 0) {
		if (skillPolicy === "prefer") {
			return { action: "continue", reason: route.reason ?? "no_skill_match" };
		}

		if (handoffPolicy === "auto-on-no-skill") {
			return {
				action: "handoff",
				reason: route.reason ?? "no_skill_match",
				message: DEFAULT_HANDOFF_MESSAGE,
			};
		}

		return {
			action: "clarify",
			reason: route.reason ?? "no_skill_match",
			message: DEFAULT_CLARIFICATION_MESSAGE,
		};
	}

	if (handoffPolicy === "auto-on-low-confidence" && route.confidence < 0.35) {
		return {
			action: "handoff",
			reason: route.reason ?? "low_skill_confidence",
			message: DEFAULT_HANDOFF_MESSAGE,
		};
	}

	return { action: "continue" };
}
