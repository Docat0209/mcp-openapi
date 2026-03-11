import { describe, expect, it } from "vitest";
import { mapResponse } from "../../src/executor/response-mapper.js";
import type { HttpResponse } from "../../src/executor/http-client.js";

describe("mapResponse", () => {
	it("should format JSON response with pretty print", () => {
		const response: HttpResponse = {
			status: 200,
			statusText: "OK",
			headers: {},
			body: '{"id":1,"name":"Buddy"}',
			contentType: "application/json",
		};

		const result = mapResponse(response);
		expect(result.isError).toBeUndefined();
		expect(result.content[0].text).toContain('"id": 1');
		expect(result.content[0].text).toContain('"name": "Buddy"');
	});

	it("should return error for 4xx/5xx", () => {
		const response: HttpResponse = {
			status: 404,
			statusText: "Not Found",
			headers: {},
			body: '{"error":"not found"}',
			contentType: "application/json",
		};

		const result = mapResponse(response);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain("HTTP Error 404");
	});

	it("should handle text response", () => {
		const response: HttpResponse = {
			status: 200,
			statusText: "OK",
			headers: {},
			body: "<html>Hello</html>",
			contentType: "text/html",
		};

		const result = mapResponse(response);
		expect(result.content[0].text).toBe("<html>Hello</html>");
	});

	it("should handle binary response", () => {
		const response: HttpResponse = {
			status: 200,
			statusText: "OK",
			headers: {},
			body: "binary-data-here",
			contentType: "image/png",
		};

		const result = mapResponse(response);
		expect(result.content[0].text).toContain("[Binary response:");
		expect(result.content[0].text).toContain("image/png");
	});

	it("should truncate very long responses", () => {
		const longBody = JSON.stringify({ data: "x".repeat(100_000) });
		const response: HttpResponse = {
			status: 200,
			statusText: "OK",
			headers: {},
			body: longBody,
			contentType: "application/json",
		};

		const result = mapResponse(response);
		expect(result.content[0].text).toContain("truncated");
		expect(result.content[0].text.length).toBeLessThan(60_000);
	});

	it("should handle malformed JSON gracefully", () => {
		const response: HttpResponse = {
			status: 200,
			statusText: "OK",
			headers: {},
			body: "{invalid json",
			contentType: "application/json",
		};

		const result = mapResponse(response);
		expect(result.content[0].text).toBe("{invalid json");
	});
});
