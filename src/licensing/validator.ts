import { createVerify } from "node:crypto";
import type { LicenseInfo, ProFeature } from "./types.js";

// Ed25519 public key for license verification
// Private key is kept in Lemon Squeezy webhook handler only
const PUBLIC_KEY =
	"MCowBQYDK2VwAyEAPlaceholderKeyWillBeReplacedBeforeFirstProRelease=";

export function validateLicense(
	licenseKey: string,
): LicenseInfo | null {
	try {
		const decoded = Buffer.from(licenseKey, "base64").toString("utf-8");
		const payload = JSON.parse(decoded) as LicenseInfo;

		// Check expiry
		if (new Date(payload.expiresAt) < new Date()) {
			return null;
		}

		// Verify signature
		const dataToVerify = JSON.stringify({
			email: payload.email,
			features: payload.features,
			expiresAt: payload.expiresAt,
		});

		const verify = createVerify("Ed25519");
		verify.update(dataToVerify);
		const isValid = verify.verify(
			`-----BEGIN PUBLIC KEY-----\n${PUBLIC_KEY}\n-----END PUBLIC KEY-----`,
			payload.sig,
			"hex",
		);

		return isValid ? payload : null;
	} catch {
		return null;
	}
}

export function hasFeature(
	license: LicenseInfo | null,
	feature: ProFeature,
): boolean {
	if (!license) return false;
	return license.features.includes(feature);
}
