import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseArgs } from "../src/cli/args.js";
import type { ResourceLoader } from "../src/core/resource-loader.js";
import { loadSkillsFromDir, type Skill } from "../src/core/skills.js";
import { createSyntheticSourceInfo } from "../src/core/source-info.js";
import { buildSystemPrompt } from "../src/core/system-prompt.js";
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

describe("customer support mode", () => {
	test("parses customer support CLI flags", () => {
		const parsed = parseArgs([
			"--service-mode",
			"customer-support",
			"--skill-policy",
			"required",
			"--tool-profile",
			"service",
			"--response-format",
			"json",
			"--handoff-policy",
			"auto-on-no-skill",
		]);

		expect(parsed.serviceMode).toBe("customer-support");
		expect(parsed.skillPolicy).toBe("required");
		expect(parsed.toolProfile).toBe("service");
		expect(parsed.responseFormat).toBe("json");
		expect(parsed.handoffPolicy).toBe("auto-on-no-skill");
	});

	test("loads extended skill metadata from frontmatter", () => {
		const tempDir = join(tmpdir(), `pi-skill-metadata-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		const skillDir = join(tempDir, "refund-policy");
		mkdirSync(skillDir, { recursive: true });
		try {
			writeFileSync(
				join(skillDir, "SKILL.md"),
				`---
description: Handle refund requests.
intents:
  - refund
  - return money
examples:
  - I need a refund
priority: 5
allowed-tools:
  - read
required-context:
  - order_id
response-style: strict
fallback-message: Ask for the order ID first.
handoff-when:
  - legal threat
kb-sources:
  - refunds.md
---
Refund policy body
`,
				"utf-8",
			);

			const result = loadSkillsFromDir({ dir: skillDir, source: "test" });
			expect(result.skills).toHaveLength(1);
			expect(result.skills[0].intents).toEqual(["refund", "return money"]);
			expect(result.skills[0].allowedTools).toEqual(["read"]);
			expect(result.skills[0].requiredContext).toEqual(["order_id"]);
			expect(result.skills[0].responseStyle).toBe("strict");
			expect(result.skills[0].fallbackMessage).toBe("Ask for the order ID first.");
			expect(result.skills[0].handoffWhen).toEqual(["legal threat"]);
			expect(result.skills[0].kbSources).toEqual(["refunds.md"]);
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	test("builds a customer support prompt profile", () => {
		const prompt = buildSystemPrompt({
			profile: "customer-support",
			selectedTools: ["read"],
			toolSnippets: { read: "Read knowledge base files" },
			skills: [],
			contextFiles: [],
		});

		expect(prompt).toContain("You are a customer support agent operating inside pi.");
		expect(prompt).not.toContain("You are an expert coding assistant");
		expect(prompt).toContain("Treat injected <skill> blocks as the authoritative instructions");
	});

	test("short-circuits when skill policy is required and no skill matches", async () => {
		const harness = createHarness({
			settings: {
				serviceMode: "customer-support",
				skillPolicy: "required",
			},
			resourceLoader: createResourceLoaderWithSkills([]),
		});

		try {
			await harness.session.prompt("How can I update my subscription?");

			expect(harness.faux.callCount).toBe(0);
			const lastMessage = harness.session.state.messages[harness.session.state.messages.length - 1];
			expect(lastMessage?.role).toBe("assistant");
			if (lastMessage?.role === "assistant") {
				const text = lastMessage.content
					.filter((content): content is { type: "text"; text: string } => content.type === "text")
					.map((content) => content.text)
					.join("");
				expect(text).toContain("configured customer support skills");
			}
		} finally {
			harness.cleanup();
		}
	});

	test("injects the matched skill and narrows tools in customer support mode", async () => {
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
			const resourceLoader = createResourceLoaderWithSkills([skill]);
			const routedHarness = createHarness({
				settings: {
					serviceMode: "customer-support",
					skillPolicy: "required",
					defaultToolProfile: "service",
				},
				resourceLoader,
			});

			try {
				await routedHarness.session.prompt("I want a refund for my last order.");

				expect(routedHarness.faux.callCount).toBe(1);
				expect(routedHarness.session.getActiveToolNames()).toEqual(["read"]);
				const messages = routedHarness.session.state.messages;
				const lastUserMessage = messages[messages.length - 2];
				expect(lastUserMessage.role).toBe("user");
				if (lastUserMessage.role === "user") {
					const userText = Array.isArray(lastUserMessage.content)
						? lastUserMessage.content
								.filter((content): content is { type: "text"; text: string } => content.type === "text")
								.map((content) => content.text)
								.join("")
						: lastUserMessage.content;
					expect(userText).toContain('<skill name="refund-policy"');
					expect(userText).toContain("Tell the user the refund steps");
				}
			} finally {
				routedHarness.cleanup();
			}
		} finally {
			harness.cleanup();
		}
	});
});
