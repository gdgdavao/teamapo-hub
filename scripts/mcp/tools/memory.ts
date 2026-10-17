/**
 * Memory Map Engine & Storage Manager
 *
 * Implements a lightweight, zero-dependency Markdown knowledge graph:
 * - Stores individual memory nodes with frontmatter in .memory/nodes/<id>.md
 * - Detects outbound links (frontmatter + [[wikilinks]] + markdown links)
 * - Computes dynamic inbound backlinks across all nodes
 * - Generates visual Mermaid diagrams and compiles .memory/MEMORY_MAP.md
 *
 * Designed following KISS, SOLID, and DRY principles.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface MemoryMetadata {
  id: string;
  title: string;
  category?: string;
  tags?: string[];
  links?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MemoryNode {
  metadata: MemoryMetadata;
  content: string;
  inboundLinks?: string[];
}

export interface MemoryGraph {
  nodes: Map<string, MemoryNode>;
  edges: Array<{ source: string; target: string; label?: string }>;
  categories: Record<string, string[]>;
  orphanNodeIds: string[];
  totalNodes: number;
  totalConnections: number;
}

export interface SearchMemoryParams {
  query?: string;
  category?: string;
  tag?: string;
}

export interface SearchMemoryResult {
  id: string;
  title: string;
  category: string;
  tags: string[];
  snippet: string;
  outboundCount: number;
  inboundCount: number;
  updatedAt: string;
}

const DEFAULT_MEMORY_DIR = path.resolve(process.cwd(), '.memory');

/**
 * Ensures memory root and nodes directories exist.
 */
export function ensureMemoryDirectory(baseDir: string = DEFAULT_MEMORY_DIR): {
  baseDir: string;
  nodesDir: string;
} {
  const nodesDir = path.join(baseDir, 'nodes');
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  if (!fs.existsSync(nodesDir)) {
    fs.mkdirSync(nodesDir, { recursive: true });
  }
  return { baseDir, nodesDir };
}

/**
 * Sanitizes ID into a clean kebab-case string safe against directory traversal.
 */
export function sanitizeMemoryId(input: string): string {
  const sanitized = input
    .toLowerCase()
    .trim()
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!sanitized) {
    throw new Error('Memory ID must contain at least one alphanumeric character');
  }
  return sanitized;
}

/**
 * Parses frontmatter and body from a markdown document without third-party dependencies.
 */
export function parseFrontmatter(markdown: string): {
  metadata: Partial<MemoryMetadata>;
  content: string;
} {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, content: markdown.trim() };
  }

  const rawYaml = match[1];
  const content = match[2]?.trim() ?? '';
  const metadata: Partial<MemoryMetadata> = {};

  const lines = rawYaml.split(/\r?\n/);
  let currentListKey: 'tags' | 'links' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Handle list item
    if (trimmed.startsWith('- ') && currentListKey) {
      const val = trimmed.slice(2).trim().replace(/^['"]|['"]$/g, '').replace(/\\"/g, '"');
      if (val) {
        if (!metadata[currentListKey]) metadata[currentListKey] = [];
        metadata[currentListKey]?.push(val);
      }
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      currentListKey = null;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const rawVal = line.slice(colonIdx + 1).trim();

    if (key === 'tags' || key === 'links') {
      currentListKey = key;
      metadata[key] = [];
      if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
        const items = rawVal
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, '').replace(/\\"/g, '"'))
          .filter(Boolean);
        metadata[key] = items;
        currentListKey = null;
      }
    } else {
      currentListKey = null;
      const cleanVal = rawVal.replace(/^['"]|['"]$/g, '').replace(/\\"/g, '"');
      if (key === 'id') metadata.id = cleanVal;
      else if (key === 'title') metadata.title = cleanVal;
      else if (key === 'category') metadata.category = cleanVal;
      else if (key === 'createdAt') metadata.createdAt = cleanVal;
      else if (key === 'updatedAt') metadata.updatedAt = cleanVal;
    }
  }

  return { metadata, content };
}

/**
 * Serializes a memory node to a Markdown string with YAML frontmatter.
 */
