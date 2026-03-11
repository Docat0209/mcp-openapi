import { HttpRequestError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import type { PreparedRequest } from "./types.js";

export interface HttpResponse {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: string;
	contentType: string;
}

export interface HttpClientOptions {
	timeout: number;
	maxRetries: number;
}

const DEFAULT_OPTIONS: HttpClientOptions = {
	timeout: 30_000,
	maxRetries: 3,
};

export async function executeRequest(
	request: PreparedRequest,
	options: HttpClientOptions = DEFAULT_OPTIONS,
): Promise<HttpResponse> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
		try {
			const response = await fetch(request.url, {
				method: request.method,
				headers: request.headers,
				body: request.body ? JSON.stringify(request.body) : undefined,
				signal: AbortSignal.timeout(options.timeout),
			});

			const contentType = response.headers.get("content-type") ?? "";
			const body = await response.text();
			const responseHeaders: Record<string, string> = {};
			response.headers.forEach((value, key) => {
				responseHeaders[key] = value;
			});

			// Retry on 429 and 5xx
			if (response.status === 429 || response.status >= 500) {
				if (attempt < options.maxRetries) {
					const retryAfter = response.headers.get("retry-after");
					const delay = retryAfter
						? Number.parseInt(retryAfter, 10) * 1000
						: Math.min(1000 * 2 ** attempt, 10_000);

					logger.debug(
						`Retrying request (attempt ${attempt + 1}/${options.maxRetries}), waiting ${delay}ms`,
					);
					await sleep(delay);
					continue;
				}
			}

			return {
				status: response.status,
				statusText: response.statusText,
				headers: responseHeaders,
				body,
				contentType,
			};
		} catch (error) {
			lastError =
				error instanceof Error ? error : new Error(String(error));

			if (attempt < options.maxRetries) {
				const delay = Math.min(1000 * 2 ** attempt, 10_000);
				logger.debug(
					`Request failed (attempt ${attempt + 1}/${options.maxRetries}): ${lastError.message}`,
				);
				await sleep(delay);
				continue;
			}
		}
	}

	throw new HttpRequestError(
		`Request failed after ${options.maxRetries + 1} attempts: ${lastError?.message ?? "Unknown error"}`,
	);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
