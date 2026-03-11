/** JSON Schema subset that MCP tools accept */
export type JsonSchema = {
	type?: string;
	properties?: Record<string, JsonSchema>;
	required?: string[];
	items?: JsonSchema;
	description?: string;
	enum?: unknown[];
	default?: unknown;
	format?: string;
	[key: string]: unknown;
};

export interface NormalizedSpec {
	info: { title: string; version: string; description?: string };
	servers: Array<{ url: string }>;
	endpoints: NormalizedEndpoint[];
	securitySchemes: Record<string, SecurityScheme>;
}

export interface NormalizedEndpoint {
	method: "get" | "post" | "put" | "patch" | "delete" | "head" | "options";
	path: string;
	operationId: string;
	summary?: string;
	description?: string;
	parameters: NormalizedParameter[];
	requestBody?: NormalizedRequestBody;
	responses: Record<string, NormalizedResponse>;
	security?: SecurityRequirement[];
	tags?: string[];
	deprecated?: boolean;
}

export interface NormalizedParameter {
	name: string;
	in: "path" | "query" | "header" | "cookie";
	required: boolean;
	description?: string;
	schema: JsonSchema;
}

export interface NormalizedRequestBody {
	required: boolean;
	description?: string;
	contentType: string;
	schema: JsonSchema;
}

export interface NormalizedResponse {
	description?: string;
	contentType?: string;
	schema?: JsonSchema;
}

export type SecurityScheme =
	| { type: "apiKey"; name: string; in: "header" | "query" | "cookie" }
	| { type: "http"; scheme: string; bearerFormat?: string }
	| {
			type: "oauth2";
			flows: Record<string, { tokenUrl?: string; scopes: Record<string, string> }>;
	  };

export type SecurityRequirement = Record<string, string[]>;
