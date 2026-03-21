import type { JsonSchema, NormalizedEndpoint, NormalizedSpec } from "../parser/types.js";
import { logger } from "../utils/logger.js";
import type { ParameterMapping } from "./param-builder.js";
import { buildParams } from "./param-builder.js";
import { generateToolName, resolveCollisions } from "./tool-namer.js";

export interface GeneratedTool {
	name: string;
	description: string;
	inputSchema: JsonSchema;
	endpointRef: {
		method: string;
		path: string;
		baseUrl: string;
		contentType: string;
		parameterMap: ParameterMapping[];
	};
}

export interface GenerateOptions {
	baseUrl?: string;
	prefix?: string;
	include?: string[];
	exclude?: string[];
}

export interface GenerateResult {
	tools: GeneratedTool[];
	/** Map from tool name to its OpenAPI tags */
	tagMap: Map<string, string[]>;
}

export function generateTools(
	spec: NormalizedSpec,
	options: GenerateOptions = {},
): GeneratedTool[] {
	return generateToolsWithTags(spec, options).tools;
}

export function generateToolsWithTags(
	spec: NormalizedSpec,
	options: GenerateOptions = {},
): GenerateResult {
	const baseUrl =
		options.baseUrl ?? spec.servers[0]?.url ?? "http://localhost";

	let endpoints = spec.endpoints;

	// Apply include filter
	if (options.include?.length) {
		const patterns = options.include;
		endpoints = endpoints.filter(
			(ep) =>
				patterns.some((p) => matchPattern(ep.operationId, p)) ||
				patterns.some((p) => matchPattern(ep.path, p)),
		);
	}

	// Apply exclude filter
	if (options.exclude?.length) {
		const patterns = options.exclude;
		endpoints = endpoints.filter(
			(ep) =>
				!patterns.some((p) => matchPattern(ep.operationId, p)) &&
				!patterns.some((p) => matchPattern(ep.path, p)),
		);
	}

	// Generate raw names
	const rawNames = endpoints.map((ep) =>
		generateToolName(ep.operationId, ep.method, ep.path, options.prefix),
	);

	// Resolve collisions
	const names = resolveCollisions(rawNames);

	// Build tools and tag map
	const tagMap = new Map<string, string[]>();
	const tools: GeneratedTool[] = endpoints.map((endpoint, i) => {
		const { inputSchema, parameterMap } = buildParams(endpoint);
		const description = buildDescription(endpoint);
		const name = names[i];

		tagMap.set(name, endpoint.tags ?? []);

		return {
			name,
			description,
			inputSchema,
			endpointRef: {
				method: endpoint.method.toUpperCase(),
				path: endpoint.path,
				baseUrl: baseUrl.replace(/\/$/, ""),
				contentType:
					endpoint.requestBody?.contentType ?? "application/json",
				parameterMap,
			},
		};
	});

	logger.info(`Generated ${tools.length} MCP tools from ${spec.info.title}`);
	return { tools, tagMap };
}

function buildDescription(endpoint: NormalizedEndpoint): string {
	const parts: string[] = [];

	if (endpoint.summary) {
		parts.push(endpoint.summary);
	} else if (endpoint.description) {
		// Use first sentence of description
		const firstSentence = endpoint.description.split(/\.\s/)[0];
		parts.push(firstSentence.length < 200 ? firstSentence : firstSentence.slice(0, 200));
	}

	parts.push(`[${endpoint.method.toUpperCase()} ${endpoint.path}]`);

	if (endpoint.deprecated) {
		parts.push("(DEPRECATED)");
	}

	return parts.join(" ");
}

function matchPattern(value: string, pattern: string): boolean {
	if (pattern.includes("*")) {
		const regex = new RegExp(
			`^${pattern.replace(/\*/g, ".*").replace(/\//g, "\/")}$`,
		);
		return regex.test(value);
	}
	return value === pattern;
}
