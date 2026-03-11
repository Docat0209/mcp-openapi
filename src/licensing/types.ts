export enum ProFeature {
	MULTI_API = "multi-api",
	SMART_RESPONSE = "smart-response",
	CUSTOM_TRANSFORMS = "custom-transforms",
	ANALYTICS = "analytics",
}

export interface LicenseInfo {
	email: string;
	features: ProFeature[];
	expiresAt: string; // ISO 8601
	sig: string; // Ed25519 signature (hex)
}

export class ProFeatureError extends Error {
	constructor(feature: ProFeature) {
		super(
			`Pro feature "${feature}" requires a license key. Get one at https://github.com/Docat0209/mcp-openapi#pro`,
		);
		this.name = "ProFeatureError";
	}
}
