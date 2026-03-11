/**
 * Smart response transformation for Pro tier.
 * - JMESPath transforms: filter API responses to relevant fields
 * - Smart truncation: array slicing with metadata instead of hard cut
 */

export interface TransformOptions {
	/** JMESPath expression to apply before truncation */
	jmesPath?: string;
	/** Max response text length (default: 50000) */
	maxLength?: number;
	/** Max items to keep when slicing arrays (default: 10) */
	arraySliceSize?: number;
	/** Max nesting depth before pruning (default: 4) */
	maxDepth?: number;
}

const DEFAULT_MAX_LENGTH = 50_000;
const DEFAULT_ARRAY_SLICE = 10;
const DEFAULT_MAX_DEPTH = 4;

/**
 * Apply JMESPath transform to parsed JSON data.
 * Dynamically imports jmespath to keep it optional.
 */
export async function applyJmesPath(
	data: unknown,
	expression: string,
): Promise<unknown> {
	const jmespath = await import("@metrichor/jmespath");
	return jmespath.search(data as Parameters<typeof jmespath.search>[0], expression);
}

/**
 * Smart truncation that preserves structure instead of hard-cutting text.
 * - Arrays: keep first N items + metadata
 * - Deep objects: prune beyond max depth
 * - Large strings: truncate with indicator
 */
export function smartTruncate(
	data: unknown,
	options: TransformOptions = {},
): string {
	const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
	const arraySlice = options.arraySliceSize ?? DEFAULT_ARRAY_SLICE;
	const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

	const pruned = pruneData(data, arraySlice, maxDepth, 0);
	const result = JSON.stringify(pruned, null, 2);

	// Final safety net: if still too long after pruning, hard truncate
	if (result.length > maxLength) {
		return `${result.slice(0, maxLength)}\n\n... [truncated, ${result.length - maxLength} characters omitted]`;
	}

	return result;
}

function pruneData(
	data: unknown,
	arraySlice: number,
	maxDepth: number,
	currentDepth: number,
): unknown {
	if (data === null || data === undefined) return data;
	if (typeof data !== "object") return data;

	// Array: slice + metadata
	if (Array.isArray(data)) {
		if (data.length > arraySlice) {
			const sliced = data
				.slice(0, arraySlice)
				.map((item) =>
					pruneData(item, arraySlice, maxDepth, currentDepth + 1),
				);
			return [
				...sliced,
				{
					_meta: `showing ${arraySlice} of ${data.length} items. Use pagination or offset parameters to retrieve more.`,
				},
			];
		}
		return data.map((item) =>
			pruneData(item, arraySlice, maxDepth, currentDepth + 1),
		);
	}

	// Object at max depth: summarize keys
	if (currentDepth >= maxDepth) {
		const keys = Object.keys(data as Record<string, unknown>);
		const record = data as Record<string, unknown>;
		const summary: Record<string, string> = {};
		for (const key of keys) {
			const val = record[key];
			if (Array.isArray(val)) {
				summary[key] = `[array(${val.length})]`;
			} else if (typeof val === "object" && val !== null) {
				summary[key] = `[object(${Object.keys(val).length} keys)]`;
			} else {
				summary[key] = String(val);
			}
		}
		return summary;
	}

	// Object: recurse
	const record = data as Record<string, unknown>;
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(record)) {
		result[key] = pruneData(value, arraySlice, maxDepth, currentDepth + 1);
	}
	return result;
}

/**
 * Match a tool name against a pattern (supports * glob).
 */
export function matchTransformPattern(
	toolName: string,
	pattern: string,
): boolean {
	if (pattern.includes("*")) {
		const regex = new RegExp(
			`^${pattern.replace(/\*/g, ".*")}$`,
		);
		return regex.test(toolName);
	}
	return toolName === pattern;
}

/**
 * Find the matching transform expression for a tool name.
 */
export function findTransform(
	toolName: string,
	transforms: Record<string, string>,
): string | undefined {
	// Exact match first
	if (transforms[toolName]) return transforms[toolName];

	// Glob pattern match
	for (const [pattern, expression] of Object.entries(transforms)) {
		if (matchTransformPattern(toolName, pattern)) {
			return expression;
		}
	}

	return undefined;
}
