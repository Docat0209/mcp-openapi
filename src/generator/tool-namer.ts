const MAX_TOOL_NAME_LENGTH = 64;

/**
 * Generate a deterministic MCP tool name from an endpoint.
 * Priority: operationId → method + path segments
 */
export function generateToolName(
	operationId: string,
	method: string,
	path: string,
	prefix?: string,
): string {
	let name = sanitizeOperationId(operationId);

	if (prefix) {
		name = `${sanitize(prefix)}_${name}`;
	}

	if (name.length > MAX_TOOL_NAME_LENGTH) {
		name = name.slice(0, MAX_TOOL_NAME_LENGTH);
	}

	return name;
}

/**
 * Resolve naming collisions by appending _2, _3, etc.
 */
export function resolveCollisions(names: string[]): string[] {
	const seen = new Map<string, number>();
	return names.map((name) => {
		const count = seen.get(name) ?? 0;
		seen.set(name, count + 1);
		if (count === 0) return name;
		return `${name}_${count + 1}`.slice(0, MAX_TOOL_NAME_LENGTH);
	});
}

function sanitizeOperationId(id: string): string {
	return id
		.replace(/([a-z])([A-Z])/g, "$1_$2") // camelCase → snake_case
		.replace(/[^a-zA-Z0-9_]/g, "_") // non-alphanumeric → underscore
		.replace(/_+/g, "_") // collapse multiple underscores
		.replace(/^_|_$/g, "") // trim leading/trailing underscores
		.toLowerCase();
}

function sanitize(input: string): string {
	return input
		.replace(/[^a-zA-Z0-9_]/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "")
		.toLowerCase();
}
