import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSpec } from "../../src/parser/openapi-parser.js";

const FIXTURE_DIR = resolve(import.meta.dirname, "../fixtures");

describe("parseSpec", () => {
	it("should parse a v3 spec and return normalized endpoints", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));

		expect(spec.info.title).toBe("Petstore");
		expect(spec.info.version).toBe("1.0.0");
		expect(spec.servers).toHaveLength(1);
		expect(spec.servers[0].url).toBe("https://petstore.example.com/v1");
	});

	it("should extract all endpoints", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));

		expect(spec.endpoints).toHaveLength(4);

		const ops = spec.endpoints.map((e) => e.operationId);
		expect(ops).toContain("listPets");
		expect(ops).toContain("createPet");
		expect(ops).toContain("getPet");
		expect(ops).toContain("deletePet");
	});

	it("should normalize parameters correctly", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));

		const listPets = spec.endpoints.find((e) => e.operationId === "listPets")!;
		expect(listPets.parameters).toHaveLength(2);

		const limitParam = listPets.parameters.find((p) => p.name === "limit")!;
		expect(limitParam.in).toBe("query");
		expect(limitParam.required).toBe(false);
		expect(limitParam.schema.type).toBe("integer");
	});

	it("should normalize request body", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));

		const createPet = spec.endpoints.find((e) => e.operationId === "createPet")!;
		expect(createPet.requestBody).toBeDefined();
		expect(createPet.requestBody!.required).toBe(true);
		expect(createPet.requestBody!.contentType).toBe("application/json");
		expect(createPet.requestBody!.schema.properties).toHaveProperty("name");
	});

	it("should normalize path parameters", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));

		const getPet = spec.endpoints.find((e) => e.operationId === "getPet")!;
		const petIdParam = getPet.parameters.find((p) => p.name === "petId")!;
		expect(petIdParam.in).toBe("path");
		expect(petIdParam.required).toBe(true);
	});

	it("should extract security schemes", async () => {
		const spec = await parseSpec(resolve(FIXTURE_DIR, "petstore-v3.json"));

		expect(spec.securitySchemes).toHaveProperty("bearerAuth");
		expect(spec.securitySchemes).toHaveProperty("apiKeyAuth");
		expect(spec.securitySchemes.bearerAuth).toEqual({
			type: "http",
			scheme: "bearer",
			bearerFormat: undefined,
		});
	});
});
