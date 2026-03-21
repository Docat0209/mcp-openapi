export { createServer, startServer } from "./server.js";
export type { McpOpenApiConfig, AuthConfig } from "./config/types.js";
export { generateTools, generateToolsWithTags } from "./generator/tool-generator.js";
export type { GeneratedTool, GenerateResult } from "./generator/tool-generator.js";
export { parseSpec } from "./parser/openapi-parser.js";
export type { NormalizedSpec } from "./parser/types.js";
export { selectServer } from "./parser/server-selector.js";
export { checkDocQuality } from "./generator/doc-warnings.js";
export { buildDiscovery, shouldEnableDiscovery, handleMetaToolCall } from "./generator/dynamic-discovery.js";
export type { DiscoveryResult } from "./generator/dynamic-discovery.js";

// Smithery.ai deployment adapter
export { default, configSchema, createSandboxServer } from "./smithery.js";
