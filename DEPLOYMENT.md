# 🚀 Deployment Guide

## Quick Fix Deployment

If you already have a broken memory MCP server, here's how to quickly fix it:

### Option 1: Replace Your Worker Code

1. **Update your existing `src/index.ts`** with the fixed version from this repository
2. **Deploy the update**:
   ```bash
   wrangler deploy
   ```

### Option 2: Deploy Fresh Instance

1. **Clone this repository**:
   ```bash
   git clone https://github.com/Neno73/cloudflare-memory-mcp-server-fixed.git
   cd cloudflare-memory-mcp-server-fixed
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create Vectorize index** (if not exists):
   ```bash
   wrangler vectorize create memory-vector-index --dimensions=768
   ```

4. **Update wrangler.toml** with your index name:
   ```toml
   [vectorize]
   bindings = [
     { binding = "VECTORIZE", index_name = "your-actual-index-name" }
   ]
   ```

5. **Deploy**:
   ```bash
   wrangler deploy
   ```

## What Was Fixed?

### 1. SQL Parameter Binding Issues
**Before (Broken)**:
```typescript
// WRONG: 7 placeholders, 6 parameters
this.sql.exec(
  `INSERT INTO memories (id, user_id, content, embedding_id, project, memory_type, metadata)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [memoryId, userId, content, embeddingId, project, type] // Missing metadata!
);
```

**After (Fixed)**:
```typescript
// CORRECT: 7 placeholders, 7 parameters
this.sql.exec(
  `INSERT INTO memories (id, user_id, content, embedding_id, project, memory_type, metadata, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  [memoryId, userId, content, embeddingId, project, type, JSON.stringify(metadata)]
);
```

### 2. Switch Project Function
**Before (Broken)**:
```typescript
// WRONG: Missing parameters
this.sql.exec(
  `INSERT OR REPLACE INTO user_sessions (user_id, current_project, last_active)
   VALUES (?, ?, CURRENT_TIMESTAMP)`,
  [userId] // Missing project parameter!
);
```

**After (Fixed)**:
```typescript
// CORRECT: All parameters provided
this.sql.exec(
  `INSERT OR REPLACE INTO user_sessions (user_id, current_project, last_active)
   VALUES (?, ?, CURRENT_TIMESTAMP)`,
  [userId, project]
);
```

### 3. Dynamic SQL Query Building
**Before (Broken)**:
```typescript
// WRONG: Placeholder scores not properly handled
const params = include_relationships 
  ? [0, ...memoryIds, 0] // Incorrect parameter structure
  : [0, ...memoryIds, 0];
```

**After (Fixed)**:
```typescript
// CORRECT: Proper parameter mapping
const results = this.sql.exec(sqlQuery, memoryIds).toArray();
// Scores handled separately via scoreMap
```

## Testing the Fix

### 1. Test Memory Storage
```bash
# Should work now (was failing before)
curl -X POST https://your-worker.workers.dev/sse \
  -H "Content-Type: application/json" \
  -d '{
    "method": "add-memory",
    "params": {
      "content": "Test memory for debugging",
      "project": "test-project",
      "type": "test"
    }
  }'
```

### 2. Test Project Switching
```bash
# Should work now (was failing before)
curl -X POST https://your-worker.workers.dev/sse \
  -H "Content-Type: application/json" \
  -d '{
    "method": "switch-project", 
    "params": {
      "project": "new-test-project"
    }
  }'
```

### 3. Verify via MCP Inspector
```bash
npx @modelcontextprotocol/inspector
# Connect to: https://your-worker.workers.dev/sse
# Try all tools - they should work without SQL errors
```

## Debugging Tips

### Check Logs
```bash
wrangler tail
```

### Validate Vectorize Index
```bash
wrangler vectorize list
```

### Test AI Gateway
Check your AI Gateway dashboard for embedding generation requests.

## Production Checklist

- [ ] ✅ Vectorize index created and configured
- [ ] ✅ OAuth authentication configured (optional)
- [ ] ✅ Worker deployed successfully  
- [ ] ✅ All MCP tools tested
- [ ] ✅ Connected to Claude.ai
- [ ] ✅ Memory storage working
- [ ] ✅ Semantic search functioning
- [ ] ✅ No SQL parameter binding errors

## Support

If you encounter any issues after deployment:

1. **Check the logs**: `wrangler tail`
2. **Verify configuration**: Ensure all required services are set up
3. **Test locally first**: `npm run dev` then test with MCP Inspector
4. **Open an issue**: [GitHub Issues](https://github.com/Neno73/cloudflare-memory-mcp-server-fixed/issues)

---

**🎉 Your AI Memory system should now be working perfectly!**
