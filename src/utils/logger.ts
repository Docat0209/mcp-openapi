/** Logs to stderr only — stdout is reserved for MCP stdio transport */
export const logger = {
	info: (msg: string, ...args: unknown[]) =>
		console.error(`[mcp-openapi] ${msg}`, ...args),
	warn: (msg: string, ...args: unknown[]) =>
		console.error(`[mcp-openapi] WARN: ${msg}`, ...args),
	error: (msg: string, ...args: unknown[]) =>
		console.error(`[mcp-openapi] ERROR: ${msg}`, ...args),
	debug: (msg: string, ...args: unknown[]) => {
		if (process.env.DEBUG) {
			console.error(`[mcp-openapi] DEBUG: ${msg}`, ...args);
		}
	},
};
