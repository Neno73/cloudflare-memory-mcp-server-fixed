# 🧠 Enhanced AI Memory MCP Server - FIXED

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/)
[![MCP](https://img.shields.io/badge/MCP-1.0-blue)](https://modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)

> **Fixed version** of the Enhanced Memory MCP Server that resolves SQL parameter binding issues in the original implementation.

## 🚨 Problem Solved

The original Enhanced Memory MCP Server was experiencing **"Wrong number of parameter bindings for SQL query"** errors across multiple functions. This repository contains the **corrected version** with all SQL parameter binding issues resolved.

### Issues Fixed:
- ✅ **`addMemory()` function**: Fixed SQL INSERT parameter mismatch
- ✅ **`switchProject()` function**: Fixed session update parameter binding
- ✅ **`searchMemories()` function**: Improved dynamic SQL query building
- ✅ **`createMemoryRelationship()` function**: Fixed relationship insert parameters
- ✅ **All SQL queries**: Verified parameter counts match placeholders

## 🎯 Features

- **🔄 Persistent Memory**: Store and retrieve memories with automatic persistence
- **🧮 Vector Embeddings**: Automatic embedding generation using Workers AI (`@cf/baai/bge-base-en-v1.5`)
- **🔍 Semantic Search**: Hybrid vector + SQL search with filtering capabilities
- **📁 Project Organization**: Organize memories by projects and types
- **🔗 Memory Relationships**: Create and manage connections between memories
- **📊 Analytics**: Memory statistics and usage insights
- **🔒 OAuth Security**: Secure authentication (Auth0, Stytch, WorkOS)
- **⚡ Edge Performance**: Global edge deployment with sub-100ms latency

## 🏗️ Architecture

```
Claude.ai ←→ Remote MCP Server ←→ Durable Object (SQLite + Vectorize)
          (SSE + OAuth)        (Stateful Memory + Semantic Search)
```

### Core Components:
1. **Cloudflare Workers**: Serverless compute at global edge locations
2. **Durable Objects**: Stateful SQLite storage for structured memory data
3. **Vectorize**: Vector database for semantic similarity search
4. **Workers AI**: Embedding generation for semantic understanding
5. **OAuth 2.1**: Secure authentication and authorization

## 🚀 Quick Deploy

### Prerequisites
- Cloudflare account with Workers plan
- Node.js 18+ and npm/yarn/pnpm
- Wrangler CLI (`npm install -g wrangler`)

### 1. Clone and Setup
```bash
git clone https://github.com/Neno73/cloudflare-memory-mcp-server-fixed.git
cd cloudflare-memory-mcp-server-fixed
npm install
```

### 2. Create Vectorize Index
```bash
wrangler vectorize create memory-vector-index --dimensions=768
```

### 3. Configure Authentication (Optional)
Choose one authentication provider:

#### Auth0
```bash
wrangler secret put AUTH0_CLIENT_ID
wrangler secret put AUTH0_CLIENT_SECRET  
wrangler secret put AUTH0_DOMAIN
```

#### Stytch
```bash
wrangler secret put STYTCH_PROJECT_ID
wrangler secret put STYTCH_SECRET
```

#### WorkOS
```bash
wrangler secret put WORKOS_CLIENT_ID
wrangler secret put WORKOS_API_KEY
```

### 4. Deploy
```bash
wrangler deploy
```

Your MCP server will be available at: `https://your-worker.workers.dev/sse`

## 🧪 Testing

### Local Development
```bash
npm run dev
```
Server runs at: `http://localhost:8787/sse`

### MCP Inspector
```bash
npx @modelcontextprotocol/inspector
# Enter URL: http://localhost:8787/sse (local) or https://your-worker.workers.dev/sse (deployed)
```

### Connect to Claude.ai
1. Go to Claude.ai → Settings → Integrations
2. Add Custom Integration
3. Enter URL: `https://your-worker.workers.dev/sse`
4. Complete OAuth flow if authentication is enabled

## 🛠️ Available MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `add-memory` | Store new memory with automatic embedding | `content`, `project?`, `type?`, `metadata?` |
| `search-memories` | Semantic search with filtering | `query`, `project?`, `type?`, `limit?`, `include_relationships?` |
| `create-memory-relationship` | Link related memories | `from_memory_id`, `to_memory_id`, `relationship_type`, `strength?` |
| `switch-project` | Change memory context | `project` |
| `get-memory-stats` | View memory analytics | `project?` |

### Example Usage
```javascript
// Add a memory
await addMemory({
  content: "User prefers TypeScript for AI projects",
  project: "development-preferences", 
  type: "preference",
  metadata: { priority: "high", tags: ["typescript", "ai"] }
});

// Search memories
await searchMemories({
  query: "typescript preferences",
  project: "development-preferences",
  limit: 5
});

// Create relationship
await createMemoryRelationship({
  from_memory_id: "memory-1",
  to_memory_id: "memory-2", 
  relationship_type: "relates_to",
  strength: 0.8
});
```

## 📊 Cost Optimization

### Free Tier Limits
- **Durable Objects**: 10GB SQLite storage per object
- **Vectorize**: 10M vector dimensions, 30M queries/month  
- **Workers AI**: 10,000 requests/day
- **Workers**: 100k requests/day

### Production Scaling
- **Hibernation**: Automatic cost reduction during inactivity
- **Global Edge**: Distributed across 275+ locations
- **Auto-scaling**: Handles millions of users seamlessly

## 🔧 Advanced Configuration

### Custom Vector Model
Update `wrangler.toml` to use different embedding models:
```toml
[vars]
EMBEDDING_MODEL = "@cf/baai/bge-large-en-v1.5"  # Larger model for better accuracy
```

### Multiple Projects
Organize memories by projects:
```javascript
await switchProject({ project: "work-memories" });
await addMemory({ content: "Team meeting notes...", type: "note" });

await switchProject({ project: "personal-memories" });  
await addMemory({ content: "Personal reminder...", type: "reminder" });
```

### Memory Relationships
Build knowledge graphs:
```javascript
// Create hierarchical relationships
await createMemoryRelationship({
  from_memory_id: "parent-concept",
  to_memory_id: "sub-concept", 
  relationship_type: "depends_on"
});

// Create contradictory relationships  
await createMemoryRelationship({
  from_memory_id: "old-approach",
  to_memory_id: "new-approach",
  relationship_type: "contradicts"
});
```

## 🔍 SQL Fixes Detailed

### Original Problem
```sql
-- BROKEN: 7 placeholders, 6 parameters
INSERT INTO memories (id, user_id, content, embedding_id, project, memory_type, metadata)
VALUES (?, ?, ?, ?, ?, ?, ?)  
-- Parameters: [memoryId, userId, content, embeddingId, project, type]
```

### Fixed Version
```sql
-- FIXED: 7 placeholders, 7 parameters  
INSERT INTO memories (id, user_id, content, embedding_id, project, memory_type, metadata, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
-- Parameters: [memoryId, userId, content, embeddingId, project, type, JSON.stringify(metadata)]
```

### Key Fixes:
1. **Parameter Count Matching**: Ensured all `?` placeholders have corresponding parameters
2. **Metadata Serialization**: Properly serialize metadata objects with `JSON.stringify()`
3. **Dynamic Query Building**: Fixed dynamic SQL generation for search with IN clauses
4. **Default Values**: Use SQL defaults where appropriate instead of manual parameters

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`  
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/Neno73/cloudflare-memory-mcp-server-fixed/issues)
- **Documentation**: [Cloudflare MCP Docs](https://developers.cloudflare.com/agents/model-context-protocol/)
- **Community**: [MCP Discord](https://discord.gg/modelcontextprotocol)

## 🙏 Acknowledgments

- **Anthropic**: For creating the Model Context Protocol
- **Cloudflare**: For the excellent developer platform
- **Original MCP Template**: Based on Cloudflare's official MCP templates

---

**⚡ Ready to give your AI persistent memory? Deploy this fixed version today!**
