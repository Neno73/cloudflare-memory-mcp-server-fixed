import app from "./app";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import OAuthProvider from "@cloudflare/workers-oauth-provider";

// Enhanced Memory MCP Agent with Durable Objects + Vectorize
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "AI Memory System",
		version: "1.0.0",
	});

	// SQLite storage for structured memory data
	sql: SqlStorage;

	async init() {
		// Initialize SQLite schema for memory storage
		this.initializeMemorySchema();

		// Add Memory Tool: Store memories with automatic embedding
		this.server.tool("add-memory", {
			content: z.string().describe("Memory content to store"),
			project: z.string().optional().describe("Project context (default: 'default')"),
			type: z.string().optional().describe("Memory type: preference, decision, knowledge, pattern, etc."),
			metadata: z.object({}).optional().describe("Additional metadata")
		}, async (args) => {
			return await this.addMemory(args);
		});

		// Search Memory Tool: Hybrid semantic + structured search
		this.server.tool("search-memories", {
			query: z.string().describe("Search query for semantic matching"),
			project: z.string().optional().describe("Filter by project"),
			type: z.string().optional().describe("Filter by memory type"),
			limit: z.number().optional().default(10).describe("Maximum results"),
			include_relationships: z.boolean().optional().default(false).describe("Include related memories")
		}, async (args) => {
			return await this.searchMemories(args);
		});

		// Create Memory Relationship Tool: Link related memories
		this.server.tool("create-memory-relationship", {
			from_memory_id: z.string().describe("Source memory ID"),
			to_memory_id: z.string().describe("Target memory ID"),
			relationship_type: z.enum(["influences", "depends_on", "relates_to", "contradicts", "extends"]),
			strength: z.number().min(0).max(1).optional().default(0.5).describe("Relationship strength (0.0-1.0)")
		}, async (args) => {
			return await this.createMemoryRelationship(args);
		});

		// Switch Project Tool: Change memory context
		this.server.tool("switch-project", {
			project: z.string().describe("Project name to switch to")
		}, async (args) => {
			return await this.switchProject(args);
		});

		// Memory Analytics Tool: Get memory statistics
		this.server.tool("get-memory-stats", {
			project: z.string().optional().describe("Filter by project")
		}, async (args) => {
			return await this.getMemoryStats(args);
		});
	}

	// Initialize SQLite schema for memory storage
	private initializeMemorySchema() {
		this.sql = this.ctx.storage.sql;
		
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS memories (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL DEFAULT 'default-user',
				content TEXT NOT NULL,
				embedding_id TEXT,
				project TEXT DEFAULT 'default',
				memory_type TEXT DEFAULT 'general',
				metadata JSON DEFAULT '{}',
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
			);

			CREATE TABLE IF NOT EXISTS memory_relationships (
				id TEXT PRIMARY KEY,
				from_memory_id TEXT NOT NULL,
				to_memory_id TEXT NOT NULL,
				relationship_type TEXT NOT NULL,
				strength REAL DEFAULT 0.5,
				created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (from_memory_id) REFERENCES memories(id),
				FOREIGN KEY (to_memory_id) REFERENCES memories(id)
			);

			CREATE TABLE IF NOT EXISTS user_sessions (
				user_id TEXT PRIMARY KEY,
				current_project TEXT DEFAULT 'default',
				last_active DATETIME DEFAULT CURRENT_TIMESTAMP
			);

			-- Indexes for performance
			CREATE INDEX IF NOT EXISTS idx_memories_user_project 
				ON memories(user_id, project);
			CREATE INDEX IF NOT EXISTS idx_memories_type 
				ON memories(memory_type);
			CREATE INDEX IF NOT EXISTS idx_memories_created 
				ON memories(created_at DESC);
			CREATE INDEX IF NOT EXISTS idx_relationships_from 
				ON memory_relationships(from_memory_id);
		`);
	}

	// Add memory with automatic vector embedding
	private async addMemory(args: any) {
		const { content, project = 'default', type = 'general', metadata = {} } = args;
		const memoryId = crypto.randomUUID();
		const embeddingId = `memory-${memoryId}`;
		const userId = this.getUserId();

		try {
			// Generate embedding via Workers AI
			const embedding = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
				text: [content]
			});

			// FIXED: Correct parameter binding for SQL INSERT
			// 9 placeholders, 9 parameters
			this.sql.exec(
				`INSERT INTO memories (id, user_id, content, embedding_id, project, memory_type, metadata, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
				[memoryId, userId, content, embeddingId, project, type, JSON.stringify(metadata)]
			);

			// Store in Vectorize for semantic search
			await this.env.VECTORIZE.upsert([{
				id: embeddingId,
				values: embedding.data[0],
				metadata: {
					memoryId,
					userId,
					content: content.substring(0, 1000), // Truncate for metadata
					project,
					type,
					timestamp: Date.now(),
					...metadata
				}
			}]);

			return {
				content: [{
					type: "text",
					text: `✅ Memory stored successfully!\n\n**ID**: ${memoryId}\n**Project**: ${project}\n**Type**: ${type}\n**Content**: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`
				}]
			};

		} catch (error) {
			return {
				content: [{
					type: "text",
					text: `❌ Error storing memory: ${error.message}`
				}]
			};
		}
	}

	// Hybrid semantic + structured search
	private async searchMemories(args: any) {
		const { query, project, type, limit = 10, include_relationships = false } = args;
		const userId = this.getUserId();

		try {
			// Generate query embedding
			const queryEmbedding = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
				text: [query]
			});

			// Build vector search filter
			const vectorFilter: any = { userId };
			if (project) vectorFilter.project = project;
			if (type) vectorFilter.type = type;

			// Semantic search in Vectorize
			const vectorResults = await this.env.VECTORIZE.query(
				queryEmbedding.data[0],
				{
					topK: limit * 2, // Get more for filtering
					filter: vectorFilter,
					returnMetadata: 'all'
				}
			);

			if (vectorResults.matches.length === 0) {
				return {
					content: [{
						type: "text",
						text: `🔍 No memories found for query: "${query}"`
					}]
				};
			}

			// Get memory IDs from vector results
			const memoryIds = vectorResults.matches.map(m => m.metadata.memoryId);
			
			// FIXED: Build proper SQL query with correct parameter binding
			let sqlQuery = `
				SELECT m.*
				FROM memories m 
				WHERE m.id IN (${memoryIds.map(() => '?').join(',')})
			`;

			// Add relationship data if requested
			if (include_relationships) {
				sqlQuery = `
					SELECT m.*, 
						   GROUP_CONCAT(mr.to_memory_id) as related_memories,
						   GROUP_CONCAT(mr.relationship_type) as relationship_types
					FROM memories m 
					LEFT JOIN memory_relationships mr ON m.id = mr.from_memory_id
					WHERE m.id IN (${memoryIds.map(() => '?').join(',')})
					GROUP BY m.id
				`;
			}

			// Execute query with correct parameters
			const results = this.sql.exec(sqlQuery, memoryIds).toArray();
			
			// Create score mapping
			const scoreMap = new Map();
			vectorResults.matches.forEach(match => {
				scoreMap.set(match.metadata.memoryId, match.score);
			});

			// Enhance with semantic scores and sort
			const enhancedResults = results.map(row => ({
				...row,
				semantic_score: scoreMap.get(row.id) || 0,
				metadata: JSON.parse(row.metadata || '{}')
			})).sort((a, b) => b.semantic_score - a.semantic_score).slice(0, limit);

			// Format response
			let responseText = `🔍 **Found ${enhancedResults.length} memories for "${query}"**\n\n`;
			
			enhancedResults.forEach((memory, index) => {
				responseText += `**${index + 1}. ${memory.memory_type.toUpperCase()}** (Score: ${(memory.semantic_score * 100).toFixed(1)}%)\n`;
				responseText += `*Project: ${memory.project} | Created: ${new Date(memory.created_at).toLocaleDateString()}*\n`;
				responseText += `${memory.content.substring(0, 300)}${memory.content.length > 300 ? '...' : ''}\n`;
				responseText += `*ID: ${memory.id}*\n\n`;
			});

			return {
				content: [{
					type: "text",
					text: responseText
				}]
			};

		} catch (error) {
			return {
				content: [{
					type: "text",
					text: `❌ Error searching memories: ${error.message}`
				}]
			};
		}
	}

	// Create relationship between memories
	private async createMemoryRelationship(args: any) {
		const { from_memory_id, to_memory_id, relationship_type, strength = 0.5 } = args;
		const relationshipId = crypto.randomUUID();

		try {
			// Verify both memories exist
			const fromMemory = this.sql.exec(
				`SELECT id, content FROM memories WHERE id = ?`,
				[from_memory_id]
			).toArray()[0];

			const toMemory = this.sql.exec(
				`SELECT id, content FROM memories WHERE id = ?`,
				[to_memory_id]
			).toArray()[0];

			if (!fromMemory || !toMemory) {
				return {
					content: [{
						type: "text",
						text: `❌ One or both memories not found`
					}]
				};
			}

			// FIXED: Correct parameter binding for relationship insert
			// 5 placeholders, 5 parameters
			this.sql.exec(
				`INSERT INTO memory_relationships (id, from_memory_id, to_memory_id, relationship_type, strength)
				 VALUES (?, ?, ?, ?, ?)`,
				[relationshipId, from_memory_id, to_memory_id, relationship_type, strength]
			);

			return {
				content: [{
					type: "text",
					text: `🔗 **Relationship created successfully!**\n\n**Type**: ${relationship_type}\n**Strength**: ${strength}\n**From**: ${fromMemory.content.substring(0, 100)}...\n**To**: ${toMemory.content.substring(0, 100)}...`
				}]
			};

		} catch (error) {
			return {
				content: [{
					type: "text",
					text: `❌ Error creating relationship: ${error.message}`
				}]
			};
		}
	}

	// Switch project context
	private async switchProject(args: any) {
		const { project } = args;
		const userId = this.getUserId();

		try {
			// FIXED: Correct parameter binding for session update
			// Using proper UPSERT with 3 parameters
			this.sql.exec(
				`INSERT OR REPLACE INTO user_sessions (user_id, current_project, last_active)
				 VALUES (?, ?, CURRENT_TIMESTAMP)`,
				[userId, project]
			);

			return {
				content: [{
					type: "text",
					text: `📁 **Switched to project: ${project}**\n\nAll new memories will be stored in this project context.`
				}]
			};

		} catch (error) {
			return {
				content: [{
					type: "text",
					text: `❌ Error switching project: ${error.message}`
				}]
			};
		}
	}

	// Get memory statistics
	private async getMemoryStats(args: any) {
		const { project } = args;
		const userId = this.getUserId();

		try {
			let whereClause = `WHERE user_id = ?`;
			let params = [userId];

			if (project) {
				whereClause += ` AND project = ?`;
				params.push(project);
			}

			const stats = this.sql.exec(`
				SELECT 
					COUNT(*) as total_memories,
					COUNT(DISTINCT memory_type) as unique_types,
					COUNT(DISTINCT project) as projects,
					AVG(LENGTH(content)) as avg_content_length
				FROM memories ${whereClause}
			`, params).toArray()[0];

			const recentActivity = this.sql.exec(`
				SELECT 
					DATE(created_at) as date,
					COUNT(*) as count
				FROM memories ${whereClause}
				GROUP BY DATE(created_at)
				ORDER BY date DESC
				LIMIT 7
			`, params).toArray();

			let responseText = `📊 **Memory Statistics**\n\n`;
			responseText += `**Total Memories**: ${stats.total_memories}\n`;
			responseText += `**Memory Types**: ${stats.unique_types}\n`;
			responseText += `**Projects**: ${stats.projects}\n`;
			responseText += `**Avg Content Length**: ${Math.round(stats.avg_content_length)} chars\n\n`;

			if (recentActivity.length > 0) {
				responseText += `**Recent Activity:**\n`;
				recentActivity.forEach(day => {
					responseText += `• ${day.date}: ${day.count} memories\n`;
				});
			}

			return {
				content: [{
					type: "text",
					text: responseText
				}]
			};

		} catch (error) {
			return {
				content: [{
					type: "text",
					text: `❌ Error getting stats: ${error.message}`
				}]
			};
		}
	}

	// Helper: Get user ID (simplified for demo)
	private getUserId(): string {
		return 'mem0-mcp-user'; // In production, extract from OAuth token
	}
}

// Export the OAuth handler as the default
export default new OAuthProvider({
	apiRoute: "/sse",
	// @ts-expect-error
	apiHandler: MyMCP.mount("/sse"),
	// @ts-expect-error
	defaultHandler: app,
	authorizeEndpoint: "/authorize",
	tokenEndpoint: "/token",
	clientRegistrationEndpoint: "/register",
});
