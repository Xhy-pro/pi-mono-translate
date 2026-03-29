import type { Skill } from "./skills.js";

export interface SkillRouteResult {
	action: "answer" | "clarify" | "handoff" | "reject";
	skills: Skill[];
	confidence: number;
	reason?: string;
}

export interface RouteSkillsOptions {
	text: string;
	skills: Skill[];
	maxSkills?: number;
}

export function routeSkills(options: RouteSkillsOptions): SkillRouteResult {
	const { text, skills, maxSkills = 3 } = options;
	const visibleSkills = skills.filter((skill) => !skill.disableModelInvocation);
	const normalizedText = normalizeText(text);
	const textTokens = tokenize(normalizedText);

	if (normalizedText.length === 0 || visibleSkills.length === 0) {
		return {
			action: "clarify",
			skills: [],
			confidence: 0,
			reason: visibleSkills.length === 0 ? "no_skills_available" : "empty_input",
		};
	}

	const scoredSkills = visibleSkills
		.map((skill) => ({ skill, score: scoreSkill(skill, normalizedText, textTokens) }))
		.filter((entry) => entry.score > 0)
		.sort((left, right) => {
			if (right.score !== left.score) {
				return right.score - left.score;
			}
			const rightPriority = right.skill.priority ?? 0;
			const leftPriority = left.skill.priority ?? 0;
			if (rightPriority !== leftPriority) {
				return rightPriority - leftPriority;
			}
			return left.skill.name.localeCompare(right.skill.name);
		});

	if (scoredSkills.length === 0) {
		return {
			action: "clarify",
			skills: [],
			confidence: 0,
			reason: "no_skill_match",
		};
	}

	const topScore = scoredSkills[0].score;
	const threshold = Math.max(12, topScore - 20);
	const selected = scoredSkills
		.filter((entry) => entry.score >= threshold)
		.slice(0, Math.max(1, maxSkills))
		.map((entry) => entry.skill);

	return {
		action: "answer",
		skills: selected,
		confidence: Math.min(1, topScore / 100),
	};
}

function scoreSkill(skill: Skill, normalizedText: string, textTokens: Set<string>): number {
	let score = 0;
	const normalizedName = normalizeText(skill.name);
	if (normalizedName.length > 0 && normalizedText.includes(normalizedName)) {
		score += 80;
	}

	score += scorePhraseList(skill.intents, normalizedText, textTokens, 35, 8);
	score += scorePhraseList(skill.examples, normalizedText, textTokens, 25, 5);
	score += scorePhraseList([skill.description], normalizedText, textTokens, 18, 4);

	if (typeof skill.priority === "number") {
		score += Math.max(0, Math.min(10, skill.priority));
	}

	return score;
}

function scorePhraseList(
	values: string[] | undefined,
	normalizedText: string,
	textTokens: Set<string>,
	exactBonus: number,
	overlapWeight: number,
): number {
	if (!values || values.length === 0) {
		return 0;
	}

	let total = 0;
	for (const value of values) {
		const normalizedValue = normalizeText(value);
		if (normalizedValue.length === 0) {
			continue;
		}

		if (normalizedText.includes(normalizedValue)) {
			total += exactBonus;
			continue;
		}

		const tokens = tokenize(normalizedValue);
		let overlaps = 0;
		for (const token of tokens) {
			if (textTokens.has(token)) {
				overlaps++;
			}
		}
		total += overlaps * overlapWeight;
	}

	return total;
}

function normalizeText(value: string): string {
	return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(value: string): Set<string> {
	return new Set(value.match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? []);
}
