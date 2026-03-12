FROM node:22-slim
WORKDIR /app
RUN npm install -g mcp-openapi@latest
ENTRYPOINT ["mcp-openapi"]
