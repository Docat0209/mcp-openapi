export interface PreparedRequest {
	url: string;
	method: string;
	headers: Record<string, string>;
	query: Record<string, string>;
	body?: unknown;
}
