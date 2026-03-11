import type { HttpResponse } from "./http-client.js";

export interface McpToolResult {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
}

const MAX_RESPONSE_LENGTH = 50_000; // ~50KB text limit for LLM context friendliness

export function mapResponse(response: HttpResponse): McpToolResult {
	// HTTP error
	if (response.status >= 400) {
		const body = truncate(response.body, 2000);
		return {
			content: [
				{
					type: "text",
					text: `HTTP Error ${response.status} ${response.statusText}\n\n${body}`,
				},
			],
			isError: true,
		};
	}

	// JSON response — pretty print
	if (response.contentType.includes("application/json")) {
		try {
			const parsed = JSON.parse(response.body);
			const formatted = JSON.stringify(parsed, null, 2);
			return {
				content: [{ type: "text", text: truncate(formatted, MAX_RESPONSE_LENGTH) }],
			};
		} catch {
			// Not valid JSON despite content type — return raw
			return {
				content: [{ type: "text", text: truncate(response.body, MAX_RESPONSE_LENGTH) }],
			};
		}
	}

	// Text response
	if (
		response.contentType.includes("text/") ||
		response.contentType.includes("xml")
	) {
		return {
			content: [{ type: "text", text: truncate(response.body, MAX_RESPONSE_LENGTH) }],
		};
	}

	// Binary response
	return {
		content: [
			{
				type: "text",
				text: `[Binary response: ${response.contentType}, ${response.body.length} bytes, HTTP ${response.status}]`,
			},
		],
	};
}

function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength)}\n\n... [truncated, ${text.length - maxLength} characters omitted]`;
}
