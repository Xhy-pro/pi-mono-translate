import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { CustomerContextEnvelope } from "../src/core/customer-context.js";
import type { ResourceLoader } from "../src/core/resource-loader.js";
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
	kbSources?: string[];
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
		kbSources: options.kbSources,
	};
}

function createResourceLoaderWithSkills(skills: Skill[]): ResourceLoader {
	const base = createTestResourceLoader();
	return {
		...base,
		getSkills: () => ({ skills, diagnostics: [] }),
	};
}

describe("customer support response", () => {
	test("captures structured response metadata for a matched customer-support turn", async () => {
		const harness = createHarness({
			settings: {
				serviceMode: "customer-support",
				skillPolicy: "required",
				defaultToolProfile: "service",
				responseFormat: "json",
			},
			responses: ["Your refund request has been approved."],
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
allowed-tools:
  - read
kb-sources:
  - refunds.md
---
Handle refund questions.
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
				kbSources: ["refunds.md"],
			});

			const routedHarness = createHarness({
				settings: {
					serviceMode: "customer-support",
					skillPolicy: "required",
					defaultToolProfile: "service",
					responseFormat: "json",
				},
				resourceLoader: createResourceLoaderWithSkills([skill]),
				responses: ["Your refund request has been approved."],
				customerContextResolver: () => [
					{
						customType: "customer_context",
						source: "crm",
						fetchedAt: Date.UTC(2026, 2, 30, 8, 0, 0),
						context: {
							customerId: "cust_123",
							accountTier: "gold",
						},
					} satisfies CustomerContextEnvelope,
				],
			});

			try {
				await routedHarness.session.prompt("I want a refund for my order.");

				const response = routedHarness.session.getLastCustomerSupportResponse();
				expect(response).toBeDefined();
				expect(response?.answer).toBe("Your refund request has been approved.");
				expect(response?.nextAction).toBe("reply");
				expect(response?.handoff).toBe(false);
				expect(response?.usedSkills).toEqual(["refund-policy"]);
				expect(response?.usedContextTypes).toEqual(["customer_context"]);
				expect(response?.citations).toEqual(expect.arrayContaining(["refunds.md", "crm"]));
				expect(response?.confidence).toBeGreaterThan(0);

				const responseEvents = routedHarness.eventsOfType("customer_support_response");
				expect(responseEvents).toHaveLength(1);
				expect(responseEvents[0].response.answer).toBe("Your refund request has been approved.");
			} finally {
				routedHarness.cleanup();
			}
		} finally {
			harness.cleanup();
		}
	});

	test("captures structured clarify response when no skill matches", async () => {
		const harness = createHarness({
			settings: {
				serviceMode: "customer-support",
				skillPolicy: "required",
				responseFormat: "json",
			},
			resourceLoader: createResourceLoaderWithSkills([]),
		});

		try {
			await harness.session.prompt("Can you help me with payroll taxes?");

			expect(harness.faux.callCount).toBe(0);
			const response = harness.session.getLastCustomerSupportResponse();
			expect(response).toBeDefined();
			expect(response?.nextAction).toBe("clarify");
			expect(response?.handoff).toBe(false);
			expect(response?.usedSkills).toEqual([]);
			expect(response?.answer).toContain("configured customer support skills");

			const responseEvents = harness.eventsOfType("customer_support_response");
			expect(responseEvents).toHaveLength(1);
			expect(responseEvents[0].response.nextAction).toBe("clarify");
		} finally {
			harness.cleanup();
		}
	});
});
