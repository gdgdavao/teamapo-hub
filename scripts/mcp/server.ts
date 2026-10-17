#!/usr/bin/env bun
/**
 * Apohub Dev MCP Server
 * Model Context Protocol server for local Firebase emulator development,
 * Firestore inspection, rules validation, and project quality gates.
 *
 * Designed following KISS, SOLID, and DRY principles.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getEmulatorStatus, invokeCloudFunction } from './tools/emulator';
import { queryFirestoreCollection, getFirestoreDocument, ALLOWED_COLLECTIONS } from './tools/firestore';
import { seedEmulatorData, validateRulesAndIndexes, runQualityGate } from './tools/scripts';

export function createApohubMcpServer(): McpServer {
  const server = new McpServer({
    name: 'apohub-dev-mcp',
    version: '1.0.0'
  });

  // Tool 1: Emulator Health
  server.tool(
    'get_emulator_status',
    'Checks the status of all local Firebase emulators (Firestore :8080, Auth :9099, Functions :5001, Storage :9199, UI :4000).',
    {},
    async () => {
      try {
        const report = await getEmulatorStatus();
        return {
          content: [{ type: 'text', text: JSON.stringify(report, null, 2) }]
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to check emulator status: ${err instanceof Error ? err.message : String(err)}` }]
        };
      }
    }
  );

  // Tool 2: Invoke Local Cloud Function
  server.tool(
    'invoke_cloud_function',
    'Invokes a local 2nd Gen Python Cloud Function running on the emulator (:5001).',
    {
      functionName: z.string().describe('Name of the Cloud Function (e.g., createAnonymousRegistration, verifyPaymentProof)'),
      data: z.record(z.unknown()).optional().describe('Payload object to send in the request body'),
      authUid: z.string().optional().describe('Optional Firebase user UID to simulate authenticated organizer/admin')
    },
    async ({ functionName, data, authUid }) => {
      try {
        const res = await invokeCloudFunction(functionName, data ?? {}, { authUid });
        return {
          content: [{ type: 'text', text: JSON.stringify(res, null, 2) }]
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Function invocation error: ${err instanceof Error ? err.message : String(err)}` }]
        };
      }
    }
  );

  // Tool 3: Query Firestore Collection
  server.tool(
    'query_firestore_collection',
    'Queries a Firestore collection on the local emulator. Complies with Data Privacy Act of 2012 by scrubbing sensitive credentials.',
    {
      collection: z.enum(ALLOWED_COLLECTIONS).describe('Target collection name'),
      limit: z.number().int().min(1).max(50).optional().default(10).describe('Max documents to return (1-50, default: 10)'),
      filterField: z.string().optional().describe('Document field name to filter by equality'),
      filterValue: z.unknown().optional().describe('Value to match for filterField'),
      orderByField: z.string().optional().describe('Document field to sort by'),
      orderDirection: z.enum(['asc', 'desc']).optional().default('desc').describe('Sort direction')
    },
    async (params) => {
      try {
        const result = await queryFirestoreCollection(params);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Firestore query error: ${err instanceof Error ? err.message : String(err)}` }]
        };
      }
    }
  );

  // Tool 4: Get Firestore Document
  server.tool(
    'get_firestore_document',
    'Fetches a single document from the local Firestore emulator by collection and document ID.',
    {
      collection: z.enum(ALLOWED_COLLECTIONS).describe('Collection name'),
      docId: z.string().describe('Document ID to fetch')
    },
    async ({ collection, docId }) => {
      try {
        const doc = await getFirestoreDocument(collection, docId);
        return {
          content: [{ type: 'text', text: JSON.stringify(doc, null, 2) }]
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Firestore get error: ${err instanceof Error ? err.message : String(err)}` }]
        };
      }
    }
  );

  // Tool 5: Seed Sample Data
  server.tool(
    'seed_emulator_data',
    'Populates the Firebase emulator with realistic test data for development.',
    {
      mode: z.enum(['full', 'users-only']).optional().default('full').describe('full (events, attendees, tickets, payments) or users-only'),
      seedPassword: z.string().optional().describe('Optional custom password for seeded users (defaults to dev password)')
    },
    async ({ mode, seedPassword }) => {
      try {
        const result = await seedEmulatorData(mode, seedPassword);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Seed script error: ${err instanceof Error ? err.message : String(err)}` }]
        };
      }
    }
  );

  // Tool 6: Validate Rules & Indexes
  server.tool(
    'validate_rules_and_indexes',
    'Validates Firestore security rules (firestore.rules) and composite indexes (firestore.indexes.json).',
    {},
    async () => {
      try {
        const result = await validateRulesAndIndexes();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Validation error: ${err instanceof Error ? err.message : String(err)}` }]
        };
      }
    }
  );

  // Tool 7: Run Quality Gates
  server.tool(
    'run_quality_gates',
    'Executes project quality gates (typecheck, lint, test:unit, test:rules, or all).',
    {
      gate: z.enum(['typecheck', 'lint', 'test:unit', 'test:rules', 'build', 'all']).describe('Quality gate to run')
    },
    async ({ gate }) => {
      try {
        const result = await runQualityGate(gate);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      } catch (err: unknown) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Quality gate error: ${err instanceof Error ? err.message : String(err)}` }]
        };
      }
    }
  );

  return server;
}

export async function runServer(): Promise<void> {
  const server = createApohubMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 Apohub Dev MCP Server running on stdio');
}

if (import.meta.main || process.argv[1]?.endsWith('server.ts')) {
  runServer().catch((err) => {
    console.error('Fatal error starting Apohub Dev MCP server:', err);
    process.exit(1);
  });
}
