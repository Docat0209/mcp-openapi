import type { JsonSchema } from "./types.js";

/**
 * Convert OAS-specific schema extensions into pure JSON Schema
 * that MCP tools can accept.
 */
export function convertToJsonSchema(oasSchema: Record<string, unknown>): JsonSchema {
	if (!oasSchema || typeof oasSchema !== "object") {
		return { type: "string" };
	}

	const schema: JsonSchema = {};

	// Copy basic properties
	if (oasSchema.type) schema.type = String(oasSchema.type);
	if (oasSchema.description) schema.description = String(oasSchema.description);
	if (oasSchema.format) schema.format = String(oasSchema.format);
	if (oasSchema.default !== undefined) schema.default = oasSchema.default;
	if (Array.isArray(oasSchema.enum)) schema.enum = oasSchema.enum;

	// Handle nullable (OAS 3.0 extension)
	if (oasSchema.nullable === true && schema.type) {
		// JSON Schema doesn't have nullable, express as type array or leave as-is for MCP
	}

	// Handle properties (object type)
	if (oasSchema.properties && typeof oasSchema.properties === "object") {
		schema.type = "object";
		schema.properties = {};
		for (const [key, value] of Object.entries(oasSchema.properties)) {
			if (value && typeof value === "object") {
				schema.properties[key] = convertToJsonSchema(value as Record<string, unknown>);
			}
		}
	}

	// Handle required
	if (Array.isArray(oasSchema.required)) {
		schema.required = oasSchema.required.filter(
			(r): r is string => typeof r === "string",
		);
	}

	// Handle items (array type)
	if (oasSchema.items && typeof oasSchema.items === "object") {
		schema.type = "array";
		schema.items = convertToJsonSchema(oasSchema.items as Record<string, unknown>);
	}

	// Handle allOf — merge into single schema
	if (Array.isArray(oasSchema.allOf)) {
		return mergeAllOf(oasSchema.allOf as Record<string, unknown>[]);
	}

	// Handle oneOf/anyOf — pick first as best effort
	if (Array.isArray(oasSchema.oneOf) && oasSchema.oneOf.length > 0) {
		const first = oasSchema.oneOf[0];
		if (first && typeof first === "object") {
			return convertToJsonSchema(first as Record<string, unknown>);
		}
	}
	if (Array.isArray(oasSchema.anyOf) && oasSchema.anyOf.length > 0) {
		const first = oasSchema.anyOf[0];
		if (first && typeof first === "object") {
			return convertToJsonSchema(first as Record<string, unknown>);
		}
	}

	// Default to string if no type detected
	if (!schema.type && !schema.properties && !schema.items) {
		schema.type = "string";
	}

	return schema;
}

function mergeAllOf(schemas: Record<string, unknown>[]): JsonSchema {
	const merged: JsonSchema = { type: "object", properties: {}, required: [] };

	for (const sub of schemas) {
		const converted = convertToJsonSchema(sub);
		if (converted.properties) {
			Object.assign(merged.properties!, converted.properties);
		}
		if (converted.required) {
			merged.required!.push(...converted.required);
		}
		if (converted.description && !merged.description) {
			merged.description = converted.description;
		}
	}

	if (merged.required!.length === 0) {
		delete merged.required;
	}

	return merged;
}
