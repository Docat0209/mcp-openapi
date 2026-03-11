export class McpOpenApiError extends Error {
	constructor(
		message: string,
		public readonly code: string,
	) {
		super(message);
		this.name = "McpOpenApiError";
	}
}

export class SpecLoadError extends McpOpenApiError {
	constructor(message: string) {
		super(message, "SPEC_LOAD_ERROR");
		this.name = "SpecLoadError";
	}
}

export class SpecParseError extends McpOpenApiError {
	constructor(message: string) {
		super(message, "SPEC_PARSE_ERROR");
		this.name = "SpecParseError";
	}
}

export class AuthError extends McpOpenApiError {
	constructor(message: string) {
		super(message, "AUTH_ERROR");
		this.name = "AuthError";
	}
}

export class HttpRequestError extends McpOpenApiError {
	constructor(
		message: string,
		public readonly statusCode?: number,
		public readonly responseBody?: string,
	) {
		super(message, "HTTP_REQUEST_ERROR");
		this.name = "HttpRequestError";
	}
}
