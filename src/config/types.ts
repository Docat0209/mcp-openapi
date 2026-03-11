export interface McpOpenApiConfig {
	/** URL or local file path to OpenAPI spec */
	spec: string;
	/** Base URL override (skips servers[] in spec) */
	baseUrl?: string;
	/** Auth configuration */
	auth?: AuthConfig;
	/** Include only these operationIds or path patterns */
	include?: string[];
	/** Exclude these operationIds or path patterns */
	exclude?: string[];
	/** Tool name prefix, e.g. "github" → "github_get_repos" */
	prefix?: string;
	/** Request timeout in ms (default: 30000) */
	timeout?: number;
	/** Max retries on 429/5xx (default: 3) */
	maxRetries?: number;
	/** Custom headers injected into every request */
	headers?: Record<string, string>;
	/** Transport: "stdio" | "sse" (default: "stdio") */
	transport?: "stdio" | "sse";
	/** SSE port (default: 3000) */
	port?: number;
}

export type AuthConfig =
	| { type: "api-key"; name: string; value: string; in: "header" | "query" }
	| { type: "bearer"; token: string }
	| {
			type: "oauth2";
			clientId: string;
			clientSecret: string;
			tokenUrl: string;
			scopes?: string[];
	  };

export const DEFAULT_CONFIG = {
	timeout: 30_000,
	maxRetries: 3,
	transport: "stdio" as const,
	port: 3000,
} satisfies Partial<McpOpenApiConfig>;
