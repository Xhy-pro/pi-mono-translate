import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { evaluateHandoffPolicy } from "../src/core/handoff-policy.js";
import type { ResourceLoader } from "../src/core/resource-loader.js";
import type { SkillRouteResult } from "../src/core/skill-router.js";
import type { Skill } from "../src/core/skills.js";
import { createSyntheticSourceInfo } from "../src/core/source-info.js";
import { createHarness } from "./test-harness.js";
import { createTestResourceLoader } from "./utilities.js";

function createSkill(options: {
	name: string;
	description: string;
	filePath: string;
	baseDir: string;
	intents?: string[];
	allowedTools?: string[];
	handoffWhen?: string[];
}): Skill {
	return {
		name: options.name,
		description: options.description,
		filePath: options.filePath,
		baseDir: options.baseDir,
		sourceInfo: createSyntheticSourceInfo(options.filePath, { source: "test" }),
		disableModelInvocation: false,
		intents: options.intents,
		allowedTools: options.allowedTools,
		handoffWhen: options.handoffWhen,
	};
}

function createResourceLoaderWithSkills(skills: Skill[]): ResourceLoader {
	const base = createTestResourceLoader();
	return {
		...base,
		getSkills: () => ({ skills, diagnostics: [] }),
	};
}

describe("customer support handoff policy", () => {
	test("short-circuits to handoff when no skill matches and auto-on-no-skill is enabled", async () => {
		const harness = createHarness({
			settings: {
				serviceMode: "customer-support",
				skillPolicy: "required",
				handoffPolicy: "auto-on-no-skill",
				responseFormat: "json",
			},
			resourceLoader: createResourceLoaderWithSkills([]),
		});

		try {
			await harness.session.prompt("Can you help me with payroll taxes?");

			expect(harness.faux.callCount).toBe(0);
			const response = harness.session.getLastCustomerSupportResponse();
			expect(response).toBeDefined();
			expect(response?.nextAction).toBe("handoff");
			expect(response?.handoff).toBe(true);
			expect(response?.usedSkills).toEqual([]);
			expect(response?.answer).toContain("human agent");
		} finally {
			harness.cleanup();
		}
	});

	test("short-circuits to handoff when a matched skill requests escalation", async () => {
		const harness = createHarness({
			settings: {
				serviceMode: "customer-support",
				skillPolicy: "required",
				handoffPolicy: "manual",
				defaultToolProfile: "service",
			},
		});

		try {
			const skillDir = join(harness.tempDir, "refund-policy");
			mkdirSync(skillDir, { recursive: true });
			const skillPath = join(skillDir, "SKILL.md");
			writeFileSync(
				skillPath,
				`---
description: Handle refund questions.
intents:
  - refund
handoff-when:
  - lawyer
allowed-tools:
  - read
---
Escalate refund questions involving legal threats or lawyers.
`,
				"utf-8",
			);

			const skill = createSkill({
				name: "refund-policy",
				description: "Handle refund questions.",
				filePath: skillPath,
				baseDir: skillDir,
				intents: ["refund"],
				allowedTools: ["read"],
				handoffWhen: ["lawyer"],
			});
			const routedHarness = createHarness({
				settings: {
					serviceMode: "customer-support",
					skillPolicy: "required",
					handoffPolicy: "manual",
					defaultToolProfile: "service",
				},
				resourceLoader: createResourceLoaderWithSkills([skill]),
			});

			try {
				await routedHarness.session.prompt("I want a refund and my lawyer will contact you.");

				expect(routedHarness.faux.callCount).toBe(0);
				const response = routedHarness.session.getLastCustomerSupportResponse();
				expect(response).toBeDefined();
				expect(response?.nextAction).toBe("handoff");
				expect(response?.handoff).toBe(true);
				expect(response?.usedSkills).toEqual(["refund-policy"]);
				expect(response?.handoffReason).toContain("skill_handoff:refund-policy:lawyer");
			} finally {
				routedHarness.cleanup();
			}
		} finally {
			harness.cleanup();
		}
	});

	test("short-circuits to handoff when route confidence is below the configured threshold", async () => {
		const harness = createHarness({
			settings: {
				serviceMode: "customer-support",
				skillPolicy: "required",
				handoffPolicy: "auto-on-low-confidence",
				defaultToolProfile: "service",
			},
		});

		try {
			const skillDir = join(harness.tempDir, "billing-policy");
			mkdirSync(skillDir, { recursive: true });
			const skillPath = join(skillDir, "SKILL.md");
			writeFileSync(
				skillPath,
				`---
description: billing
allowed-tools:
  - read
---
Handle billing questions.
`,
				"utf-8",
			);

			const skill = createSkill({
				name: "billing-policy",
				description: "billing",
				filePath: skillPath,
				baseDir: skillDir,
				allowedTools: ["read"],
			});
			const routedHarness = createHarness({
				settings: {
					serviceMode: "customer-support",
					skillPolicy: "required",
					handoffPolicy: "auto-on-low-confidence",
					defaultToolProfile: "service",
				},
				resourceLoader: createResourceLoaderWithSkills([skill]),
			});

			try {
				await routedHarness.session.prompt("billing");

				expect(routedHarness.faux.callCount).toBe(0);
				const response = routedHarness.session.getLastCustomerSupportResponse();
				expect(response).toBeDefined();
				expect(response?.nextAction).toBe("handoff");
				expect(response?.handoff).toBe(true);
				expect(response?.usedSkills).toEqual(["billing-policy"]);
				expect(response?.confidence).toBeLessThan(0.35);
			} finally {
				routedHarness.cleanup();
			}
		} finally {
			harness.cleanup();
		}
	});

	test("recommends handoff after repeated clarifications when auto escalation is enabled", () => {
		const route: SkillRouteResult = {
			action: "answer",
			skills: [],
			confidence: 0.9,
		};

		const decision = evaluateHandoffPolicy({
			route,
			selectedSkills: [],
			handoffPolicy: "auto-on-low-confidence",
			userInput: "Where is my order?",
			repeatedClarifyCount: 2,
		});

		expect(decision.handoff).toBe(true);
		expect(decision.reason).toBe("repeated_clarify_limit");
		expect(decision.message).toContain("human agent");
	});
});
