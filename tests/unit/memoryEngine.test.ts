import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  ensureMemoryDirectory,
  sanitizeMemoryId,
  parseFrontmatter,
  serializeMemory,
  extractOutboundLinks,
  createMemory,
  updateMemory,
  readMemory,
  linkMemories,
  searchMemories,
  buildMemoryGraph,
  generateMermaidDiagram,
  rebuildMemoryMapFile,
  type MemoryNode
} from '../../scripts/mcp/tools/memory';
import { createMemoryMapMcpServer } from '../../scripts/mcp/memory-server';

describe('Interconnected Memory Map Engine', () => {
  const testBaseDir = path.resolve(__dirname, '../../scratch/test-memory-dir');

  beforeEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
    ensureMemoryDirectory(testBaseDir);
  });

  afterEach(() => {
    if (fs.existsSync(testBaseDir)) {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('ID Sanitization & Safety', () => {
    it('sanitizes titles and slugs cleanly', () => {
      expect(sanitizeMemoryId('Client & Backend Authorization Model')).toBe('client-backend-authorization-model');
      expect(sanitizeMemoryId('casl_rules.md')).toBe('casl_rules');
      expect(sanitizeMemoryId('  UPPERCASE-spaced_ID  ')).toBe('uppercase-spaced_id');
    });

    it('prevents path traversal attempts', () => {
      expect(sanitizeMemoryId('../../etc/passwd')).toBe('etc-passwd');
      expect(sanitizeMemoryId('..\\..\\windows')).toBe('windows');
      expect(() => sanitizeMemoryId('...')).toThrow();
    });
  });

  describe('Frontmatter Parsing and Serialization', () => {
    it('serializes and parses frontmatter with zero data loss', () => {
      const node: MemoryNode = {
        metadata: {
          id: 'test-node',
          title: 'Test Node Title',
          category: 'architecture',
          tags: ['auth', 'casl'],
          links: ['other-node', 'database-schema'],
          createdAt: '2026-10-14T10:00:00.000Z',
          updatedAt: '2026-10-14T10:00:00.000Z'
        },
        content: '# Test Node Title\n\nThis is sample body content.'
      };

      const serialized = serializeMemory(node);
      expect(serialized).toContain('id: test-node');
      expect(serialized).toContain('title: "Test Node Title"');
      expect(serialized).toContain('category: architecture');
      expect(serialized).toContain('tags: ["auth", "casl"]');
      expect(serialized).toContain('- other-node');
      expect(serialized).toContain('- database-schema');
      expect(serialized).toContain('# Test Node Title');

      const parsed = parseFrontmatter(serialized);
      expect(parsed.metadata.id).toBe('test-node');
      expect(parsed.metadata.title).toBe('Test Node Title');
      expect(parsed.metadata.category).toBe('architecture');
      expect(parsed.metadata.tags).toEqual(['auth', 'casl']);
      expect(parsed.metadata.links).toEqual(['other-node', 'database-schema']);
      expect(parsed.content).toBe('# Test Node Title\n\nThis is sample body content.');
    });

    it('parses inline array tags and bracketed links', () => {
      const markdown = `---
id: sample
title: Sample
tags: [tag1, tag2, tag3]
links: [link1, link2]
---

Body content`;

      const parsed = parseFrontmatter(markdown);
      expect(parsed.metadata.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(parsed.metadata.links).toEqual(['link1', 'link2']);
      expect(parsed.content).toBe('Body content');
    });
  });

  describe('Link Extraction', () => {
    it('extracts links from frontmatter, wikilinks, and standard markdown links', () => {
      const frontmatterLinks = ['front-link-1', 'front-link-2'];
      const body = `
# Title
Here is a reference to [[wiki-topic]] and [[wiki-topic-2|Display Title]].
Also check [Other Doc](./markdown-doc.md) or [Target](target-node).
External links like [Google](https://google.com) should be ignored.
      `;

      const links = extractOutboundLinks(frontmatterLinks, body);

      expect(links).toContain('front-link-1');
      expect(links).toContain('front-link-2');
      expect(links).toContain('wiki-topic');
      expect(links).toContain('wiki-topic-2');
      expect(links).toContain('markdown-doc');
      expect(links).toContain('target-node');
      expect(links).not.toContain('google.com');
      expect(links).not.toContain('https://google.com');
    });
  });

  describe('CRUD Operations & Graph Interconnectivity', () => {
    it('creates, reads, updates, and links memory nodes with dynamic backlinks', () => {
      // 1. Create Node A
      const { node: nodeA } = createMemory(
        {
          id: 'architecture-overview',
          title: 'System Architecture Overview',
          content: 'Foundational architecture principles following KISS, SOLID, and DRY.',
          category: 'architecture',
          tags: ['architecture', 'solid']
        },
        testBaseDir
      );
      expect(nodeA.metadata.id).toBe('architecture-overview');

      // 2. Create Node B linking to Node A
      const { node: nodeB } = createMemory(
        {
          id: 'casl-authorization',
          title: 'CASL Authorization Rules',
          content: 'Details on client-side ability.ts mirroring firestore.rules.\n\nRelates to [[architecture-overview]].',
          category: 'security',
          tags: ['auth', 'casl', 'security']
        },
        testBaseDir
      );
      expect(nodeB.metadata.links).toContain('architecture-overview');

      // 3. Read Node A and verify it has inbound backlink from Node B
      const readA = readMemory('architecture-overview', testBaseDir);
      expect(readA.inboundLinks).toContain('casl-authorization');

      // 4. Update Node A by appending new content and adding a link
      const { node: updatedA } = updateMemory(
        {
          id: 'architecture-overview',
          content: 'Added note about anonymous attendee privacy model.',
          append: true,
          addTags: ['privacy']
        },
        testBaseDir
      );
      expect(updatedA.metadata.tags).toContain('privacy');
      expect(updatedA.content).toContain('Foundational architecture');
      expect(updatedA.content).toContain('Added note about anonymous attendee');

      // 5. Create Node C and link explicitly using linkMemories
      createMemory(
        {
          id: 'dpa-2012-compliance',
          title: 'Philippines DPA 2012 Compliance',
          content: 'Never run unscoped reads on registrations or certificates.',
          category: 'privacy',
          tags: ['privacy', 'legal']
        },
        testBaseDir
      );

      linkMemories(
        {
          sourceId: 'casl-authorization',
          targetId: 'dpa-2012-compliance',
          relation: 'enforces-privacy'
        },
        testBaseDir
      );

      const readC = readMemory('dpa-2012-compliance', testBaseDir);
      expect(readC.inboundLinks).toContain('casl-authorization');

      // 6. Check compiled MEMORY_MAP.md
      const mapContent = fs.readFileSync(path.join(testBaseDir, 'MEMORY_MAP.md'), 'utf-8');
      expect(mapContent).toContain('# Interconnected Memory Map');
      expect(mapContent).toContain('**Total Memory Nodes**: 3');
      expect(mapContent).toContain('flowchart TD');
      expect(mapContent).toContain('casl-authorization --> architecture-overview');
      expect(mapContent).toContain('casl-authorization --> dpa-2012-compliance');
    });

    it('searches memory nodes by query, category, and tag', () => {
      createMemory(
        {
          id: 'node-one',
          title: 'Firestore Indexes Optimizations',
          content: 'Guidelines on composite index configurations and deployment.',
          category: 'database',
          tags: ['firestore', 'indexes']
        },
        testBaseDir
      );

      createMemory(
        {
          id: 'node-two',
          title: 'Python Cloud Functions V2',
          content: '2nd gen Cloud Functions running in asia-southeast2.',
          category: 'backend',
          tags: ['python', 'functions', 'cloud']
        },
        testBaseDir
      );

      // Search by text query
      const queryResults = searchMemories({ query: 'composite' }, testBaseDir);
      expect(queryResults.length).toBe(1);
      expect(queryResults[0].id).toBe('node-one');

      // Search by tag
      const tagResults = searchMemories({ tag: 'functions' }, testBaseDir);
      expect(tagResults.length).toBe(1);
      expect(tagResults[0].id).toBe('node-two');

      // Search by category
      const catResults = searchMemories({ category: 'database' }, testBaseDir);
      expect(catResults.length).toBe(1);
      expect(catResults[0].id).toBe('node-one');
    });
  });

  describe('Mermaid Graph and Memory Map Compilation', () => {
    it('handles empty memory directory gracefully', () => {
      const graph = buildMemoryGraph(testBaseDir);
      expect(graph.totalNodes).toBe(0);
      expect(graph.totalConnections).toBe(0);

      const map = rebuildMemoryMapFile(testBaseDir);
      expect(map).toContain('**Total Memory Nodes**: 0');
      expect(map).toContain('empty["(No memory nodes recorded yet)"]');
    });

    it('escapes quotes and special characters in Mermaid diagram', () => {
      createMemory(
        {
          id: 'special-chars',
          title: 'Title with "Quotes" and (Parentheses)',
          content: 'Sample content',
          category: 'general'
        },
        testBaseDir
      );

      const graph = buildMemoryGraph(testBaseDir);
      const diagram = generateMermaidDiagram(graph);

      expect(diagram).not.toContain('""');
      expect(diagram).toContain("Title with 'Quotes' and (Parentheses)");
    });
  });

  describe('MCP Server Tools Registration', () => {
    it('initializes Memory Map MCP Server with all required tools', () => {
      const server = createMemoryMapMcpServer(testBaseDir);
      expect(server).toBeDefined();
    });
  });
});