export function serializeMemory(node: { metadata: MemoryMetadata; content: string }): string {
  const { metadata, content } = node;
  const lines: string[] = ['---'];

  lines.push(`id: ${metadata.id}`);
  lines.push(`title: "${metadata.title.replace(/"/g, '\\"')}"`);
  if (metadata.category) {
    lines.push(`category: ${metadata.category}`);
  }
  if (metadata.tags && metadata.tags.length > 0) {
    lines.push(`tags: [${metadata.tags.map((t) => `"${t}"`).join(', ')}]`);
  }
  if (metadata.links && metadata.links.length > 0) {
    lines.push('links:');
    for (const link of metadata.links) {
      lines.push(`  - ${link}`);
    }
  }
  lines.push(`createdAt: ${metadata.createdAt}`);
  lines.push(`updatedAt: ${metadata.updatedAt}`);
  lines.push('---');
  lines.push('');
  lines.push(content);
  lines.push('');

  return lines.join('\n');
}

/**
 * Extracts outbound links from both frontmatter and content body.
 * Supports [[wikilinks]] and markdown links to [label](./id.md) or [label](id).
 */
export function extractOutboundLinks(
  frontmatterLinks: string[] = [],
  content: string = ''
): string[] {
  const linkSet = new Set<string>();

  for (const l of frontmatterLinks) {
    const clean = sanitizeMemoryId(l);
    if (clean) linkSet.add(clean);
  }

  // Match [[target-id]] or [[target-id|Label]]
  const wikilinkRegex = /\[\[([a-zA-Z0-9_.-]+)(?:\|[^\]]+)?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = wikilinkRegex.exec(content)) !== null) {
    const target = match[1];
    if (target) {
      try {
        linkSet.add(sanitizeMemoryId(target));
      } catch {
        // ignore invalid characters
      }
    }
  }

  // Match markdown links [Label](./target.md) or [Label](target.md) or [Label](target)
  const mdLinkRegex = /\[([^\]]+)\]\((?:\.\/|\/)?([a-zA-Z0-9_.-]+)(?:\.md)?\)/g;
  while ((match = mdLinkRegex.exec(content)) !== null) {
    const target = match[2];
    if (target && !target.startsWith('http://') && !target.startsWith('https://')) {
      try {
        linkSet.add(sanitizeMemoryId(target));
      } catch {
        // ignore invalid characters
      }
    }
  }

  return Array.from(linkSet);
}

/**
 * Reads and builds the complete in-memory graph from all markdown files in .memory/nodes/
 */
export function buildMemoryGraph(baseDir: string = DEFAULT_MEMORY_DIR): MemoryGraph {
  const { nodesDir } = ensureMemoryDirectory(baseDir);
  const files = fs.readdirSync(nodesDir).filter((f) => f.endsWith('.md'));

  const nodes = new Map<string, MemoryNode>();
  const outboundMap = new Map<string, string[]>();
  const inboundMap = new Map<string, Set<string>>();

  // First pass: load nodes and outbound links
  for (const file of files) {
    const fullPath = path.join(nodesDir, file);
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const { metadata, content } = parseFrontmatter(raw);

    const fileId = sanitizeMemoryId(file);
    const id = metadata.id ? sanitizeMemoryId(metadata.id) : fileId;
    const title = metadata.title || id;
    const category = metadata.category || 'general';
    const tags = metadata.tags || [];
    const createdAt = metadata.createdAt || new Date().toISOString();
    const updatedAt = metadata.updatedAt || new Date().toISOString();

    const outboundLinks = extractOutboundLinks(metadata.links, content);
    outboundMap.set(id, outboundLinks);

    const node: MemoryNode = {
      metadata: {
        id,
        title,
        category,
        tags,
        links: outboundLinks,
        createdAt,
        updatedAt
      },
      content,
      inboundLinks: []
    };

    nodes.set(id, node);
  }

  // Second pass: compute backlinks and edge list
  const edges: Array<{ source: string; target: string; label?: string }> = [];
  const categories: Record<string, string[]> = {};

  for (const [sourceId, outbound] of outboundMap.entries()) {
    const sourceNode = nodes.get(sourceId);
    const category = sourceNode?.metadata.category || 'general';
    if (!categories[category]) categories[category] = [];
    categories[category].push(sourceId);

    for (const targetId of outbound) {
      edges.push({ source: sourceId, target: targetId });

      if (!inboundMap.has(targetId)) {
        inboundMap.set(targetId, new Set());
      }
      inboundMap.get(targetId)!.add(sourceId);
    }
  }

  // Populate inboundLinks on each node
  const orphanNodeIds: string[] = [];
  for (const [id, node] of nodes.entries()) {
    const inbound = Array.from(inboundMap.get(id) || []);
    node.inboundLinks = inbound;

    const outboundCount = node.metadata.links?.length || 0;
    const inboundCount = inbound.length;

    if (outboundCount === 0 && inboundCount === 0) {
      orphanNodeIds.push(id);
    }
  }

  return {
    nodes,
    edges,
    categories,
    orphanNodeIds,
    totalNodes: nodes.size,
    totalConnections: edges.length
  };
}

