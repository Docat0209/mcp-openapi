import type { JsonSchema, NormalizedEndpoint, NormalizedParameter } from "../parser/types.js";

export interface ParameterMapping {
	toolParamName: string;
	source: "path" | "query" | "header" | "body";
	originalName: string;
	required: boolean;
}

export interface BuiltParams {
	inputSchema: JsonSchema;
	parameterMap: ParameterMapping[];
}

/**
 * Flatten path, query, header, and body parameters into a single
 * MCP tool inputSchema. Handles name collisions with prefixing.
 */
export function buildParams(endpoint: NormalizedEndpoint): BuiltParams {
	const properties: Record<string, JsonSchema> = {};
	const required: string[] = [];
	const parameterMap: ParameterMapping[] = [];
	const usedNames = new Set<string>();

	// Path params first (highest priority, always required)
	for (const param of endpoint.parameters.filter((p) => p.in === "path")) {
		const name = ensureUnique(param.name, usedNames);
		properties[name] = { ...param.schema, description: param.description ?? param.schema.description };
		required.push(name);
		parameterMap.push({
			toolParamName: name,
			source: "path",
			originalName: param.name,
			required: true,
		});
	}

	// Query params
	for (const param of endpoint.parameters.filter((p) => p.in === "query")) {
		const name = ensureUnique(param.name, usedNames, "query");
		properties[name] = { ...param.schema, description: param.description ?? param.schema.description };
		if (param.required) required.push(name);
		parameterMap.push({
			toolParamName: name,
			source: "query",
			originalName: param.name,
			required: param.required,
		});
	}

	// Header params (skip standard headers)
	const skipHeaders = new Set(["content-type", "accept", "authorization"]);
	for (const param of endpoint.parameters.filter(
		(p) => p.in === "header" && !skipHeaders.has(p.name.toLowerCase()),
	)) {
		const name = ensureUnique(param.name, usedNames, "header");
		properties[name] = { ...param.schema, description: param.description ?? param.schema.description };
		if (param.required) required.push(name);
		parameterMap.push({
			toolParamName: name,
			source: "header",
			originalName: param.name,
			required: param.required,
		});
	}

	// Request body
	if (endpoint.requestBody?.schema) {
		const bodySchema = endpoint.requestBody.schema;

		// If body has properties, flatten them into the top level
		if (bodySchema.properties && Object.keys(bodySchema.properties).length <= 15) {
			for (const [propName, propSchema] of Object.entries(bodySchema.properties)) {
				const name = ensureUnique(propName, usedNames, "body");
				properties[name] = propSchema;
				parameterMap.push({
					toolParamName: name,
					source: "body",
					originalName: propName,
					required: bodySchema.required?.includes(propName) ?? false,
				});
				if (
					endpoint.requestBody.required &&
					bodySchema.required?.includes(propName)
				) {
					required.push(name);
				}
			}
		} else {
			// Complex body: nest under "body" property
			const name = ensureUnique("body", usedNames);
			properties[name] = {
				...bodySchema,
				description: endpoint.requestBody.description ?? bodySchema.description,
			};
			if (endpoint.requestBody.required) required.push(name);
			parameterMap.push({
				toolParamName: name,
				source: "body",
				originalName: "body",
				required: endpoint.requestBody.required,
			});
		}
	}

	const inputSchema: JsonSchema = {
		type: "object",
		properties,
	};
	if (required.length > 0) {
		inputSchema.required = required;
	}

	return { inputSchema, parameterMap };
}

function ensureUnique(
	name: string,
	used: Set<string>,
	prefixOnCollision?: string,
): string {
	let candidate = name;
	if (used.has(candidate) && prefixOnCollision) {
		candidate = `${prefixOnCollision}_${name}`;
	}
	// Final collision fallback
	let suffix = 2;
	const base = candidate;
	while (used.has(candidate)) {
		candidate = `${base}_${suffix}`;
		suffix++;
	}
	used.add(candidate);
	return candidate;
}
