import type { PreparedRequest } from "../executor/types.js";

export interface AuthProvider {
	apply(request: PreparedRequest): Promise<PreparedRequest>;
}
