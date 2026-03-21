import type { GeneratedTool } from "./tool-generator.js";
import { logger } from "../utils/logger.js";

const MIN_DESCRIPTION_LENGTH = 50;

export function checkDocQuality(tools: GeneratedTool[]): void {
	const sparse = tools.filter((t) => {
		// Strip the [METHOD /path] suffix to check actual documentation
		const desc = t.description.replace(/\s*\[.+\]\s*(\(DEPRECATED\))?$/, "").trim();
		return desc.length < MIN_DESCRIPTION_LENGTH;
	});

	if (sparse.length === 0) return;

	const names = sparse.map((t) => t.name);
	const preview = names.length <= 5 ? names.join(", ") : `${names.slice(0, 5).join(", ")}, ...`;

	logger.warn(
		`Doc quality: ${sparse.length} of ${tools.length} tools have sparse documentation (<${MIN_DESCRIPTION_LENGTH} chars)`,
	);
	logger.warn(`  Affected: ${preview}`);
	logger.warn("  LLM accuracy may be reduced for these endpoints.");
}
