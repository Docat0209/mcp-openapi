import type { AuthConfig } from "../config/types.js";
import { logger } from "../utils/logger.js";
import { ApiKeyAuth } from "./api-key.js";
import { BearerAuth } from "./bearer.js";
import { OAuth2Auth } from "./oauth2.js";
import type { AuthProvider } from "./types.js";

/**
 * Resolve environment variable references in auth values.
 * Values starting with $ are treated as env var names.
 */
function resolveEnvVar(value: string): string {
	if (value.startsWith("$")) {
		const envName = value.slice(1);
		const envValue = process.env[envName];
		if (!envValue) {
			logger.warn(`Environment variable ${envName} is not set`);
			return "";
		}
		return envValue;
	}
	return value;
}

export function createAuthProvider(config?: AuthConfig): AuthProvider | null {
	if (!config) return null;

	switch (config.type) {
		case "api-key":
			return new ApiKeyAuth(config.name, resolveEnvVar(config.value), config.in);
		case "bearer":
			return new BearerAuth(resolveEnvVar(config.token));
		case "oauth2":
			return new OAuth2Auth(
				resolveEnvVar(config.clientId),
				resolveEnvVar(config.clientSecret),
				config.tokenUrl,
				config.scopes,
			);
		default:
			logger.warn("Unknown auth type, skipping auth");
			return null;
	}
}
