# mcp-openapi

> Turn any OpenAPI/Swagger spec into MCP tools — so Claude and other AI assistants can call your REST APIs.

[![npm version](https://img.shields.io/npm/v/mcp-openapi.svg)](https://www.npmjs.com/package/mcp-openapi)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/mcp-openapi.svg)](https://www.npmjs.com/package/mcp-openapi)

Point `mcp-openapi` at any OpenAPI 3.x or Swagger 2.0 spec URL and it generates [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) tools automatically. No code generation, no config files, no boilerplate. Your AI assistant gets callable tools for every API endpoint in seconds.

---

## Quick Start

**1. Run it** (no install required):

```bash
npx mcp-openapi --spec https://petstore3.swagger.io/api/v3/openapi.json
```

**2. Add it to Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "petstore": {
      "command": "npx",
      "args": [
        "mcp-openapi",
        "--spec", "https://petstore3.swagger.io/api/v3/openapi.json"
      ]
    }
  }
}
```

**3. Ask Claude to use it:**

> "List all available pets in the store"

Claude sees MCP tools like `find_pets_by_status`, `get_pet_by_id`, `add_pet` and calls them directly.

---

## Why mcp-openapi?

Most MCP-to-API bridges require you to write tool definitions by hand or generate code from a spec. `mcp-openapi` skips all of that.

| Feature | mcp-openapi | Hand-written MCP servers | Generic HTTP tools |
|---------|:-----------:|:------------------------:|:------------------:|
| Zero config setup | Yes | No | Partial |
| OpenAPI 3.x + Swagger 2.0 | Yes | N/A | N/A |
| Flat parameter schemas (LLM-optimized) | Yes | Manual | No |
| Smart tool naming from operationId | Yes | Manual | No |
| Auth (API key, Bearer, OAuth2) | Built-in | DIY | DIY |
| Retry with exponential backoff | Built-in | DIY | DIY |
| Response truncation for LLM context | Built-in | DIY | No |

**Flat parameter schemas** are the key differentiator. Instead of passing nested JSON objects (which LLMs frequently get wrong), `mcp-openapi` flattens path, query, header, and body parameters into a single flat object. This dramatically improves tool-calling accuracy.

---

## How It Works

```
OpenAPI/Swagger Spec          mcp-openapi               AI Assistant
     (URL or file)                                      (Claude, etc.)
          |                         |                         |
          |   1. Parse & validate   |                         |
          |------------------------>|                         |
          |                         |                         |
          |   2. Generate MCP tools |                         |
          |   (one per endpoint)    |                         |
          |------------------------>|                         |
          |                         |                         |
          |                         |   3. Register tools     |
          |                         |   via stdio transport   |
          |                         |------------------------>|
          |                         |                         |
          |                         |   4. AI calls a tool    |
          |                         |<------------------------|
          |                         |                         |
          |   5. Build & execute    |                         |
          |   HTTP request          |                         |
          |<------------------------|                         |
          |                         |                         |
          |   6. Return truncated   |                         |
          |   response to AI        |                         |
          |------------------------>|------------------------>|
```

Each API endpoint becomes one MCP tool:
- **Tool name** is derived from `operationId` (converted to `snake_case`) or from `method + path`
- **Parameters** are flattened into a single input schema (path, query, header, and body params merged)
- **Responses** are truncated to ~50KB to stay within LLM context limits
- **Errors** (429, 5xx) trigger automatic retries with exponential backoff (up to 3 retries)

---

## Claude Desktop Integration

Add any API to Claude Desktop by editing your config file:

**Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### Public API (no auth)

```json
{
  "mcpServers": {
    "petstore": {
      "command": "npx",
      "args": [
        "mcp-openapi",
        "--spec", "https://petstore3.swagger.io/api/v3/openapi.json"
      ]
    }
  }
}
```

### API with Bearer Token

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": [
        "mcp-openapi",
        "--spec", "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json",
        "--auth-type", "bearer",
        "--auth-token", "$GITHUB_TOKEN",
        "--prefix", "github",
        "--include", "listReposForAuthenticatedUser,getRepo,listIssues,createIssue"
      ],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

### API with API Key

```json
{
  "mcpServers": {
    "weather": {
      "command": "npx",
      "args": [
        "mcp-openapi",
        "--spec", "https://api.weather.example.com/openapi.json",
        "--auth-type", "api-key",
        "--auth-name", "X-API-Key",
        "--auth-value", "$WEATHER_API_KEY",
        "--auth-in", "header"
      ],
      "env": {
        "WEATHER_API_KEY": "your_key_here"
      }
    }
  }
}
```

---

## CLI Reference

```bash
npx mcp-openapi --spec <url-or-path> [options]
```

### General Options

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--spec <url\|path>` | `-s` | *required* | OpenAPI spec URL or local file path |
| `--config <path>` | `-c` | | JSON config file path |
| `--base-url <url>` | | from spec | Override the API base URL |
| `--prefix <name>` | | | Prefix for all tool names (e.g. `github` -> `github_list_repos`) |
| `--include <patterns>` | | all | Comma-separated operationIds to include |
| `--exclude <patterns>` | | none | Comma-separated operationIds to exclude |
| `--timeout <ms>` | | `30000` | HTTP request timeout in milliseconds |
| `--max-retries <n>` | | `3` | Max retries on 429/5xx responses |
| `--header <name:value>` | `-H` | | Custom header (repeatable) |
| `--transport <type>` | | `stdio` | Transport type: `stdio` or `sse` |
| `--port <n>` | | `3000` | Port for SSE transport |
| `--help` | `-h` | | Show help |
| `--version` | `-v` | | Show version |
| `--license-key <key>` | | | Pro license key (or `$MCP_OPENAPI_LICENSE_KEY` env) |

