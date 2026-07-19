import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateTools } from "../../src/generator/tool-generator.js";
import { parseSpec } from "../../src/parser/openapi-parser.js";

const FIXTURE_DIR = resolve(import.meta.dirname, "../fixtures");

describe("generateTools", () => {
	it("should generate tools from a parsed spec", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));
		const tools = generateTools(spec);

		expect(tools).toHaveLength(4);
		const names = tools.map((t) => t.name);
		expect(names).toContain("list_pets");
		expect(names).toContain("create_pet");
		expect(names).toContain("get_pet");
		expect(names).toContain("delete_pet");
	});

	it("should generate correct inputSchema for GET with query params", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));
		const tools = generateTools(spec);

		const listPets = tools.find((t) => t.name === "list_pets")!;
		expect(listPets.inputSchema.properties).toHaveProperty("limit");
		expect(listPets.inputSchema.properties).toHaveProperty("offset");
		expect(listPets.inputSchema.required).toBeUndefined(); // no required query params
	});

	it("should flatten request body properties", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));
		const tools = generateTools(spec);

		const createPet = tools.find((t) => t.name === "create_pet")!;
		expect(createPet.inputSchema.properties).toHaveProperty("name");
		expect(createPet.inputSchema.properties).toHaveProperty("tag");
		expect(createPet.inputSchema.required).toContain("name");
	});

	it("should include path params as required", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));
		const tools = generateTools(spec);

		const getPet = tools.find((t) => t.name === "get_pet")!;
		expect(getPet.inputSchema.properties).toHaveProperty("petId");
		expect(getPet.inputSchema.required).toContain("petId");
	});

	it("should set correct endpointRef", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));
		const tools = generateTools(spec);

		const getPet = tools.find((t) => t.name === "get_pet")!;
		expect(getPet.endpointRef.method).toBe("GET");
		expect(getPet.endpointRef.path).toBe("/pets/{petId}");
		expect(getPet.endpointRef.baseUrl).toBe("https://petstore.example.com/v1");
	});

	it("should apply include filter", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));
		const tools = generateTools(spec, { include: ["listPets", "getPet"] });

		expect(tools).toHaveLength(2);
		expect(tools.map((t) => t.name)).toEqual(
			expect.arrayContaining(["list_pets", "get_pet"]),
		);
	});

	it("should apply exclude filter", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));
		const tools = generateTools(spec, { exclude: ["deletePet"] });

		expect(tools).toHaveLength(3);
		expect(tools.map((t) => t.name)).not.toContain("delete_pet");
	});

	it("should apply prefix", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));
		const tools = generateTools(spec, { prefix: "store" });

		for (const tool of tools) {
			expect(tool.name).toMatch(/^store_/);
		}
	});

	it("should override baseUrl", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));
		const tools = generateTools(spec, {
			baseUrl: "http://localhost:8080",
		});

		for (const tool of tools) {
			expect(tool.endpointRef.baseUrl).toBe("http://localhost:8080");
		}
	});

	it("should generate a tool from Xquik OpenAPI 3.1 fixture", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "xquik-openapi31.json"));
		const tools = generateTools(spec);

		expect(tools).toHaveLength(1);
		const searchTool = tools[0];
		expect(searchTool.name).toBe("search_tweets");
		expect(searchTool.description).toBe(
			"Search X posts [GET /api/v1/x/tweets/search]",
		);
		expect(searchTool.inputSchema.properties).toHaveProperty("q");
		expect(searchTool.inputSchema.properties).toHaveProperty("limit");
		expect(searchTool.inputSchema.required).toContain("q");
		expect(searchTool.endpointRef.baseUrl).toBe("https://xquik.com");
		expect(searchTool.endpointRef.method).toBe("GET");
	});
});
