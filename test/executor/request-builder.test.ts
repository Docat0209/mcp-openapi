import { describe, expect, it } from "vitest";
import { buildRequest } from "../../src/executor/request-builder.js";
import type { EndpointRef } from "../../src/executor/request-builder.js";

describe("buildRequest", () => {
	const baseEndpoint: EndpointRef = {
		method: "GET",
		path: "/users/{userId}",
		baseUrl: "https://api.example.com",
		contentType: "application/json",
		parameterMap: [
			{ toolParamName: "userId", source: "path", originalName: "userId", required: true },
			{ toolParamName: "include", source: "query", originalName: "include", required: false },
		],
	};

	it("should substitute path parameters", () => {
		const req = buildRequest({ userId: "42" }, baseEndpoint);
		expect(req.url).toBe("https://api.example.com/users/42");
		expect(req.method).toBe("GET");
	});

	it("should add query parameters", () => {
		const req = buildRequest({ userId: "42", include: "email" }, baseEndpoint);
		expect(req.url).toContain("include=email");
	});

	it("should skip undefined args", () => {
		const req = buildRequest({ userId: "42" }, baseEndpoint);
		expect(req.url).not.toContain("include");
	});

	it("should build body from flattened params", () => {
		const endpoint: EndpointRef = {
			method: "POST",
			path: "/users",
			baseUrl: "https://api.example.com",
			contentType: "application/json",
			parameterMap: [
				{ toolParamName: "name", source: "body", originalName: "name", required: true },
				{ toolParamName: "email", source: "body", originalName: "email", required: true },
			],
		};

		const req = buildRequest({ name: "John", email: "john@example.com" }, endpoint);
		expect(req.body).toEqual({ name: "John", email: "john@example.com" });
		expect(req.headers["Content-Type"]).toBe("application/json");
	});

	it("should handle nested body object", () => {
		const endpoint: EndpointRef = {
			method: "POST",
			path: "/data",
			baseUrl: "https://api.example.com",
			contentType: "application/json",
			parameterMap: [
				{ toolParamName: "body", source: "body", originalName: "body", required: true },
			],
		};

		const req = buildRequest({ body: { key: "value", nested: { a: 1 } } }, endpoint);
		expect(req.body).toEqual({ key: "value", nested: { a: 1 } });
	});

	it("should inject custom headers", () => {
		const req = buildRequest(
			{ userId: "42" },
			baseEndpoint,
			{ "X-Custom": "test" },
		);
		expect(req.headers["X-Custom"]).toBe("test");
	});

	it("should set header params from args", () => {
		const endpoint: EndpointRef = {
			method: "GET",
			path: "/data",
			baseUrl: "https://api.example.com",
			contentType: "application/json",
			parameterMap: [
				{ toolParamName: "X-Request-Id", source: "header", originalName: "X-Request-Id", required: false },
			],
		};

		const req = buildRequest({ "X-Request-Id": "abc-123" }, endpoint);
		expect(req.headers["X-Request-Id"]).toBe("abc-123");
	});
});
