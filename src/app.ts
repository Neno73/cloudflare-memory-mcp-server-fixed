import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
	return c.html(`
		<!DOCTYPE html>
		<html>
		<head>
			<title>AI Memory MCP Server</title>
			<style>
				body { font-family: system-ui; margin: 40px; line-height: 1.6; }
				.hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
						color: white; padding: 40px; border-radius: 12px; margin-bottom: 30px; }
				.feature { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
				.code { background: #f1f3f4; padding: 15px; border-radius: 6px; font-family: monospace; }
				.status { display: inline-block; padding: 4px 12px; background: #10b981; 
						 color: white; border-radius: 20px; font-size: 14px; }
			</style>
		</head>
		<body>
			<div class="hero">
				<h1>🧠 AI Memory MCP Server</h1>
				<p>Enhanced Memory System using Cloudflare Workers + Durable Objects + Vectorize</p>
				<span class="status">✅ Online</span>
			</div>

			<div class="feature">
				<h2>🚀 Features</h2>
				<ul>
					<li><strong>Persistent Memory:</strong> Store and retrieve memories with semantic search</li>
					<li><strong>Vector Embeddings:</strong> Automatic embedding generation with Workers AI</li>
					<li><strong>Project Organization:</strong> Organize memories by projects and types</li>
					<li><strong>Memory Relationships:</strong> Create connections between related memories</li>
					<li><strong>OAuth Security:</strong> Secure authentication with multiple providers</li>
				</ul>
			</div>

			<div class="feature">
				<h2>🔧 Available Tools</h2>
				<ul>
					<li><code>add-memory</code> - Store new memories with automatic embeddings</li>
					<li><code>search-memories</code> - Semantic search with filtering</li>
					<li><code>create-memory-relationship</code> - Link related memories</li>
					<li><code>switch-project</code> - Change memory context</li>
					<li><code>get-memory-stats</code> - View memory analytics</li>
				</ul>
			</div>

			<div class="feature">
				<h2>📡 MCP Endpoint</h2>
				<div class="code">https://your-worker.workers.dev/sse</div>
				<p>Connect this URL to Claude.ai or other MCP clients to start using the memory system.</p>
			</div>

			<div class="feature">
				<h2>🛠 Technical Stack</h2>
				<ul>
					<li><strong>Cloudflare Workers:</strong> Serverless compute at the edge</li>
					<li><strong>Durable Objects:</strong> Stateful storage with SQLite</li>
					<li><strong>Vectorize:</strong> Vector database for semantic search</li>
					<li><strong>Workers AI:</strong> Embedding generation (@cf/baai/bge-base-en-v1.5)</li>
					<li><strong>OAuth 2.1:</strong> Secure authentication flow</li>
				</ul>
			</div>

			<footer style="margin-top: 40px; text-align: center; color: #666;">
				<p>Built with ❤️ on Cloudflare's Developer Platform</p>
			</footer>
		</body>
		</html>
	`);
});

app.get("/health", (c) => {
	return c.json({ 
		status: "healthy", 
		timestamp: new Date().toISOString(),
		version: "1.0.0" 
	});
});

export default app;
