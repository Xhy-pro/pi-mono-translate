import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "@sinclair/typebox";
import { describe, expect, test } from "vitest";
import type { ResourceLoader } from "../src/core/resource-loader.js";
import type { Skill } from "../src/core/skills.js";
import { createSyntheticSourceInfo } from "../src/core/source-info.js";
import { createServiceToolDefinition, createServiceToolResult } from "../src/core/tools/index.js";
import { createHarness } from "./test-harness.js";
import { createTestResourceLoader } from "./utilities.js";

function createSkill(options: {
	name: string;
	description: string;
	filePath: string;
	baseDir: string;
	intents?: string[];
	allowedTools?: string[];
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
	};
}

function createResourceLoaderWithSkills(skills: Skill[]): ResourceLoader {
	const base = createTestResourceLoader();
	return {
		...base,
		getSkills: () => ({ skills, diagnostics: [] }),
	};
}

describe("customer support service tools", () => {
	test("allows skill-scoped custom service tools and carries citations into the structured response", async () => {
		const harness = createHarness({
			settings: {
				serviceMode: "customer-support",
				skillPolicy: "required",
				defaultToolProfile: "service",
				responseFormat: "json",
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
allowed-tools:
  - search_kb
---
Use the knowledge base tool for refund questions.
`,
				"utf-8",
			);

			const searchKbTool = createServiceToolDefinition({
				name: "search_kb",
				label: "search_kb",
				description: "Search the refund knowledge base.",
				promptSnippet: "Search refund policies in the knowledge base",
				parameters: Type.Object({
					query: Type.String({ description: "Customer question to look up" }),
				}),
				async execute({ query }) {
					return createServiceToolResult({
						ok: true,
						data: `Knowledge base answer for: ${query}`,
						citations: ["kb://refund-policy"],
					});
				},
			});

			const skill = createSkill({
				name: "refund-policy",
				description: "Handle refund questions.",
				filePath: skillPath,
				baseDir: skillDir,
				intents: ["refund"],
				allowedTools: ["search_kb"],
			});

			const routedHarness = createHarness({
				settings: {
					serviceMode: "customer-support",
					skillPolicy: "required",
					defaultToolProfile: "service",
					responseFormat: "json",
				},
				resourceLoader: createResourceLoaderWithSkills([skill]),
				customTools: [searchKbTool],
				responses: [
					{
						toolCalls: [{ name: "search_kb", args: { query: "refund request" } }],
					},
					"Your refund will arrive in 3 to 5 business days.",
				],
			});

			try {
				await routedHarness.session.prompt("I need a refund for my order.");

				expect(routedHarness.faux.callCount).toBe(2);
				expect(routedHarness.session.getActiveToolNames()).toEqual(["search_kb"]);
				const response = routedHarness.session.getLastCustomerSupportResponse();
				expect(response).toBeDefined();
				expect(response?.answer).toBe("Your refund will arrive in 3 to 5 business days.");
				expect(response?.nextAction).toBe("reply");
				expect(response?.citations).toEqual(expect.arrayContaining(["kb://refund-policy"]));
			} finally {
				routedHarness.cleanup();
			}
		} finally {
			harness.cleanup();
		}
	});

	test("marks the structured response for handoff when a service tool suggests escalation", async () => {
		const harness = createHarness({
			settings: {
				serviceMode: "customer-support",
				skillPolicy: "required",
				defaultToolProfile: "service",
				responseFormat: "json",
			},
		});

		try {
			const skillDir = join(harness.tempDir, "account-policy");
			mkdirSync(skillDir, { recursive: true });
			const skillPath = join(skillDir, "SKILL.md");
			writeFileSync(
				skillPath,
				`---
description: Handle account escalation questions.
intents:
  - account
allowed-tools:
  - get_account_case
---
Use the account case service for complex account issues.
`,
				"utf-8",
			);

			const getAccountCaseTool = createServiceToolDefinition({
				name: "get_account_case",
				label: "get_account_case",
				description: "Look up account escalation status.",
				parameters: Type.Object({
					caseId: Type.String({ description: "Customer case identifier" }),
				}),
				async execute() {
					return createServiceToolResult({
						ok: true,
						data: { status: "needs-specialist" },
						citations: ["crm://case/123"],
						handoffSuggested: true,
						handoffReason: "specialist_review_required",
					});
				},
			});

			const skill = createSkill({
				name: "account-policy",
				description: "Handle account escalation questions.",
				filePath: skillPath,
				baseDir: skillDir,
				intents: ["account"],
				allowedTools: ["get_account_case"],
			});

			const routedHarness = createHarness({
				settings: {
					serviceMode: "customer-support",
					skillPolicy: "required",
					defaultToolProfile: "service",
					responseFormat: "json",
				},
				resourceLoader: createResourceLoaderWithSkills([skill]),
				customTools: [getAccountCaseTool],
				responses: [
					{
						toolCalls: [{ name: "get_account_case", args: { caseId: "case_123" } }],
					},
					"I am transferring you to a specialist for this account issue.",
				],
			});

			try {
				await routedHarness.session.prompt("I need help with my account issue.");

				expect(routedHarness.faux.callCount).toBe(2);
				const response = routedHarness.session.getLastCustomerSupportResponse();
				expect(response).toBeDefined();
				expect(response?.nextAction).toBe("handoff");
				expect(response?.handoff).toBe(true);
				expect(response?.handoffReason).toBe("specialist_review_required");
				expect(response?.citations).toEqual(expect.arrayContaining(["crm://case/123"]));
			} finally {
				routedHarness.cleanup();
			}
		} finally {
			harness.cleanup();
		}
	});
});