/**
 * Generates Mermaid diagram string representing the interconnected graph.
 */
export function generateMermaidDiagram(graph: MemoryGraph): string {
  if (graph.totalNodes === 0) {
    return 'flowchart TD\n  empty["(No memory nodes recorded yet)"]';
  }

  const lines: string[] = ['flowchart TD'];

  // Subgraphs by category
  for (const [category, nodeIds] of Object.entries(graph.categories)) {
    const safeCatName = category.replace(/[^a-zA-Z0-9_]/g, '_');
    lines.push(`  subgraph cat_${safeCatName} ["${category.toUpperCase()}"]`);
    for (const id of nodeIds) {
      const node = graph.nodes.get(id);
      const title = (node?.metadata.title || id).replace(/"/g, "'");
      lines.push(`    ${id}["${title}"]`);
    }
    lines.push('  end');
  }

  // Edges
  for (const edge of graph.edges) {
    // If target node doesn't exist yet, render placeholder
    if (!graph.nodes.has(edge.target)) {
      lines.push(`    ${edge.target}["${edge.target} (uncreated)"]:::uncreated`);
    }
    lines.push(`    ${edge.source} --> ${edge.target}`);
  }

  // Class definitions
  lines.push('  classDef uncreated stroke-dasharray: 5 5,stroke:#999,opacity:0.75;');

  return lines.join('\n');
}

/**
 * Recompiles and updates .memory/MEMORY_MAP.md.
 */
export function rebuildMemoryMapFile(baseDir: string = DEFAULT_MEMORY_DIR): string {
  const { baseDir: root } = ensureMemoryDirectory(baseDir);
  const graph = buildMemoryGraph(baseDir);
  const mermaidDiagram = generateMermaidDiagram(graph);

  const lines: string[] = [];
  lines.push('# Interconnected Memory Map');
  lines.push('');
  lines.push('> Autogenerated by `memory-map` MCP server. Direct edits may be overwritten.');
  lines.push('');
  lines.push('## Metrics');
  lines.push(`- **Total Memory Nodes**: ${graph.totalNodes}`);
  lines.push(`- **Total Interconnections**: ${graph.totalConnections}`);
  lines.push(`- **Categories**: ${Object.keys(graph.categories).join(', ') || 'none'}`);
  lines.push(`- **Orphan (Unlinked) Nodes**: ${graph.orphanNodeIds.length}`);
  lines.push(`- **Last Rebuilt**: ${new Date().toISOString()}`);
  lines.push('');

  lines.push('## Visual Knowledge Graph');
  lines.push('```mermaid');
  lines.push(mermaidDiagram);
  lines.push('```');
  lines.push('');

  lines.push('## Memory Nodes Directory');
  lines.push('| ID | Title | Category | Tags | Outbound Links | Backlinks (Inbound) | Updated |');
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

  for (const [id, node] of graph.nodes.entries()) {
    const meta = node.metadata;
    const tags = meta.tags?.map((t) => `\`${t}\``).join(' ') || '-';
    const outbound = meta.links?.map((l) => `[${l}](#${l})`).join(', ') || '-';
    const backlinks = node.inboundLinks?.map((b) => `[${b}](#${b})`).join(', ') || '-';
    const dateStr = meta.updatedAt ? meta.updatedAt.slice(0, 10) : '-';

    lines.push(`| [${id}](./nodes/${id}.md) | **${meta.title}** | \`${meta.category}\` | ${tags} | ${outbound} | ${backlinks} | ${dateStr} |`);
  }
  lines.push('');

  if (graph.orphanNodeIds.length > 0) {
    lines.push('## ⚠️ Unlinked / Isolated Nodes');
    lines.push('The following nodes have no connections. Consider linking them using `link_memories`:');
    for (const orphan of graph.orphanNodeIds) {
      const node = graph.nodes.get(orphan);
      lines.push(`- [${node?.metadata.title || orphan}](./nodes/${orphan}.md) (\`${orphan}\`)`);
    }
    lines.push('');
  }

  const mapPath = path.join(root, 'MEMORY_MAP.md');
  const content = lines.join('\n');
  fs.writeFileSync(mapPath, content, 'utf-8');
  return content;
}

/**
 * Creates or overwrites a memory node and rebuilds the map.
 */
export function createMemory(
  params: {
    id?: string;
    title: string;
    content: string;
    category?: string;
    tags?: string[];
    links?: string[];
  },
  baseDir: string = DEFAULT_MEMORY_DIR
): { node: MemoryNode; memoryMapPath: string } {
  const { nodesDir, baseDir: root } = ensureMemoryDirectory(baseDir);

  const rawId = params.id || params.title;
  const id = sanitizeMemoryId(rawId);
  const now = new Date().toISOString();

  const metadata: MemoryMetadata = {
    id,
    title: params.title.trim(),
    category: params.category?.trim().toLowerCase() || 'general',
    tags: params.tags?.map((t) => t.trim().toLowerCase()).filter(Boolean) || [],
    links: extractOutboundLinks(params.links, params.content),
    createdAt: now,
    updatedAt: now
  };

  const node: MemoryNode = {
    metadata,
    content: params.content.trim()
  };

  const filePath = path.join(nodesDir, `${id}.md`);
  fs.writeFileSync(filePath, serializeMemory(node), 'utf-8');

  rebuildMemoryMapFile(baseDir);

  return {
    node,
    memoryMapPath: path.join(root, 'MEMORY_MAP.md')
  };
}

/**
 * Updates an existing memory node.
 */
export function updateMemory(
  params: {
    id: string;
    title?: string;
    content?: string;
    append?: boolean;
    category?: string;
    addTags?: string[];
    addLinks?: string[];
  },
  baseDir: string = DEFAULT_MEMORY_DIR
): { node: MemoryNode; memoryMapPath: string } {
  const { nodesDir, baseDir: root } = ensureMemoryDirectory(baseDir);
  const id = sanitizeMemoryId(params.id);
  const filePath = path.join(nodesDir, `${id}.md`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Memory node not found: ${id}`);
  }

  const existingRaw = fs.readFileSync(filePath, 'utf-8');
  const { metadata: existingMeta, content: existingContent } = parseFrontmatter(existingRaw);

  const now = new Date().toISOString();
  let finalContent = existingContent;

  if (params.content !== undefined) {
    if (params.append) {
      finalContent = `${existingContent}\n\n${params.content.trim()}`.trim();
    } else {
      finalContent = params.content.trim();
    }
  }

  const tagSet = new Set(existingMeta.tags || []);
  if (params.addTags) {
    for (const t of params.addTags) tagSet.add(t.trim().toLowerCase());
  }

  const linkSet = new Set(existingMeta.links || []);
  if (params.addLinks) {
    for (const l of params.addLinks) linkSet.add(sanitizeMemoryId(l));
  }
  const mergedLinks = extractOutboundLinks(Array.from(linkSet), finalContent);

  const updatedMetadata: MemoryMetadata = {
    id,
    title: params.title?.trim() || existingMeta.title || id,
    category: params.category?.trim().toLowerCase() || existingMeta.category || 'general',
    tags: Array.from(tagSet),
    links: mergedLinks,
    createdAt: existingMeta.createdAt || now,
    updatedAt: now
  };

  const node: MemoryNode = {
    metadata: updatedMetadata,
    content: finalContent
  };

  fs.writeFileSync(filePath, serializeMemory(node), 'utf-8');
  rebuildMemoryMapFile(baseDir);

  return {
    node,
    memoryMapPath: path.join(root, 'MEMORY_MAP.md')
  };
}

/**
 * Reads a single memory node with computed backlinks.
 */
export function readMemory(
  idInput: string,
  baseDir: string = DEFAULT_MEMORY_DIR
): MemoryNode {
  const id = sanitizeMemoryId(idInput);
  const graph = buildMemoryGraph(baseDir);
  const node = graph.nodes.get(id);

  if (!node) {
    throw new Error(`Memory node not found: ${id}`);
  }

  return node;
}

/**
 * Links two memory nodes together.
 */
export function linkMemories(
  params: {
    sourceId: string;
    targetId: string;
    relation?: string;
  },
  baseDir: string = DEFAULT_MEMORY_DIR
): { source: MemoryNode; targetId: string } {
  const sourceId = sanitizeMemoryId(params.sourceId);
  const targetId = sanitizeMemoryId(params.targetId);

  const { nodesDir } = ensureMemoryDirectory(baseDir);
  const sourcePath = path.join(nodesDir, `${sourceId}.md`);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source memory node not found: ${sourceId}`);
  }

  const raw = fs.readFileSync(sourcePath, 'utf-8');
  const { metadata, content } = parseFrontmatter(raw);

  const linkSet = new Set(metadata.links || []);
  linkSet.add(targetId);

  let updatedContent = content;
  const relText = params.relation ? ` (relation: ${params.relation})` : '';
  const relationNote = `\n- Connects to [[${targetId}]]${relText}`;
  if (!updatedContent.includes(`[[${targetId}]]`)) {
    updatedContent = `${updatedContent.trim()}\n${relationNote}`.trim();
  }

  const now = new Date().toISOString();
  const updatedMetadata: MemoryMetadata = {
    id: sourceId,
    title: metadata.title || sourceId,
    category: metadata.category || 'general',
    tags: metadata.tags || [],
    links: Array.from(linkSet),
    createdAt: metadata.createdAt || now,
    updatedAt: now
  };

  const node: MemoryNode = {
    metadata: updatedMetadata,
    content: updatedContent
  };

  fs.writeFileSync(sourcePath, serializeMemory(node), 'utf-8');
  rebuildMemoryMapFile(baseDir);

  return { source: node, targetId };
}

