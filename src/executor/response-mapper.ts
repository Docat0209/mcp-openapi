import type { HttpResponse } from "./http-client.js";
import {
	applyJmesPath,
	smartTruncate,
	type TransformOptions,
} from "./response-transform.js";

export interface McpToolResult {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
}

export interface MapResponseOptions {
	/** JMESPath expression to filter response data */
	jmesPath?: string;
	/** Smart truncation options (Pro feature) */
	smartTruncation?: TransformOptions;
}

const MAX_RESPONSE_LENGTH = 50_000;

export async function mapResponse(
	response: HttpResponse,
	options?: MapResponseOptions,
): Promise<McpToolResult> {
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

	// JSON response — apply transforms then truncate
	if (response.contentType.includes("application/json")) {
		try {
			let parsed = JSON.parse(response.body);

			// Apply JMESPath transform if configured (Pro)
			if (options?.jmesPath) {
				parsed = await applyJmesPath(parsed, options.jmesPath);
			}

			// Use smart truncation if configured (Pro), else hard truncate
			if (options?.smartTruncation) {
				const text = smartTruncate(parsed, options.smartTruncation);
				return { content: [{ type: "text", text }] };
			}

			const formatted = JSON.stringify(parsed, null, 2);
			return {
				content: [
					{ type: "text", text: truncate(formatted, MAX_RESPONSE_LENGTH) },
				],
			};
		} catch {
			return {
				content: [
					{
						type: "text",
						text: truncate(response.body, MAX_RESPONSE_LENGTH),
					},
				],
			};
		}
	}

	// Text response
	if (
		response.contentType.includes("text/") ||
		response.contentType.includes("xml")
	) {
		return {
			content: [
				{ type: "text", text: truncate(response.body, MAX_RESPONSE_LENGTH) },
			],
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
