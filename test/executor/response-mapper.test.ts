import { describe, expect, it } from "vitest";
import { mapResponse } from "../../src/executor/response-mapper.js";
import type { HttpResponse } from "../../src/executor/http-client.js";

describe("mapResponse", () => {
	it("should format JSON response with pretty print", async () => {
		const response: HttpResponse = {
			status: 200,
			statusText: "OK",
			headers: {},
			body: '{"id":1,"name":"Buddy"}',
			contentType: "application/json",
		};

		const result = await mapResponse(response);
		expect(result.isError).toBeUndefined();
		expect(result.content[0].text).toContain('"id": 1');
		expect(result.content[0].text).toContain('"name": "Buddy"');
	});

	it("should return error for 4xx/5xx", async () => {
		const response: HttpResponse = {
			status: 404,
			statusText: "Not Found",
			headers: {},
			body: '{"error":"not found"}',
			contentType: "application/json",
		};

		const result = await mapResponse(response);
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain("HTTP Error 404");
	});

	it("should handle text response", async () => {
		const response: HttpResponse = {
			status: 200,
			statusText: "OK",
			headers: {},
			body: "<html>Hello</html>",
			contentType: "text/html",
		};

		const result = await mapResponse(response);
		expect(result.content[0].text).toBe("<html>Hello</html>");
	});

	it("should handle binary response", async () => {
		const response: HttpResponse = {
			status: 200,
			statusText: "OK",
			headers: {},
			body: "binary-data-here",
			contentType: "image/png",
		};

		const result = await mapResponse(response);
		expect(result.content[0].text).toContain("[Binary response:");
		expect(result.content[0].text).toContain("image/png");
	});

	it("should truncate very long responses", async () => {
		const longBody = JSON.stringify({ data: "x".repeat(100_000) });
		const response: HttpResponse = {
			status: 200,
			statusText: "OK",
			headers: {},
			body: longBody,
			contentType: "application/json",
		};

		const result = await mapResponse(response);
		expect(result.content[0].text).toContain("truncated");
		expect(result.content[0].text.length).toBeLessThan(60_000);
	});

	it("should handle malformed JSON gracefully", async () => {
		const response: HttpResponse = {
			status: 200,
			statusText: "OK",
			headers: {},
			body: "{invalid json",
			contentType: "application/json",
		};

		const result = await mapResponse(response);
		expect(result.content[0].text).toBe("{invalid json");
	});

	it("should slice large arrays with metadata (free tier smart truncation)", async () => {
		const items = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Item ${i}` }));
		const response: HttpResponse = {
			status: 200,
			statusText: "OK",
			headers: {},
			body: JSON.stringify(items),
			contentType: "application/json",
		};

		const result = await mapResponse(response);
		const parsed = JSON.parse(result.content[0].text) as Array<{ id?: number; _meta?: string }>;
		// Free tier default: arraySliceSize=20, so 20 items + 1 meta
		expect(parsed).toHaveLength(21);
		expect(parsed[20]._meta).toContain("showing 20 of 50 items");
	});

	it("should allow Pro tier to override truncation defaults", async () => {
		const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));
		const response: HttpResponse = {
			status: 200,
			statusText: "OK",
			headers: {},
			body: JSON.stringify(items),
			contentType: "application/json",
		};

		const result = await mapResponse(response, {
			smartTruncation: { arraySliceSize: 5 },
		});
		const parsed = JSON.parse(result.content[0].text) as Array<{ id?: number; _meta?: string }>;
		expect(parsed).toHaveLength(6); // 5 items + 1 meta
		expect(parsed[5]._meta).toContain("showing 5 of 50 items");
	});
});
