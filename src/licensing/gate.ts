import type { LicenseInfo, ProFeature } from "./types.js";
import { ProFeatureError } from "./types.js";
import { hasFeature } from "./validator.js";

export function requirePro(
	license: LicenseInfo | null,
	feature: ProFeature,
): void {
	if (!hasFeature(license, feature)) {
		throw new ProFeatureError(feature);
	}
}
