import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPI, OpenAPIV2, OpenAPIV3 } from "openapi-types";
import { SpecParseError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { convertToJsonSchema } from "./schema-converter.js";
import type {
	NormalizedEndpoint,
	NormalizedParameter,
	NormalizedRequestBody,
	NormalizedResponse,
	NormalizedSpec,
	SecurityScheme,
} from "./types.js";

const HTTP_METHODS = [
	"get",
	"post",
	"put",
	"patch",
	"delete",
	"head",
	"options",
] as const;

export async function parseSpec(specInput: string): Promise<NormalizedSpec> {
	try {
		const api = await SwaggerParser.dereference(specInput);
		if (isSwagger2(api)) {
			return normalizeV2(api as OpenAPIV2.Document);
		}
		return normalizeV3(api as OpenAPIV3.Document);
	} catch (error) {
		throw new SpecParseError(
			`Failed to parse OpenAPI spec: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

function isSwagger2(api: OpenAPI.Document): boolean {
	return "swagger" in api && (api as OpenAPIV2.Document).swagger === "2.0";
}

function normalizeV3(doc: OpenAPIV3.Document): NormalizedSpec {
	const endpoints: NormalizedEndpoint[] = [];
	const paths = doc.paths ?? {};

	for (const [path, pathItem] of Object.entries(paths)) {
		if (!pathItem) continue;

		// Path-level parameters
		const pathParams = (
			pathItem.parameters as OpenAPIV3.ParameterObject[] | undefined
		)?.map(normalizeV3Parameter) ?? [];

		for (const method of HTTP_METHODS) {
			const operation = pathItem[method] as OpenAPIV3.OperationObject | undefined;
			if (!operation) continue;

			const opParams = (
				operation.parameters as OpenAPIV3.ParameterObject[] | undefined
			)?.map(normalizeV3Parameter) ?? [];

			// Merge path-level and operation-level params (operation takes precedence)
			const mergedParams = mergeParameters(pathParams, opParams);

			const endpoint: NormalizedEndpoint = {
				method,
				path,
				operationId:
					operation.operationId ?? generateOperationId(method, path),
				summary: operation.summary,
				description: operation.description,
				parameters: mergedParams,
				requestBody: normalizeV3RequestBody(
					operation.requestBody as OpenAPIV3.RequestBodyObject | undefined,
				),
				responses: normalizeV3Responses(
					(operation.responses ?? {}) as Record<string, OpenAPIV3.ResponseObject>,
				),
				tags: operation.tags,
				deprecated: operation.deprecated,
			};

			endpoints.push(endpoint);
		}
	}

	logger.info(
		`Parsed ${endpoints.length} endpoints from ${doc.info.title} v${doc.info.version}`,
	);

	return {
		info: {
			title: doc.info.title,
			version: doc.info.version,
			description: doc.info.description,
		},
		servers: doc.servers?.map((s) => ({ url: s.url })) ?? [
			{ url: "http://localhost" },
		],
		endpoints,
		securitySchemes: normalizeV3SecuritySchemes(doc),
	};
}

function normalizeV2(doc: OpenAPIV2.Document): NormalizedSpec {
	const baseUrl = `${doc.schemes?.[0] ?? "https"}://${doc.host ?? "localhost"}${doc.basePath ?? ""}`;
	const endpoints: NormalizedEndpoint[] = [];
	const paths = doc.paths ?? {};

	for (const [path, pathItem] of Object.entries(paths)) {
		if (!pathItem) continue;

		const pathParams = (pathItem.parameters as OpenAPIV2.Parameter[] | undefined)
			?.map(normalizeV2Parameter) ?? [];

		for (const method of HTTP_METHODS) {
			const operation = pathItem[method] as OpenAPIV2.OperationObject | undefined;
			if (!operation) continue;

			const opParams = (operation.parameters as OpenAPIV2.Parameter[] | undefined)
				?.filter((p) => p.in !== "body")
				.map(normalizeV2Parameter) ?? [];

			const mergedParams = mergeParameters(pathParams, opParams);

			// Extract body parameter (Swagger 2.0 specific)
			const bodyParam = (operation.parameters as OpenAPIV2.Parameter[] | undefined)
				?.find((p) => p.in === "body") as OpenAPIV2.InBodyParameterObject | undefined;

			const endpoint: NormalizedEndpoint = {
				method,
				path,
				operationId:
					operation.operationId ?? generateOperationId(method, path),
				summary: operation.summary,
				description: operation.description,
				parameters: mergedParams,
				requestBody: bodyParam
					? {
							required: bodyParam.required ?? false,
							description: bodyParam.description,
							contentType: operation.consumes?.[0] ?? "application/json",
							schema: convertToJsonSchema(
								bodyParam.schema as Record<string, unknown>,
							),
						}
					: undefined,
				responses: normalizeV2Responses(
					(operation.responses ?? {}) as Record<string, OpenAPIV2.ResponseObject>,
				),
				tags: operation.tags,
				deprecated: operation.deprecated,
			};

			endpoints.push(endpoint);
		}
	}

	logger.info(
		`Parsed ${endpoints.length} endpoints from ${doc.info.title} v${doc.info.version} (Swagger 2.0)`,
	);

	return {
		info: {
			title: doc.info.title,
			version: doc.info.version,
			description: doc.info.description,
		},
		servers: [{ url: baseUrl }],
		endpoints,
		securitySchemes: normalizeV2SecuritySchemes(doc),
	};
}

function normalizeV3Parameter(param: OpenAPIV3.ParameterObject): NormalizedParameter {
	return {
		name: param.name,
		in: param.in as NormalizedParameter["in"],
		required: param.required ?? param.in === "path",
		description: param.description,
		schema: convertToJsonSchema(
			(param.schema as Record<string, unknown>) ?? { type: "string" },
		),
	};
}

function normalizeV2Parameter(param: OpenAPIV2.Parameter): NormalizedParameter {
	const general = param as OpenAPIV2.GeneralParameterObject;
	return {
		name: general.name,
		in: general.in as NormalizedParameter["in"],
		required: general.required ?? general.in === "path",
		description: general.description,
		schema: convertToJsonSchema({
			type: general.type,
			format: general.format,
			enum: general.enum,
			default: general.default,
			description: general.description,
		}),
	};
}

function normalizeV3RequestBody(
	body: OpenAPIV3.RequestBodyObject | undefined,
): NormalizedRequestBody | undefined {
	if (!body?.content) return undefined;

	// Prefer application/json
	const jsonContent = body.content["application/json"];
	if (jsonContent?.schema) {
		return {
			required: body.required ?? false,
			description: body.description,
			contentType: "application/json",
			schema: convertToJsonSchema(jsonContent.schema as Record<string, unknown>),
		};
	}

	// Fallback to first content type
	const [contentType, mediaType] = Object.entries(body.content)[0] ?? [];
	if (contentType && mediaType?.schema) {
		return {
			required: body.required ?? false,
			description: body.description,
			contentType,
			schema: convertToJsonSchema(mediaType.schema as Record<string, unknown>),
		};
	}

	return undefined;
}

function normalizeV3Responses(
	responses: Record<string, OpenAPIV3.ResponseObject>,
): Record<string, NormalizedResponse> {
	const result: Record<string, NormalizedResponse> = {};

	for (const [code, response] of Object.entries(responses)) {
		const resp = response as OpenAPIV3.ResponseObject;
		const jsonContent = resp.content?.["application/json"];

		result[code] = {
			description: resp.description,
			contentType: jsonContent ? "application/json" : undefined,
			schema: jsonContent?.schema
				? convertToJsonSchema(jsonContent.schema as Record<string, unknown>)
				: undefined,
		};
	}

	return result;
}

function normalizeV2Responses(
	responses: Record<string, OpenAPIV2.ResponseObject>,
): Record<string, NormalizedResponse> {
	const result: Record<string, NormalizedResponse> = {};

	for (const [code, response] of Object.entries(responses)) {
		result[code] = {
			description: response.description,
			schema: response.schema
				? convertToJsonSchema(response.schema as Record<string, unknown>)
				: undefined,
		};
	}

	return result;
}

function normalizeV3SecuritySchemes(
	doc: OpenAPIV3.Document,
): Record<string, SecurityScheme> {
	const schemes: Record<string, SecurityScheme> = {};
	const components = doc.components?.securitySchemes ?? {};

	for (const [name, scheme] of Object.entries(components)) {
		const s = scheme as OpenAPIV3.SecuritySchemeObject;
		if (s.type === "apiKey") {
			schemes[name] = {
				type: "apiKey",
				name: s.name,
				in: s.in as "header" | "query" | "cookie",
			};
		} else if (s.type === "http") {
			schemes[name] = { type: "http", scheme: s.scheme, bearerFormat: s.bearerFormat };
		} else if (s.type === "oauth2") {
			const flows: Record<string, { tokenUrl?: string; scopes: Record<string, string> }> = {};
			if (s.flows) {
				for (const [flowName, flow] of Object.entries(s.flows)) {
					if (flow) {
						flows[flowName] = {
							tokenUrl: (flow as { tokenUrl?: string }).tokenUrl,
							scopes: flow.scopes ?? {},
						};
					}
				}
			}
			schemes[name] = { type: "oauth2", flows };
		}
	}

	return schemes;
}

function normalizeV2SecuritySchemes(
	doc: OpenAPIV2.Document,
): Record<string, SecurityScheme> {
	const schemes: Record<string, SecurityScheme> = {};
	const definitions = doc.securityDefinitions ?? {};

	for (const [name, scheme] of Object.entries(definitions)) {
		if (scheme.type === "apiKey") {
			schemes[name] = {
				type: "apiKey",
				name: scheme.name,
				in: scheme.in as "header" | "query",
			};
		} else if (scheme.type === "basic") {
			schemes[name] = { type: "http", scheme: "basic" };
		} else if (scheme.type === "oauth2") {
			const oauthScheme = scheme as OpenAPIV2.SecuritySchemeOauth2;
			schemes[name] = {
				type: "oauth2",
				flows: {
					[oauthScheme.flow]: {
						tokenUrl: "tokenUrl" in oauthScheme ? (oauthScheme as { tokenUrl: string }).tokenUrl : undefined,
						scopes: oauthScheme.scopes ?? {},
					},
				},
			};
		}
	}

	return schemes;
}

function mergeParameters(
	pathLevel: NormalizedParameter[],
	operationLevel: NormalizedParameter[],
): NormalizedParameter[] {
	const byKey = new Map<string, NormalizedParameter>();
	for (const p of pathLevel) {
		byKey.set(`${p.in}:${p.name}`, p);
	}
	for (const p of operationLevel) {
		byKey.set(`${p.in}:${p.name}`, p); // operation overrides path
	}
	return [...byKey.values()];
}

function generateOperationId(method: string, path: string): string {
	const segments = path
		.split("/")
		.filter(Boolean)
		.map((s) => {
			if (s.startsWith("{") && s.endsWith("}")) {
				return `by_${s.slice(1, -1)}`;
			}
			return s.replace(/-/g, "_");
		});

	return `${method}_${segments.join("_")}`.toLowerCase();
}