/**
 * Searches memories by query string, category, or tag.
 */
export function searchMemories(
  params: SearchMemoryParams,
  baseDir: string = DEFAULT_MEMORY_DIR
): SearchMemoryResult[] {
  const graph = buildMemoryGraph(baseDir);
  const query = params.query?.toLowerCase().trim();
  const cat = params.category?.toLowerCase().trim();
  const tag = params.tag?.toLowerCase().trim();

  const results: SearchMemoryResult[] = [];

  for (const [id, node] of graph.nodes.entries()) {
    const meta = node.metadata;
    const content = node.content;

    if (cat && meta.category?.toLowerCase() !== cat) {
      continue;
    }

    if (tag && !meta.tags?.some((t) => t.toLowerCase() === tag)) {
      continue;
    }

    if (query) {
      const matchInId = id.includes(query);
      const matchInTitle = meta.title.toLowerCase().includes(query);
      const matchInTags = meta.tags?.some((t) => t.toLowerCase().includes(query));
      const matchInContent = content.toLowerCase().includes(query);

      if (!matchInId && !matchInTitle && !matchInTags && !matchInContent) {
        continue;
      }
    }

    // Extract snippet
    let snippet = content.slice(0, 160).replace(/\r?\n/g, ' ').trim();
    if (content.length > 160) snippet += '...';

    results.push({
      id,
      title: meta.title,
      category: meta.category || 'general',
      tags: meta.tags || [],
      snippet,
      outboundCount: meta.links?.length || 0,
      inboundCount: node.inboundLinks?.length || 0,
      updatedAt: meta.updatedAt
    });
  }

  return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
