import { readFile } from "node:fs/promises";
import { SpecLoadError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface LoadedSpec {
	content: string;
	format: "json" | "yaml";
}

function isUrl(input: string): boolean {
	return input.startsWith("http://") || input.startsWith("https://");
}

function detectFormat(input: string, content: string): "json" | "yaml" {
	if (input.endsWith(".json")) return "json";
	if (input.endsWith(".yaml") || input.endsWith(".yml")) return "yaml";
	// Try to detect from content
	const trimmed = content.trimStart();
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
	return "yaml";
}

export async function loadSpec(input: string): Promise<LoadedSpec> {
	if (isUrl(input)) {
		return loadFromUrl(input);
	}
	return loadFromFile(input);
}

async function loadFromUrl(url: string): Promise<LoadedSpec> {
	logger.info(`Fetching spec from ${url}`);
	try {
		const response = await fetch(url, {
			headers: { Accept: "application/json, application/yaml, text/yaml, */*" },
			signal: AbortSignal.timeout(30_000),
		});

		if (!response.ok) {
			throw new SpecLoadError(
				`Failed to fetch spec: ${response.status} ${response.statusText}`,
			);
		}

		const content = await response.text();
		return { content, format: detectFormat(url, content) };
	} catch (error) {
		if (error instanceof SpecLoadError) throw error;
		throw new SpecLoadError(
			`Failed to fetch spec from ${url}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

async function loadFromFile(filePath: string): Promise<LoadedSpec> {
	logger.info(`Reading spec from ${filePath}`);
	try {
		const content = await readFile(filePath, "utf-8");
		return { content, format: detectFormat(filePath, content) };
	} catch (error) {
		throw new SpecLoadError(
			`Failed to read spec file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}
