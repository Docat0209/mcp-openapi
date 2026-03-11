import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import type { AuthConfig, McpOpenApiConfig } from "./types.js";

export function parseCliArgs(argv: string[]): McpOpenApiConfig {
	const { values } = parseArgs({
		args: argv.slice(2),
		options: {
			spec: { type: "string", short: "s" },
			config: { type: "string", short: "c" },
			"base-url": { type: "string" },
			prefix: { type: "string" },
			include: { type: "string" },
			exclude: { type: "string" },
			timeout: { type: "string" },
			"max-retries": { type: "string" },
			transport: { type: "string" },
			port: { type: "string" },
			// Auth options
			"auth-type": { type: "string" },
			"auth-token": { type: "string" },
			"auth-name": { type: "string" },
			"auth-value": { type: "string" },
			"auth-in": { type: "string" },
			"auth-client-id": { type: "string" },
			"auth-client-secret": { type: "string" },
			"auth-token-url": { type: "string" },
			"auth-scopes": { type: "string" },
			// Header options
			header: { type: "string", multiple: true, short: "H" },
			help: { type: "boolean", short: "h" },
			version: { type: "boolean", short: "v" },
		},
		strict: false,
	});

	if (values.help) {
		printHelp();
		process.exit(0);
	}

	if (values.version) {
		console.error("mcp-openapi v0.1.0");
		process.exit(0);
	}

	const config: McpOpenApiConfig = {
		spec: (values.spec as string) ?? "",
	};

	if (values["base-url"]) config.baseUrl = values["base-url"] as string;
	if (values.prefix) config.prefix = values.prefix as string;
	if (values.include) config.include = (values.include as string).split(",");
	if (values.exclude) config.exclude = (values.exclude as string).split(",");
	if (values.timeout) config.timeout = Number(values.timeout);
	if (values["max-retries"]) config.maxRetries = Number(values["max-retries"]);
	if (values.transport) config.transport = values.transport as "stdio" | "sse";
	if (values.port) config.port = Number(values.port);

	// Parse auth
	const authType = values["auth-type"] as string | undefined;
	if (authType) {
		config.auth = parseAuthArgs(authType, values);
	}

	// Parse custom headers
	if (values.header) {
		config.headers = {};
		for (const h of values.header as string[]) {
			const colonIdx = h.indexOf(":");
			if (colonIdx > 0) {
				config.headers[h.slice(0, colonIdx).trim()] = h.slice(colonIdx + 1).trim();
			}
		}
	}

	return config;
}

export async function loadConfigFile(path: string): Promise<Partial<McpOpenApiConfig>> {
	const content = await readFile(path, "utf-8");
	return JSON.parse(content) as Partial<McpOpenApiConfig>;
}

export function mergeConfigs(
	fileConfig: Partial<McpOpenApiConfig>,
	cliConfig: McpOpenApiConfig,
): McpOpenApiConfig {
	// CLI takes precedence over file config
	return {
		...fileConfig,
		...Object.fromEntries(
			Object.entries(cliConfig).filter(([, v]) => v !== undefined && v !== ""),
		),
	} as McpOpenApiConfig;
}

function parseAuthArgs(
	authType: string,
	values: Record<string, unknown>,
): AuthConfig {
	switch (authType) {
		case "bearer":
			return {
				type: "bearer",
				token: (values["auth-token"] as string) ?? "",
			};
		case "api-key":
			return {
				type: "api-key",
				name: (values["auth-name"] as string) ?? "Authorization",
				value: (values["auth-value"] as string) ?? "",
				in: ((values["auth-in"] as string) ?? "header") as "header" | "query",
			};
		case "oauth2":
			return {
				type: "oauth2",
				clientId: (values["auth-client-id"] as string) ?? "",
				clientSecret: (values["auth-client-secret"] as string) ?? "",
				tokenUrl: (values["auth-token-url"] as string) ?? "",
				scopes: (values["auth-scopes"] as string)?.split(","),
			};
		default:
			throw new Error(`Unknown auth type: ${authType}`);
	}
}

function printHelp(): void {
	console.error(`
mcp-openapi - Convert any OpenAPI/Swagger spec into MCP tools

USAGE:
  npx mcp-openapi --spec <url-or-path> [options]

OPTIONS:
  -s, --spec <url|path>       OpenAPI spec URL or local file path (required)
  -c, --config <path>         JSON config file path
      --base-url <url>        Override API base URL
      --prefix <name>         Prefix all tool names
      --include <patterns>    Comma-separated operationIds or path patterns
      --exclude <patterns>    Comma-separated operationIds or path patterns
      --timeout <ms>          Request timeout (default: 30000)
      --max-retries <n>       Max retries on 429/5xx (default: 3)
  -H, --header <name:value>   Custom header (can be used multiple times)

AUTH OPTIONS:
      --auth-type bearer      Bearer token auth
      --auth-token <token>    Bearer token (use $ENV_VAR for env reference)

      --auth-type api-key     API key auth
      --auth-name <name>      Header/query param name
      --auth-value <value>    API key value (use $ENV_VAR for env reference)
      --auth-in <header|query>

      --auth-type oauth2      OAuth2 client credentials
      --auth-client-id <id>
      --auth-client-secret <secret>
      --auth-token-url <url>
      --auth-scopes <scopes>

EXAMPLES:
  npx mcp-openapi --spec https://petstore3.swagger.io/api/v3/openapi.json
  npx mcp-openapi --spec ./api.yaml --auth-type bearer --auth-token '$API_KEY'
  npx mcp-openapi --spec ./api.json --prefix github --include 'listRepos,getRepo'
`);
}
