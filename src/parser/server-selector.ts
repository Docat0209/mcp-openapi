import type { NormalizedSpec } from "./types.js";
import { logger } from "../utils/logger.js";

/**
 * Select a server URL from the spec's servers array.
 * @param selector - Index number (string), partial URL match, or exact URL
 * @param spec - The parsed OpenAPI spec
 * @returns The selected server URL
 */
export function selectServer(selector: string, spec: NormalizedSpec): string {
	const servers = spec.servers;

	if (servers.length === 0) {
		logger.warn("No servers defined in spec, using http://localhost");
		return "http://localhost";
	}

	// Try numeric index first
	const index = Number(selector);
	if (!Number.isNaN(index) && Number.isInteger(index)) {
		if (index >= 0 && index < servers.length) {
			logger.info(`Using server [${index}]: ${servers[index].url}`);
			return servers[index].url;
		}
		printAvailableServers(servers);
		throw new Error(
			`Server index ${index} out of range. Available: 0-${servers.length - 1}`,
		);
	}

	// Try exact URL match
	const exact = servers.find((s) => s.url === selector);
	if (exact) {
		logger.info(`Using server (exact match): ${exact.url}`);
		return exact.url;
	}

	// Try partial URL match
	const partial = servers.filter((s) =>
		s.url.toLowerCase().includes(selector.toLowerCase()),
	);
	if (partial.length === 1) {
		logger.info(`Using server (partial match "${selector}"): ${partial[0].url}`);
		return partial[0].url;
	}
	if (partial.length > 1) {
		printAvailableServers(servers);
		throw new Error(
			`Ambiguous server selector "${selector}" matched ${partial.length} servers. Be more specific.`,
		);
	}

	// No match
	printAvailableServers(servers);
	throw new Error(`No server matching "${selector}" found.`);
}

function printAvailableServers(servers: Array<{ url: string }>): void {
	logger.error("Available servers:");
	for (let i = 0; i < servers.length; i++) {
		logger.error(`  [${i}] ${servers[i].url}`);
	}
}
