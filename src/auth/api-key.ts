import type { PreparedRequest } from "../executor/types.js";
import type { AuthProvider } from "./types.js";

export class ApiKeyAuth implements AuthProvider {
	constructor(
		private readonly name: string,
		private readonly value: string,
		private readonly location: "header" | "query",
	) {}

	async apply(request: PreparedRequest): Promise<PreparedRequest> {
		if (this.location === "header") {
			return {
				...request,
				headers: { ...request.headers, [this.name]: this.value },
			};
		}
		return {
			...request,
			query: { ...request.query, [this.name]: this.value },
		};
	}
}
