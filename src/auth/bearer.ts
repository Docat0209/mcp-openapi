import type { PreparedRequest } from "../executor/types.js";
import type { AuthProvider } from "./types.js";

export class BearerAuth implements AuthProvider {
	constructor(private readonly token: string) {}

	async apply(request: PreparedRequest): Promise<PreparedRequest> {
		return {
			...request,
			headers: {
				...request.headers,
				Authorization: `Bearer ${this.token}`,
			},
		};
	}
}
