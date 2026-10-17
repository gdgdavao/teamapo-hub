import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('MCP Configuration Integrity', () => {
  const rootDir = path.resolve(__dirname, '../../');

  const configFiles = [
    { file: '.mcp.json', type: 'root' },
    { file: 'opencode.json', type: 'opencode' },
    { file: '.claude/mcp.json', type: 'standard' },
    { file: '.cursor/mcp.json', type: 'standard' },
    { file: '.agents/plugins/apohub/mcp_config.json', type: 'standard' },
    { file: 'claude_desktop_config.example.json', type: 'standard' }
  ];

  it('all configuration files exist and parse as valid JSON', () => {
    for (const { file } of configFiles) {
      const filePath = path.join(rootDir, file);
      expect(fs.existsSync(filePath), `File should exist: ${file}`).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(() => JSON.parse(content), `File should be valid JSON: ${file}`).not.toThrow();
    }
  });

  it('configures chrome-devtools server across all agent configurations', () => {
    // Root .mcp.json (AGY, Claude Code, Agnostic)
    const mcpJson = JSON.parse(fs.readFileSync(path.join(rootDir, '.mcp.json'), 'utf-8'));
    expect(mcpJson.mcpServers).toBeDefined();
    expect(mcpJson.mcpServers['chrome-devtools']).toBeDefined();
    expect(mcpJson.mcpServers['chrome-devtools'].command).toBe('bunx');
    expect(mcpJson.mcpServers['chrome-devtools'].args).toContain('chrome-devtools-mcp@latest');

    // OpenCode
    const openCodeJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'opencode.json'), 'utf-8'));
    expect(openCodeJson.mcp).toBeDefined();
    expect(openCodeJson.mcp['chrome-devtools']).toBeDefined();
    expect(openCodeJson.mcp['chrome-devtools'].command).toEqual(['bunx', 'chrome-devtools-mcp@latest']);

    // .claude/mcp.json
    const claudeJson = JSON.parse(fs.readFileSync(path.join(rootDir, '.claude/mcp.json'), 'utf-8'));
    expect(claudeJson.mcpServers['chrome-devtools']).toBeDefined();
    expect(claudeJson.mcpServers['chrome-devtools'].command).toBe('bunx');

    // .cursor/mcp.json
    const cursorJson = JSON.parse(fs.readFileSync(path.join(rootDir, '.cursor/mcp.json'), 'utf-8'));
    expect(cursorJson.mcpServers['chrome-devtools']).toBeDefined();
    expect(cursorJson.mcpServers['chrome-devtools'].command).toBe('bunx');
  });

  it('preserves existing apohub-dev and firebase MCP servers', () => {
    const mcpJson = JSON.parse(fs.readFileSync(path.join(rootDir, '.mcp.json'), 'utf-8'));
    expect(mcpJson.mcpServers['apohub-dev']).toBeDefined();
    expect(mcpJson.mcpServers['firebase']).toBeDefined();

    const openCodeJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'opencode.json'), 'utf-8'));
    expect(openCodeJson.mcp['apohub-dev']).toBeDefined();
    expect(openCodeJson.mcp['firebase']).toBeDefined();
  });

  it('strictly adheres to BUN ONLY (no npm or npx commands)', () => {
    for (const { file } of configFiles) {
      const filePath = path.join(rootDir, file);
      const raw = fs.readFileSync(filePath, 'utf-8');

      expect(raw).not.toMatch(/"command":\s*"npx"/);
      expect(raw).not.toMatch(/"command":\s*"npm"/);
      expect(raw).not.toMatch(/"npx"/);
      expect(raw).not.toMatch(/"npm"/);
    }
  });

  it('contains no hardcoded machine-specific user paths in tracked configs', () => {
    const trackedConfigs = [
      '.mcp.json',
      'opencode.json',
      '.claude/mcp.json',
      '.cursor/mcp.json',
      '.agents/plugins/apohub/mcp_config.json'
    ];

    for (const file of trackedConfigs) {
      const filePath = path.join(rootDir, file);
      const raw = fs.readFileSync(filePath, 'utf-8');

      // Reject hardcoded macOS / Linux / Windows user directories
      expect(raw).not.toMatch(/\/Users\/[a-zA-Z0-9_-]+/);
      expect(raw).not.toMatch(/\/home\/[a-zA-Z0-9_-]+/);
      expect(raw).not.toMatch(/[C-Z]:\\[Uu]sers/);
    }
  });

  it('configures memory-map server across all agent configurations', () => {
    // Root .mcp.json
    const mcpJson = JSON.parse(fs.readFileSync(path.join(rootDir, '.mcp.json'), 'utf-8'));
    expect(mcpJson.mcpServers['memory-map']).toBeDefined();
    expect(mcpJson.mcpServers['memory-map'].command).toBe('bun');
    expect(mcpJson.mcpServers['memory-map'].args).toEqual(['run', 'scripts/mcp/memory-server.ts']);

    // OpenCode
    const openCodeJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'opencode.json'), 'utf-8'));
    expect(openCodeJson.mcp['memory-map']).toBeDefined();
    expect(openCodeJson.mcp['memory-map'].command).toEqual(['bun', 'run', 'scripts/mcp/memory-server.ts']);

    // .claude/mcp.json
    const claudeJson = JSON.parse(fs.readFileSync(path.join(rootDir, '.claude/mcp.json'), 'utf-8'));
    expect(claudeJson.mcpServers['memory-map']).toBeDefined();

    // .cursor/mcp.json
    const cursorJson = JSON.parse(fs.readFileSync(path.join(rootDir, '.cursor/mcp.json'), 'utf-8'));
    expect(cursorJson.mcpServers['memory-map']).toBeDefined();

    // plugin config
    const pluginJson = JSON.parse(fs.readFileSync(path.join(rootDir, '.agents/plugins/apohub/mcp_config.json'), 'utf-8'));
    expect(pluginJson.mcpServers['memory-map']).toBeDefined();
  });

  it('includes memory:mcp script in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
    expect(pkg.scripts['memory:mcp']).toBe('bun run scripts/mcp/memory-server.ts');
  });

  it('ignores memory directory in .gitignore', () => {
    const gitignore = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('.memory/');
    expect(gitignore).toContain('memory/');
  });

  it('documents memory-map in AGENTS.md and docs/MCP_SETUP.md', () => {
    const agentsMd = fs.readFileSync(path.join(rootDir, 'AGENTS.md'), 'utf-8');
    expect(agentsMd).toContain('memory-map');
    expect(agentsMd).toContain('Interconnected Memory Map Protocol');

    const mcpDoc = fs.readFileSync(path.join(rootDir, 'docs/MCP_SETUP.md'), 'utf-8');
    expect(mcpDoc).toContain('memory-map');
    expect(mcpDoc).toContain('Interconnected Memory Map MCP Capabilities');
  });

  it('has comprehensive documentation in docs/MCP_SETUP.md', () => {
    const docPath = path.join(rootDir, 'docs/MCP_SETUP.md');
    expect(fs.existsSync(docPath)).toBe(true);

    const doc = fs.readFileSync(docPath, 'utf-8');
    expect(doc).toContain('chrome-devtools');
    expect(doc).toContain('Antigravity (AGY)');
    expect(doc).toContain('OpenCode');
    expect(doc).toContain('Claude');
    expect(doc).toContain('Cursor');
  });
});
