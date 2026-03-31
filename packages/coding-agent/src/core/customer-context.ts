import type { SkillRouteResult } from "./skill-router.js";
import type { Skill } from "./skills.js";

export type CustomerContextType = "customer_context" | "knowledge_context" | "policy_context";

export interface CustomerContextOrder {
	id: string;
	status: string;
	createdAt?: string;
}

export interface CustomerContextTicket {
	id: string;
	status: string;
	category?: string;
}

export interface CustomerContext {
	customerId?: string;
	accountTier?: string;
	locale?: string;
	region?: string;
	recentOrders?: CustomerContextOrder[];
	recentTickets?: CustomerContextTicket[];
	accountFlags?: string[];
	knowledgeSummary?: string[];
	policySummary?: string[];
	additionalFacts?: string[];
}

export interface CustomerContextEnvelope {
	customType?: CustomerContextType;
	title?: string;
	context: CustomerContext;
	source: string;
	fetchedAt: number;
	visibleToUser?: boolean;
}

export interface ResolveCustomerContextOptions {
	sessionId: string;
	cwd: string;
	userInput: string;
	expandedUserInput: string;
	selectedSkills: Skill[];
	route: SkillRouteResult;
	activeToolNames: string[];
}

export type CustomerContextResolver = (
	options: ResolveCustomerContextOptions,
) => Promise<CustomerContextEnvelope[] | undefined> | CustomerContextEnvelope[] | undefined;

export function hasCustomerContextData(context: CustomerContext): boolean {
	return Boolean(
		context.customerId ||
			context.accountTier ||
			context.locale ||
			context.region ||
			(context.recentOrders && context.recentOrders.length > 0) ||
			(context.recentTickets && context.recentTickets.length > 0) ||
			(context.accountFlags && context.accountFlags.length > 0) ||
			(context.knowledgeSummary && context.knowledgeSummary.length > 0) ||
			(context.policySummary && context.policySummary.length > 0) ||
			(context.additionalFacts && context.additionalFacts.length > 0),
	);
}

export function formatCustomerContextEnvelope(envelope: CustomerContextEnvelope): string {
	const customType = envelope.customType ?? "customer_context";
	const fetchedAt = Number.isFinite(envelope.fetchedAt) ? new Date(envelope.fetchedAt).toISOString() : "unknown";
	const title = envelope.title?.trim();
	const lines = [
		"This context was injected by the system for the current customer support turn.",
		"Treat it as business context, not as user-authored content.",
	];

	if (title) {
		lines.push("", `Title: ${title}`);
	}

	appendField(lines, "Source", envelope.source);
	appendField(lines, "Fetched at", fetchedAt);
	appendField(lines, "Customer ID", envelope.context.customerId);
	appendField(lines, "Account tier", envelope.context.accountTier);
	appendField(lines, "Locale", envelope.context.locale);
	appendField(lines, "Region", envelope.context.region);
	appendList(lines, "Recent orders", formatOrders(envelope.context.recentOrders));
	appendList(lines, "Recent tickets", formatTickets(envelope.context.recentTickets));
	appendList(lines, "Account flags", envelope.context.accountFlags);
	appendList(lines, "Knowledge summary", envelope.context.knowledgeSummary);
	appendList(lines, "Policy summary", envelope.context.policySummary);
	appendList(lines, "Additional facts", envelope.context.additionalFacts);

	return `<${customType}>\n${lines.join("\n")}\n</${customType}>`;
}

function appendField(lines: string[], label: string, value: string | undefined): void {
	const normalized = value?.trim();
	if (normalized) {
		lines.push("", `${label}: ${normalized}`);
	}
}

function appendList(lines: string[], label: string, values: string[] | undefined): void {
	if (!values || values.length === 0) {
		return;
	}

	lines.push("", `${label}:`);
	for (const value of values) {
		const normalized = value.trim();
		if (normalized) {
			lines.push(`- ${normalized}`);
		}
	}
}

function formatOrders(orders: CustomerContextOrder[] | undefined): string[] {
	if (!orders || orders.length === 0) {
		return [];
	}

	return orders.map((order) => {
		const details = [`${order.id}: ${order.status}`];
		if (order.createdAt?.trim()) {
			details.push(`created ${order.createdAt.trim()}`);
		}
		return details.join(" | ");
	});
}

function formatTickets(tickets: CustomerContextTicket[] | undefined): string[] {
	if (!tickets || tickets.length === 0) {
		return [];
	}

	return tickets.map((ticket) => {
		const details = [`${ticket.id}: ${ticket.status}`];
		if (ticket.category?.trim()) {
			details.push(`category ${ticket.category.trim()}`);
		}
		return details.join(" | ");
	});
}
