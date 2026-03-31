import type { HandoffPolicy } from "./service-policy.js";
import type { SkillRouteResult } from "./skill-router.js";
import type { Skill } from "./skills.js";

export interface EvaluateHandoffOptions {
	route: SkillRouteResult;
	selectedSkills: Skill[];
	handoffPolicy: HandoffPolicy;
	userInput: string;
	repeatedClarifyCount?: number;
	toolSuggestedHandoff?: boolean;
	toolHandoffReason?: string;
	lowConfidenceThreshold?: number;
}

export interface HandoffDecision {
	handoff: boolean;
	reason?: string;
	message?: string;
}

const DEFAULT_HANDOFF_MESSAGE =
	"I can only answer using the configured customer support skills, and this request should continue with a human agent.";

export function evaluateHandoffPolicy(options: EvaluateHandoffOptions): HandoffDecision {
	const {
		route,
		selectedSkills,
		handoffPolicy,
		userInput,
		repeatedClarifyCount = 0,
		toolSuggestedHandoff = false,
		toolHandoffReason,
		lowConfidenceThreshold = 0.35,
	} = options;

	if (toolSuggestedHandoff) {
		return {
			handoff: true,
			reason: toolHandoffReason ?? "tool_requested_handoff",
			message: DEFAULT_HANDOFF_MESSAGE,
		};
	}

	const skillRuleMatch = findMatchedSkillHandoffRule(selectedSkills, userInput);
	if (skillRuleMatch) {
		return {
			handoff: true,
			reason: `skill_handoff:${skillRuleMatch.skillName}:${skillRuleMatch.rule}`,
			message: DEFAULT_HANDOFF_MESSAGE,
		};
	}

	if (repeatedClarifyCount >= 2 && handoffPolicy !== "manual") {
		return {
			handoff: true,
			reason: "repeated_clarify_limit",
			message: DEFAULT_HANDOFF_MESSAGE,
		};
	}

	if (route.skills.length === 0 && handoffPolicy === "auto-on-no-skill") {
		return {
			handoff: true,
			reason: route.reason ?? "no_skill_match",
			message: DEFAULT_HANDOFF_MESSAGE,
		};
	}

	if (handoffPolicy === "auto-on-low-confidence" && route.confidence < lowConfidenceThreshold) {
		return {
			handoff: true,
			reason: route.reason ?? "low_skill_confidence",
			message: DEFAULT_HANDOFF_MESSAGE,
		};
	}

	return { handoff: false };
}

function findMatchedSkillHandoffRule(
	skills: Skill[],
	userInput: string,
): { skillName: string; rule: string } | undefined {
	const normalizedInput = normalizeText(userInput);
	if (!normalizedInput) {
		return undefined;
	}

	for (const skill of skills) {
		for (const rule of skill.handoffWhen ?? []) {
			const normalizedRule = normalizeText(rule);
			if (normalizedRule && normalizedInput.includes(normalizedRule)) {
				return { skillName: skill.name, rule };
			}
		}
	}

	return undefined;
}

function normalizeText(value: string): string {
	return value.toLowerCase().replace(/\s+/g, " ").trim();
}
