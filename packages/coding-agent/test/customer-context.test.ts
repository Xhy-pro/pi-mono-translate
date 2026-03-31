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

describe("customer context injection", () => {
	test("injects hidden customer context before the user message", async () => {
		const harness = createHarness({
			settings: {
				serviceMode: "customer-support",
				skillPolicy: "required",
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
allowed-tools:
  - read
---
Tell the user the refund steps and ask for the order number if it is missing.
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
			});

			let resolverCallCount = 0;
			let lastSelectedSkills: string[] = [];
			const routedHarness = createHarness({
				settings: {
					serviceMode: "customer-support",
					skillPolicy: "required",
					defaultToolProfile: "service",
				},
				resourceLoader: createResourceLoaderWithSkills([skill]),
				customerContextResolver: ({ selectedSkills, userInput }) => {
					resolverCallCount++;
					lastSelectedSkills = selectedSkills.map((item) => item.name);
					expect(userInput).toBe("I want a refund for my last order.");
					return [
						{
							customType: "customer_context",
							source: "crm",
							fetchedAt: Date.UTC(2026, 2, 30, 8, 0, 0),
							context: {
								customerId: "cust_123",
								accountTier: "gold",
								recentOrders: [{ id: "ord_456", status: "delivered", createdAt: "2026-03-28" }],
								knowledgeSummary: ["Customer already uploaded proof of damage."],
							},
						} satisfies CustomerContextEnvelope,
					];
				},
			});

			try {
				await routedHarness.session.prompt("I want a refund for my last order.");

				expect(resolverCallCount).toBe(1);
				expect(lastSelectedSkills).toEqual(["refund-policy"]);
				expect(routedHarness.faux.callCount).toBe(1);

				const messages = routedHarness.session.state.messages;
				expect(messages.slice(-3).map((message) => message.role)).toEqual(["custom", "user", "assistant"]);

				const injectedMessage = messages[messages.length - 3];
				expect(injectedMessage.role).toBe("custom");
				if (injectedMessage.role === "custom") {
					expect(injectedMessage.customType).toBe("customer_context");
					expect(injectedMessage.display).toBe(false);
					expect(typeof injectedMessage.content).toBe("string");
					if (typeof injectedMessage.content === "string") {
						expect(injectedMessage.content).toContain("<customer_context>");
						expect(injectedMessage.content).toContain("Account tier: gold");
						expect(injectedMessage.content).toContain("ord_456: delivered");
					}
				}

				const sessionEntries = routedHarness.sessionManager.getEntries();
				const customEntry = sessionEntries.find((entry) => entry.type === "custom_message");
				expect(customEntry?.type).toBe("custom_message");
				if (customEntry?.type === "custom_message") {
					expect(customEntry.customType).toBe("customer_context");
					expect(customEntry.display).toBe(false);
				}
			} finally {
				routedHarness.cleanup();
			}
		} finally {
			harness.cleanup();
		}
	});

	test("ignores resolver failures and continues the turn", async () => {
		const harness = createHarness({
			settings: {
				serviceMode: "customer-support",
				skillPolicy: "required",
				defaultToolProfile: "service",
			},
		});

		try {
			const skillDir = join(harness.tempDir, "subscription-policy");
			mkdirSync(skillDir, { recursive: true });
			const skillPath = join(skillDir, "SKILL.md");
			writeFileSync(
				skillPath,
				`---
description: Handle subscription questions.
intents:
  - subscription
allowed-tools:
  - read
---
Handle subscription questions.
`,
				"utf-8",
			);

			const skill = createSkill({
				name: "subscription-policy",
				description: "Handle subscription questions.",
				filePath: skillPath,
				baseDir: skillDir,
				intents: ["subscription"],
				allowedTools: ["read"],
			});
			const routedHarness = createHarness({
				settings: {
					serviceMode: "customer-support",
					skillPolicy: "required",
					defaultToolProfile: "service",
				},
				resourceLoader: createResourceLoaderWithSkills([skill]),
				customerContextResolver: () => {
					throw new Error("CRM temporarily unavailable");
				},
			});

			try {
				await routedHarness.session.prompt("I need help with my subscription.");

				expect(routedHarness.faux.callCount).toBe(1);
				expect(routedHarness.session.state.messages.some((message) => message.role === "custom")).toBe(false);
			} finally {
				routedHarness.cleanup();
			}
		} finally {
			harness.cleanup();
		}
	});
});
