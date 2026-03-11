import { describe, expect, it } from "vitest";
import {
	smartTruncate,
	findTransform,
	applyJmesPath,
} from "../../src/executor/response-transform.js";

describe("smartTruncate", () => {
	it("should pass through small data unchanged", () => {
		const data = { id: 1, name: "test" };
		const result = smartTruncate(data);
		expect(JSON.parse(result)).toEqual(data);
	});

	it("should slice large arrays with metadata", () => {
		const data = Array.from({ length: 50 }, (_, i) => ({ id: i }));
		const result = smartTruncate(data, { arraySliceSize: 5 });
		const parsed = JSON.parse(result) as Array<{ id?: number; _meta?: string }>;
		expect(parsed).toHaveLength(6); // 5 items + 1 meta
		expect(parsed[5]._meta).toContain("showing 5 of 50 items");
	});

	it("should prune deep objects at max depth", () => {
		const data = {
			level1: {
				level2: {
					level3: {
						deep: { value: "hidden" },
						array: [1, 2, 3],
						simple: "visible",
					},
				},
			},
		};
		const result = smartTruncate(data, { maxDepth: 3 });
		const parsed = JSON.parse(result) as Record<string, unknown>;
		const level3 = (parsed.level1 as Record<string, unknown>).level2 as Record<string, unknown>;
		const pruned = level3.level3 as Record<string, string>;
		expect(pruned.deep).toBe("[object(1 keys)]");
		expect(pruned.array).toBe("[array(3)]");
		expect(pruned.simple).toBe("visible");
	});

	it("should hard truncate if still too long after pruning", () => {
		const data = { text: "x".repeat(100_000) };
		const result = smartTruncate(data, { maxLength: 1000 });
		expect(result.length).toBeLessThan(1100);
		expect(result).toContain("truncated");
	});
});

describe("findTransform", () => {
	const transforms = {
		get_user: "{ id: id, name: name }",
		"list_*": "data[].{ id: id }",
		"github_*_repos": "items[].full_name",
	};

	it("should match exact tool name", () => {
		expect(findTransform("get_user", transforms)).toBe("{ id: id, name: name }");
	});

	it("should match glob pattern", () => {
		expect(findTransform("list_users", transforms)).toBe("data[].{ id: id }");
		expect(findTransform("list_repos", transforms)).toBe("data[].{ id: id }");
	});

	it("should match complex glob", () => {
		expect(findTransform("github_search_repos", transforms)).toBe("items[].full_name");
	});

	it("should return undefined for no match", () => {
		expect(findTransform("delete_user", transforms)).toBeUndefined();
	});
});

describe("applyJmesPath", () => {
	it("should apply JMESPath expression", async () => {
		const data = {
			items: [
				{ id: 1, name: "a", extra: "x" },
				{ id: 2, name: "b", extra: "y" },
			],
		};
		const result = await applyJmesPath(data, "items[].{id: id, name: name}");
		expect(result).toEqual([
			{ id: 1, name: "a" },
			{ id: 2, name: "b" },
		]);
	});

	it("should handle simple field selection", async () => {
		const data = { user: { name: "test", age: 30 } };
		const result = await applyJmesPath(data, "user.name");
		expect(result).toBe("test");
	});
});
