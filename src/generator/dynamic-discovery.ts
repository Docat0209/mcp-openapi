import type { GeneratedTool } from "./tool-generator.js";
import { logger } from "../utils/logger.js";

const AUTO_THRESHOLD = 100;

export interface DiscoveryResult {
	metaTools: GeneratedTool[];
	allTools: GeneratedTool[];
	toolIndex: ToolIndex;
}

interface ToolIndex {
	byName: Map<string, GeneratedTool>;
	byTag: Map<string, GeneratedTool[]>;
	searchable: Array<{ name: string; description: string; tags: string[] }>;
}

/**
 * Determine if dynamic discovery should be active.
 */
export function shouldEnableDiscovery(
	explicitFlag: boolean | undefined,
	toolCount: number,
): boolean {
	if (explicitFlag === true) return true;
	if (explicitFlag === false) return false;
	return toolCount >= AUTO_THRESHOLD;
}

/**
 * Build the discovery index and meta-tools from all generated tools.
 */
export function buildDiscovery(
	tools: GeneratedTool[],
	tags: Map<string, string[]>,
): DiscoveryResult {
	const toolIndex = buildIndex(tools, tags);
	const metaTools = createMetaTools();

	logger.info(
		`Dynamic discovery enabled: ${tools.length} tools indexed, ${toolIndex.byTag.size} tags`,
	);

	return { metaTools, allTools: tools, toolIndex };
}

function buildIndex(
	tools: GeneratedTool[],
	tags: Map<string, string[]>,
): ToolIndex {
	const byName = new Map<string, GeneratedTool>();
	const byTag = new Map<string, GeneratedTool[]>();
	const searchable: Array<{ name: string; description: string; tags: string[] }> = [];

	for (const tool of tools) {
		byName.set(tool.name, tool);

		const toolTags = tags.get(tool.name) ?? [];
		for (const tag of toolTags) {
			const list = byTag.get(tag) ?? [];
			list.push(tool);
			byTag.set(tag, list);
		}

		searchable.push({
			name: tool.name,
			description: tool.description,
			tags: toolTags,
		});
	}

	return { byName, byTag, searchable };
}

function createMetaTools(): GeneratedTool[] {
	return [
		{
			name: "search_operations",
			description:
				"Search available API operations by keyword. Returns matching tool names and descriptions. Use this to discover what API endpoints are available before calling them.",
			inputSchema: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "Search keyword to match against operation names and descriptions",
					},
					limit: {
						type: "integer",
						description: "Max results to return (default: 20)",
					},
				},
				required: ["query"],
			},
			endpointRef: {
				method: "META",
				path: "/_discovery/search",
				baseUrl: "",
				contentType: "",
				parameterMap: [],
			},
		},
		{
			name: "list_by_tag",
			description:
				"List API operations grouped by their OpenAPI tag. Use this to browse available endpoints by category.",
			inputSchema: {
				type: "object",
				properties: {
					tag: {
						type: "string",
						description: "OpenAPI tag to filter by. Omit to list all available tags.",
					},
				},
			},
			endpointRef: {
				method: "META",
				path: "/_discovery/tags",
				baseUrl: "",
				contentType: "",
				parameterMap: [],
			},
		},
		{
			name: "get_tool_details",
			description:
				"Get the full schema and parameters for a specific API tool. Call this before invoking an API operation to understand its required parameters.",
			inputSchema: {
				type: "object",
				properties: {
					tool_name: {
						type: "string",
						description: "The exact tool name returned by search_operations or list_by_tag",
					},
				},
				required: ["tool_name"],
			},
			endpointRef: {
				method: "META",
				path: "/_discovery/details",
				baseUrl: "",
				contentType: "",
				parameterMap: [],
			},
		},
	];
}

/**
 * Handle a meta-tool call. Returns text content or null if not a meta-tool.
 */
export function handleMetaToolCall(
	toolName: string,
	args: Record<string, unknown>,
	index: ToolIndex,
): string | null {
	switch (toolName) {
		case "search_operations":
			return handleSearch(args, index);
		case "list_by_tag":
			return handleListByTag(args, index);
		case "get_tool_details":
			return handleGetDetails(args, index);
		default:
			return null;
	}
}

function handleSearch(
	args: Record<string, unknown>,
	index: ToolIndex,
): string {
	const query = String(args.query ?? "").toLowerCase();
	const limit = Number(args.limit) || 20;

	if (!query) {
		return JSON.stringify({ error: "query parameter is required" });
	}

	const results = index.searchable
		.filter(
			(entry) =>
				entry.name.toLowerCase().includes(query) ||
				entry.description.toLowerCase().includes(query) ||
				entry.tags.some((t) => t.toLowerCase().includes(query)),
		)
		.slice(0, limit)
		.map((entry) => ({
			name: entry.name,
			description: entry.description,
			tags: entry.tags,
		}));

	return JSON.stringify({
		query,
		total: results.length,
		results,
	});
}

function handleListByTag(
	args: Record<string, unknown>,
	index: ToolIndex,
): string {
	const tag = args.tag as string | undefined;

	if (!tag) {
		// List all available tags with counts
		const tags: Record<string, number> = {};
		for (const [tagName, tools] of index.byTag) {
			tags[tagName] = tools.length;
		}
		return JSON.stringify({ tags });
	}

	// Find matching tag (case-insensitive)
	const matchKey = [...index.byTag.keys()].find(
		(k) => k.toLowerCase() === tag.toLowerCase(),
	);

	if (!matchKey) {
		return JSON.stringify({
			error: `Tag "${tag}" not found`,
			available_tags: [...index.byTag.keys()],
		});
	}

	const tools = index.byTag.get(matchKey)!;
	return JSON.stringify({
		tag: matchKey,
		total: tools.length,
		tools: tools.map((t) => ({ name: t.name, description: t.description })),
	});
}

function handleGetDetails(
	args: Record<string, unknown>,
	index: ToolIndex,
): string {
	const name = String(args.tool_name ?? "");
	const tool = index.byName.get(name);

	if (!tool) {
		// Suggest similar names
		const suggestions = index.searchable
			.filter((e) => e.name.includes(name) || name.includes(e.name))
			.slice(0, 5)
			.map((e) => e.name);

		return JSON.stringify({
			error: `Tool "${name}" not found`,
			suggestions: suggestions.length > 0 ? suggestions : undefined,
		});
	}

	return JSON.stringify({
		name: tool.name,
		description: tool.description,
		inputSchema: tool.inputSchema,
		endpoint: {
			method: tool.endpointRef.method,
			path: tool.endpointRef.path,
		},
	});
}