### Auth Options

**Bearer token:**

| Option | Description |
|--------|-------------|
| `--auth-type bearer` | Use Bearer token authentication |
| `--auth-token <token>` | The token value (supports `$ENV_VAR` syntax) |

**API key:**

| Option | Description |
|--------|-------------|
| `--auth-type api-key` | Use API key authentication |
| `--auth-name <name>` | Header or query parameter name |
| `--auth-value <value>` | The API key value (supports `$ENV_VAR` syntax) |
| `--auth-in <header\|query>` | Where to send the key (default: `header`) |

**OAuth2 client credentials:**

| Option | Description |
|--------|-------------|
| `--auth-type oauth2` | Use OAuth2 client credentials flow |
| `--auth-client-id <id>` | OAuth2 client ID |
| `--auth-client-secret <secret>` | OAuth2 client secret |
| `--auth-token-url <url>` | Token endpoint URL |
| `--auth-scopes <scopes>` | Comma-separated scopes |

---

## CLI Examples

```bash
# Basic usage with a remote spec
npx mcp-openapi --spec https://petstore3.swagger.io/api/v3/openapi.json

# Local YAML spec with Bearer auth
npx mcp-openapi --spec ./api.yaml --auth-type bearer --auth-token '$API_KEY'

# Filter to specific endpoints with a prefix
npx mcp-openapi --spec ./api.json --prefix myapi --include 'listUsers,getUser'

# Override base URL (useful for local dev)
npx mcp-openapi --spec https://api.example.com/openapi.json --base-url http://localhost:3000

# Add custom headers
npx mcp-openapi --spec ./api.json -H 'X-Custom: value' -H 'X-Another: value2'

# Use a JSON config file
npx mcp-openapi --config ./mcp-config.json
```

### Config File Format

Instead of CLI flags, you can use a JSON config file:

```json
{
  "spec": "https://api.example.com/openapi.json",
  "prefix": "myapi",
  "include": ["listUsers", "getUser", "createUser"],
  "auth": {
    "type": "bearer",
    "token": "$API_TOKEN"
  },
  "timeout": 15000,
  "maxRetries": 2,
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

CLI arguments take precedence over config file values.

---

## Supported Specs

| Format | Versions | File types |
|--------|----------|------------|
| OpenAPI | 3.0.x, 3.1.x | `.json`, `.yaml`, `.yml` |
| Swagger | 2.0 | `.json`, `.yaml`, `.yml` |

Specs can be loaded from:
- Remote URLs (`https://...`)
- Local file paths (`./api.yaml`, `/absolute/path/spec.json`)

---

## Pro Features (v0.2.0+)

`mcp-openapi` includes optional Pro features for teams and power users, gated by a license key.

### Custom Response Transforms

Shape API responses with [JMESPath](https://jmespath.org/) expressions before they reach the LLM — reducing token usage and improving accuracy:

```json
{
  "spec": "https://api.github.com/openapi.json",
  "licenseKey": "$MCP_OPENAPI_LICENSE_KEY",
  "transforms": {
    "list_repos": "data[].{name: name, stars: stargazers_count, url: html_url}",
    "list_*": "data[].{id: id, name: name}"
  }
}
```

### Smart Response Handling

Instead of hard-truncating large responses at 50KB, Pro enables intelligent truncation:

- **Array slicing**: Large arrays show first N items + metadata (`"showing 10 of 847 items"`)
- **Depth pruning**: Deep nested objects are summarized beyond a configurable depth
- **Structure preservation**: You always see the shape of the data, never a mid-JSON cut

```json
{
  "spec": "./api.json",
  "licenseKey": "$MCP_OPENAPI_LICENSE_KEY",
  "response": {
    "maxLength": 50000,
    "arraySliceSize": 10,
    "maxDepth": 4
  }
}
```

### Coming Soon

- **Multi-API Composition** — Load multiple OpenAPI specs into one MCP session
- **Usage Analytics** — Track tool calls, latency, and error rates

> Interested in Pro? Star the repo and [open an issue](https://github.com/Docat0209/mcp-openapi/issues) to get early access.

---

## Programmatic Usage

You can also use `mcp-openapi` as a library in your own MCP server:

```typescript
import { createServer } from 'mcp-openapi';

const { server, tools, spec } = await createServer({
  spec: 'https://petstore3.swagger.io/api/v3/openapi.json',
  prefix: 'petstore',
  auth: {
    type: 'bearer',
    token: process.env.API_TOKEN,
  },
});

console.log(`Loaded ${tools.length} tools from ${spec.info.title}`);
```

---

## Requirements

- Node.js 18 or later
- An OpenAPI 3.x or Swagger 2.0 spec (URL or local file)

---

## Contributing

Contributions are welcome. Here is how to get started:

```bash
git clone https://github.com/Docat0209/mcp-openapi.git
cd mcp-openapi
pnpm install
pnpm test
pnpm build
```

Before submitting a PR:
1. Add tests for new features
2. Run `pnpm lint` and fix any issues
3. Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages

---

## License

MIT

---

## Keywords

mcp, model-context-protocol, openapi, swagger, claude, ai, llm, api, tools, rest-api, ai-tools, mcp-server

---

## Articles

- [I Made Claude Call Any REST API in 30 Seconds — Zero Code, Just One Command](https://dev.to/docat0209/i-made-claude-call-any-rest-api-in-30-seconds-zero-code-just-one-command-4jfo)
- [Why LLMs Suck at Calling APIs (And How Flat Schemas Fix It)](https://dev.to/docat0209/why-llms-suck-at-calling-apis-and-how-flat-schemas-fix-it-o0j)
