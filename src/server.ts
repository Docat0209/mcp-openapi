import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createAuthProvider } from "./auth/index.js";
import type { McpOpenApiConfig } from "./config/types.js";
import { DEFAULT_CONFIG } from "./config/types.js";
import { buildRequest } from "./executor/request-builder.js";
import { executeRequest } from "./executor/http-client.js";
import { mapResponse } from "./executor/response-mapper.js";
import { generateTools } from "./generator/tool-generator.js";
import type { GeneratedTool } from "./generator/tool-generator.js";
import { parseSpec } from "./parser/openapi-parser.js";
import { logger } from "./utils/logger.js";

export async function createServer(config: McpOpenApiConfig) {
	const mergedConfig = { ...DEFAULT_CONFIG, ...config };

	// Parse the OpenAPI spec
	const spec = await parseSpec(config.spec);

	// Generate MCP tools
	const tools = generateTools(spec, {
		baseUrl: mergedConfig.baseUrl,
		prefix: mergedConfig.prefix,
		include: mergedConfig.include,
		exclude: mergedConfig.exclude,
	});

	if (tools.length === 0) {
		logger.warn("No tools generated from the spec. Check your include/exclude filters.");
	}

	// Create auth provider
	const authProvider = createAuthProvider(mergedConfig.auth);

	// Build tool lookup
	const toolMap = new Map<string, GeneratedTool>();
	for (const tool of tools) {
		toolMap.set(tool.name, tool);
	}

	// Create MCP server using low-level API
	const server = new Server(
		{
			name: `mcp-openapi: ${spec.info.title}`,
			version: spec.info.version,
		},
		{
			capabilities: {
				tools: {},
			},
		},
	);

	// Handle list tools
	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: tools.map((t) => ({
			name: t.name,
			description: t.description,
			inputSchema: {
				type: "object" as const,
				properties: t.inputSchema.properties ?? {},
				...(t.inputSchema.required ? { required: t.inputSchema.required } : {}),
			},
		})),
	}));

	// Handle call tool
	server.setRequestHandler(CallToolRequestSchema, async (request): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean; [key: string]: unknown }> => {
		const tool = toolMap.get(request.params.name);
		if (!tool) {
			return {
				content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
				isError: true,
			};
		}

		const args = (request.params.arguments ?? {}) as Record<string, unknown>;

		// Build HTTP request from tool call args
		let httpRequest = buildRequest(args, tool.endpointRef, mergedConfig.headers);

		// Apply auth
		if (authProvider) {
			httpRequest = await authProvider.apply(httpRequest);
		}

		// Execute HTTP request
		const response = await executeRequest(httpRequest, {
			timeout: mergedConfig.timeout!,
			maxRetries: mergedConfig.maxRetries!,
		});

		// Map to MCP result
		const result = mapResponse(response);
		return { ...result };
	});

	logger.info(
		`Registered ${tools.length} tools from ${spec.info.title} v${spec.info.version}`,
	);

	return { server, tools, spec };
}

export async function startServer(config: McpOpenApiConfig) {
	const { server } = await createServer(config);

	const transport = new StdioServerTransport();
	await server.connect(transport);

	logger.info("MCP server running on stdio");
}
