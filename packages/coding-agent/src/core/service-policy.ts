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
}

const DEFAULT_CLARIFICATION_MESSAGE =
	"I can only answer using the configured customer support skills. Please rephrase your question with more specific product or policy details, or ask for a human agent.";

export function evaluateServicePolicy(options: EvaluateServicePolicyOptions): ServicePolicyDecision {
	const { route, skillPolicy } = options;

	if (skillPolicy === "off") {
		return { action: "continue" };
	}

	if (route.skills.length === 0) {
		if (skillPolicy === "prefer") {
			return { action: "continue", reason: route.reason ?? "no_skill_match" };
		}

		return {
			action: "clarify",
			reason: route.reason ?? "no_skill_match",
			message: DEFAULT_CLARIFICATION_MESSAGE,
		};
	}

	return { action: "continue" };
}
