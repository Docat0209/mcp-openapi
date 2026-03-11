#!/usr/bin/env node

import { parseCliArgs, loadConfigFile, mergeConfigs } from "../src/config/cli-args.js";
import type { McpOpenApiConfig } from "../src/config/types.js";
import { startServer } from "../src/server.js";
import { logger } from "../src/utils/logger.js";

async function main() {
	try {
		let config = parseCliArgs(process.argv);

		// Load config file if specified
		const configWithExtra = config as McpOpenApiConfig & { config?: string };
		if (configWithExtra.config) {
			const fileConfig = await loadConfigFile(configWithExtra.config);
			config = mergeConfigs(fileConfig, config);
		}

		if (!config.spec) {
			logger.error("Missing required --spec argument. Use --help for usage.");
			process.exit(1);
		}

		await startServer(config);
	} catch (error) {
		logger.error(
			error instanceof Error ? error.message : String(error),
		);
		process.exit(1);
	}
}

main();
