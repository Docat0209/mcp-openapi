/**
 * Smithery.ai deployment adapter
 *
 * Exports the ServerModule interface expected by Smithery:
 * - default: factory function (ServerContext → Server)
 * - configSchema: Zod validation schema
 * - createSandboxServer: scan-time factory with demo spec
 */
import type {
	CreateServerFn,
	CreateSandboxServerFn,
	ServerContext,
} from "@smithery/sdk";
import { z } from "zod";
import { createServer } from "./server.js";

const configSchema = z.object({
	/** URL or local file path to an OpenAPI/Swagger spec */
	spec: z.string().describe("URL or local file path to OpenAPI spec"),
	/** Base URL override (skips servers[] in the spec) */
	baseUrl: z.string().optional().describe("Base URL override"),
	/** Tool name prefix, e.g. 'github' → 'github_get_repos' */
	prefix: z.string().optional().describe("Tool name prefix"),
	/** Bearer token for API authentication */
	bearerToken: z
		.string()
		.optional()
		.describe("Bearer token for API authentication"),
	/** API key value (used with apiKeyName and apiKeyIn) */
	apiKeyValue: z.string().optional().describe("API key value"),
	/** API key header/query name */
	apiKeyName: z
		.string()
		.optional()
		.describe("API key header or query param name"),
	/** Where to send the API key: header or query */
	apiKeyIn: z
		.enum(["header", "query"])
		.optional()
		.describe("Send API key in header or query"),
});

type SmitheryConfig = z.infer<typeof configSchema>;

const createSmitheryServer: CreateServerFn<SmitheryConfig> = async (
	context: ServerContext<SmitheryConfig>,
) => {
	const { config } = context;

	// Map Smithery flat config to McpOpenApiConfig
	const auth = config.bearerToken
		? ({ type: "bearer" as const, token: config.bearerToken })
		: config.apiKeyValue && config.apiKeyName
			? ({
					type: "api-key" as const,
					name: config.apiKeyName,
					value: config.apiKeyValue,
					in: config.apiKeyIn ?? "header",
				})
			: undefined;

	const { server } = await createServer({
		spec: config.spec,
		baseUrl: config.baseUrl,
		prefix: config.prefix,
		auth,
	});

	return server;
};

const createSandboxServer: CreateSandboxServerFn = async () => {
	const { server } = await createServer({
		spec: "https://petstore3.swagger.io/api/v3/openapi.json",
	});
	return server;
};

export default createSmitheryServer;
export { configSchema, createSandboxServer };
