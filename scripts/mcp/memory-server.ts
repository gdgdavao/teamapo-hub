#!/usr/bin/env bun
/**
 * Interconnected Markdown Memory Map MCP Server
 *
 * Exposes MCP tools for AI agents to create, update, search, link, and visualize
 * an interconnected Markdown knowledge graph.
 *
 * Adheres to Bun-only runtime, KISS, SOLID, and DRY principles.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  createMemory,
  updateMemory,
  readMemory,
  linkMemories,
  searchMemories,
  buildMemoryGraph,
  generateMermaidDiagram,
  rebuildMemoryMapFile
} from './tools/memory';

export function createMemoryMapMcpServer(baseDir?: string): McpServer {
  const server = new McpServer({
    name: 'memory-map',
    version: '1.0.0'
  });

  // Tool 1: Create Memory Node
  server.tool(
    'create_memory',
    'Creates a new memory node in the interconnected Markdown knowledge map. Supports tags, categories, and links to existing memories.',
    {
      title: z.string().describe('Descriptive title of the memory (e.g., "CASL Authorization Rules Invariants")'),
      content: z.string().describe('Detailed Markdown content capturing the concept, decision, lessons learned, or code snippet'),
      id: z.string().optional().describe('Optional custom kebab-case ID (e.g., "casl-rules"). Auto-generated from title if omitted'),
      category: z.string().optional().describe('High-level category (e.g., "architecture", "security", "database", "debugging", "workflow")'),
      tags: z.array(z.string()).optional().describe('List of keyword tags for categorization (e.g., ["auth", "casl", "firestore"])'),
      links: z.array(z.string()).optional().describe('List of IDs of other memory nodes this memory connects or relates to')
    },
    async (params) => {
      try {
        const result = createMemory(params, baseDir);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Memory node '${result.node.metadata.id}' created successfully.`,
                  node: result.node,
                  memoryMapPath: result.memoryMapPath
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to create memory: ${err instanceof Error ? err.message : String(err)}`
            }
          ]
        };
      }
    }
  );

  // Tool 2: Update Memory Node
  server.tool(
    'update_memory',
    'Updates or appends content to an existing memory node. Refreshes the interconnected knowledge map and backlinks.',
    {
      id: z.string().describe('ID of the memory node to update'),
      content: z.string().optional().describe('New content or additional content to append'),
      append: z.boolean().optional().default(false).describe('If true, appends content to the existing body rather than replacing it'),
      title: z.string().optional().describe('Updated title if renaming'),
      category: z.string().optional().describe('Updated category'),
      addTags: z.array(z.string()).optional().describe('New tags to add to existing tags'),
      addLinks: z.array(z.string()).optional().describe('New outbound memory IDs to link to')
    },
    async (params) => {
      try {
        const result = updateMemory(params, baseDir);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Memory node '${result.node.metadata.id}' updated successfully.`,
                  node: result.node,
                  memoryMapPath: result.memoryMapPath
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to update memory: ${err instanceof Error ? err.message : String(err)}`
            }
          ]
        };
      }
    }
  );

  // Tool 3: Read Memory Node
  server.tool(
    'read_memory',
    'Reads a memory node by ID, including its frontmatter, content, outbound links, and dynamically computed inbound backlinks.',
    {
      id: z.string().describe('ID of the memory node to read')
    },
    async ({ id }) => {
      try {
        const node = readMemory(id, baseDir);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(node, null, 2)
            }
          ]
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to read memory '${id}': ${err instanceof Error ? err.message : String(err)}`
            }
          ]
        };
      }
    }
  );

  // Tool 4: Link Memories
  server.tool(
    'link_memories',
    'Creates a directed interconnection from a source memory node to a target memory node with an optional relation label.',
    {
      sourceId: z.string().describe('ID of the source memory node'),
      targetId: z.string().describe('ID of the target memory node to link to'),
      relation: z.string().optional().describe('Relationship descriptor (e.g., "depends-on", "relates-to", "supersedes", "implements")')
    },
    async (params) => {
      try {
        const result = linkMemories(params, baseDir);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Linked memory '${params.sourceId}' -> '${params.targetId}'`,
                  source: result.source
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to link memories: ${err instanceof Error ? err.message : String(err)}`
            }
          ]
        };
      }
    }
  );

  // Tool 5: Search Memories
  server.tool(
    'search_memories',
    'Searches across all Markdown memories by keyword query, category, or tag.',
    {
      query: z.string().optional().describe('Keyword or phrase to search within memory IDs, titles, tags, and content'),
      category: z.string().optional().describe('Filter by specific category'),
      tag: z.string().optional().describe('Filter by specific tag')
    },
    async (params) => {
      try {
        const results = searchMemories(params, baseDir);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  totalMatches: results.length,
                  results
                },
                null,
                2
              )
            }
          ]
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to search memories: ${err instanceof Error ? err.message : String(err)}`
            }
          ]
        };
      }
    }
  );

  // Tool 6: Get Memory Map
  server.tool(
    'get_memory_map',
    'Retrieves the complete interconnected memory graph overview, metrics, and generated Mermaid diagram.',
    {
      rebuildFile: z.boolean().optional().default(true).describe('Whether to force re-render and write .memory/MEMORY_MAP.md')
    },
    async ({ rebuildFile }) => {
      try {
        if (rebuildFile) {
          rebuildMemoryMapFile(baseDir);
        }
        const graph = buildMemoryGraph(baseDir);
        const mermaid = generateMermaidDiagram(graph);

        const summary = {
          totalNodes: graph.totalNodes,
          totalConnections: graph.totalConnections,
          categories: Object.keys(graph.categories),
          orphanNodes: graph.orphanNodeIds,
          mermaidDiagram: mermaid
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2)
            }
          ]
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to get memory map: ${err instanceof Error ? err.message : String(err)}`
            }
          ]
        };
      }
    }
  );

  // Tool 7: List Memories
  server.tool(
    'list_memories',
    'Lists all stored memory nodes with metadata and connection statistics.',
    {
      category: z.string().optional().describe('Filter by category')
    },
    async ({ category }) => {
      try {
        const graph = buildMemoryGraph(baseDir);
        const list: Array<{
          id: string;
          title: string;
          category: string;
          tags: string[];
          outboundLinksCount: number;
          inboundBacklinksCount: number;
          updatedAt: string;
        }> = [];

        for (const [id, node] of graph.nodes.entries()) {
          if (category && node.metadata.category?.toLowerCase() !== category.toLowerCase()) {
            continue;
          }
          list.push({
            id,
            title: node.metadata.title,
            category: node.metadata.category || 'general',
            tags: node.metadata.tags || [],
            outboundLinksCount: node.metadata.links?.length || 0,
            inboundBacklinksCount: node.inboundLinks?.length || 0,
            updatedAt: node.metadata.updatedAt
          });
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(list, null, 2)
            }
          ]
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Failed to list memories: ${err instanceof Error ? err.message : String(err)}`
            }
          ]
        };
      }
    }
  );

  return server;
}

export async function runServer(): Promise<void> {
  const server = createMemoryMapMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🧠 Interconnected Memory Map MCP Server running on stdio');
}

if (import.meta.main || process.argv[1]?.endsWith('memory-server.ts')) {
  runServer().catch((err) => {
    console.error('Fatal error starting Memory Map MCP server:', err);
    process.exit(1);
  });
}
