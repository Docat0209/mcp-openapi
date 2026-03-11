import { AuthError } from "../utils/errors.js";
import type { PreparedRequest } from "../executor/types.js";
import type { AuthProvider } from "./types.js";

export class OAuth2Auth implements AuthProvider {
	private accessToken: string | null = null;
	private expiresAt = 0;

	constructor(
		private readonly clientId: string,
		private readonly clientSecret: string,
		private readonly tokenUrl: string,
		private readonly scopes: string[] = [],
	) {}

	async apply(request: PreparedRequest): Promise<PreparedRequest> {
		const token = await this.getToken();
		return {
			...request,
			headers: {
				...request.headers,
				Authorization: `Bearer ${token}`,
			},
		};
	}

	private async getToken(): Promise<string> {
		if (this.accessToken && Date.now() < this.expiresAt) {
			return this.accessToken;
		}

		const params = new URLSearchParams({
			grant_type: "client_credentials",
			client_id: this.clientId,
			client_secret: this.clientSecret,
		});

		if (this.scopes.length > 0) {
			params.set("scope", this.scopes.join(" "));
		}

		try {
			const response = await fetch(this.tokenUrl, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: params,
				signal: AbortSignal.timeout(10_000),
			});

			if (!response.ok) {
				throw new AuthError(
					`OAuth2 token request failed: ${response.status} ${response.statusText}`,
				);
			}

			const data = (await response.json()) as {
				access_token: string;
				expires_in?: number;
			};

			this.accessToken = data.access_token;
			this.expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000; // refresh 1 min early

			return this.accessToken;
		} catch (error) {
			if (error instanceof AuthError) throw error;
			throw new AuthError(
				`OAuth2 token request failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
