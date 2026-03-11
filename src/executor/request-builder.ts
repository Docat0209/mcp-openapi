import type { ParameterMapping } from "../generator/param-builder.js";
import type { PreparedRequest } from "./types.js";

export interface EndpointRef {
	method: string;
	path: string;
	baseUrl: string;
	contentType: string;
	parameterMap: ParameterMapping[];
}

/**
 * Convert flat MCP tool call arguments into a structured HTTP request
 * using the parameter mapping from tool generation.
 */
export function buildRequest(
	args: Record<string, unknown>,
	endpointRef: EndpointRef,
	customHeaders?: Record<string, string>,
): PreparedRequest {
	let path = endpointRef.path;
	const query: Record<string, string> = {};
	const headers: Record<string, string> = {
		...customHeaders,
	};
	const bodyParts: Record<string, unknown> = {};
	let hasBody = false;

	for (const mapping of endpointRef.parameterMap) {
		const value = args[mapping.toolParamName];
		if (value === undefined) continue;

		switch (mapping.source) {
			case "path":
				path = path.replace(`{${mapping.originalName}}`, String(value));
				break;
			case "query":
				query[mapping.originalName] = String(value);
				break;
			case "header":
				headers[mapping.originalName] = String(value);
				break;
			case "body":
				if (mapping.originalName === "body") {
					// Nested body object — use as-is
					Object.assign(bodyParts, value as Record<string, unknown>);
				} else {
					bodyParts[mapping.originalName] = value;
				}
				hasBody = true;
				break;
		}
	}

	// Build URL with query string
	const url = buildUrl(endpointRef.baseUrl, path, query);

	// Set content type for body requests
	if (hasBody) {
		headers["Content-Type"] = endpointRef.contentType;
	}

	return {
		url,
		method: endpointRef.method,
		headers,
		query,
		body: hasBody ? bodyParts : undefined,
	};
}

function buildUrl(
	baseUrl: string,
	path: string,
	query: Record<string, string>,
): string {
	const url = new URL(path, baseUrl);
	for (const [key, value] of Object.entries(query)) {
		url.searchParams.set(key, value);
	}
	return url.toString();
}
