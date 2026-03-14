# Privacy Policy — mcp-openapi

**Last updated:** 2026-03-14

## Overview

mcp-openapi is a local tool that converts OpenAPI/Swagger specifications into MCP tools for Claude Desktop. It runs entirely on your machine.

## Data Handling

- **No data collection.** mcp-openapi does not collect, store, or transmit any user data.
- **No analytics or telemetry.** There are no tracking mechanisms of any kind.
- **No third-party data sharing.** Your API requests, responses, and credentials are never sent to any third party.

## Network Connections

mcp-openapi makes network requests to exactly two destinations, both specified by you:

1. **Your OpenAPI spec URL** — to fetch the API specification document.
2. **Your API's endpoints** — to execute API calls on your behalf when Claude invokes a tool.

All network traffic goes directly from your machine to the URLs you configure. There are no intermediary servers.

## Credentials

If you provide an API key or Bearer token, it is stored locally by Claude Desktop and passed to mcp-openapi at runtime via environment variables. The credential is only used in the `Authorization` header of requests to your specified API. It is never logged, persisted to disk by mcp-openapi, or transmitted elsewhere.

## Open Source

mcp-openapi is open source under the MIT license. You can audit the complete source code at:
https://github.com/Docat0209/mcp-openapi

## Contact

For privacy concerns, open an issue at:
https://github.com/Docat0209/mcp-openapi/issues
