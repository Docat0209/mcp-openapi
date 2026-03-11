import { describe, expect, it } from "vitest";
import { generateToolName, resolveCollisions } from "../../src/generator/tool-namer.js";

describe("generateToolName", () => {
	it("should convert camelCase operationId to snake_case", () => {
		expect(generateToolName("listPets", "get", "/pets")).toBe("list_pets");
		expect(generateToolName("createUser", "post", "/users")).toBe("create_user");
		expect(generateToolName("getUserById", "get", "/users/{id}")).toBe(
			"get_user_by_id",
		);
	});

	it("should handle already snake_case operationIds", () => {
		expect(generateToolName("list_pets", "get", "/pets")).toBe("list_pets");
	});

	it("should add prefix", () => {
		expect(generateToolName("listPets", "get", "/pets", "github")).toBe(
			"github_list_pets",
		);
	});

	it("should sanitize special characters", () => {
		expect(generateToolName("list-pets.v2", "get", "/pets")).toBe(
			"list_pets_v2",
		);
	});

	it("should truncate long names to 64 chars", () => {
		const longId = "a".repeat(70);
		const result = generateToolName(longId, "get", "/");
		expect(result.length).toBeLessThanOrEqual(64);
	});
});

describe("resolveCollisions", () => {
	it("should not modify unique names", () => {
		expect(resolveCollisions(["a", "b", "c"])).toEqual(["a", "b", "c"]);
	});

	it("should append suffix for duplicate names", () => {
		expect(resolveCollisions(["get_pets", "get_pets", "get_pets"])).toEqual([
			"get_pets",
			"get_pets_2",
			"get_pets_3",
		]);
	});
});
