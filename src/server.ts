import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAuthProvider } from "./auth/index.js";
import type { McpOpenApiConfig } from "./config/types.js";
import { DEFAULT_CONFIG } from "./config/types.js";
import { buildRequest } from "./executor/request-builder.js";
import { executeRequest } from "./executor/http-client.js";
import { mapResponse } from "./executor/response-mapper.js";
import { generateTools } from "./generator/tool-generator.js";
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

	// Create MCP server
	const server = new McpServer({
		name: `mcp-openapi: ${spec.info.title}`,
		version: spec.info.version,
	});

	// Register each tool
	for (const tool of tools) {
		server.tool(
			tool.name,
			tool.description,
			tool.inputSchema.properties
				? (tool.inputSchema as { properties: Record<string, unknown> })
				: { properties: {} },
			async (args: Record<string, unknown>) => {
				// Build HTTP request from tool call args
				let request = buildRequest(
					args,
					tool.endpointRef,
					mergedConfig.headers,
				);

				// Apply auth
				if (authProvider) {
					request = await authProvider.apply(request);
				}

				// Execute HTTP request
				const response = await executeRequest(request, {
					timeout: mergedConfig.timeout!,
					maxRetries: mergedConfig.maxRetries!,
				});

				// Map to MCP result
				return mapResponse(response);
			},
		);
	}

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
