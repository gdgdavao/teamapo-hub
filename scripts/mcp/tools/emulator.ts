/**
 * Emulator Health and Invocation Tools for Apohub Dev MCP Server
 */

export interface EmulatorEndpoint {
  name: string;
  port: number;
  url: string;
}

export interface EmulatorStatusReport {
  status: 'online' | 'partial' | 'offline';
  emulators: Record<string, { running: boolean; port: number; url: string; httpStatus?: number }>;
  activeCount: number;
  totalCount: number;
  instructions?: string;
}

export const DEFAULT_EMULATOR_ENDPOINTS: EmulatorEndpoint[] = [
  { name: 'firestore', port: 8080, url: 'http://127.0.0.1:8080/' },
  { name: 'auth', port: 9099, url: 'http://127.0.0.1:9099/' },
  { name: 'functions', port: 5001, url: 'http://127.0.0.1:5001/' },
  { name: 'storage', port: 9199, url: 'http://127.0.0.1:9199/' },
  { name: 'ui', port: 4000, url: 'http://127.0.0.1:4000/' }
];

export async function checkSingleEmulator(endpoint: EmulatorEndpoint, timeoutMs = 800): Promise<{ running: boolean; httpStatus?: number }> {
  try {
    const res = await fetch(endpoint.url, { signal: AbortSignal.timeout(timeoutMs) });
    // Any HTTP status (including 404/501 for root routes) confirms the emulator process is actively listening
    return { running: true, httpStatus: res.status };
  } catch {
    return { running: false };
  }
}

export async function getEmulatorStatus(endpoints = DEFAULT_EMULATOR_ENDPOINTS): Promise<EmulatorStatusReport> {
  const results: Record<string, { running: boolean; port: number; url: string; httpStatus?: number }> = {};
  let activeCount = 0;

  await Promise.all(
    endpoints.map(async (ep) => {
      const { running, httpStatus } = await checkSingleEmulator(ep);
      if (running) activeCount++;
      results[ep.name] = {
        running,
        port: ep.port,
        url: ep.url,
        httpStatus
      };
    })
  );

  let status: 'online' | 'partial' | 'offline' = 'offline';
  if (activeCount === endpoints.length) {
    status = 'online';
  } else if (activeCount > 0) {
    status = 'partial';
  }

  const instructions =
    status === 'offline'
      ? 'Emulators are offline. Run "bun run emulator:start" to launch local Firebase emulators.'
      : status === 'partial'
        ? 'Some emulators are not responding. Check "bun run emulator:start" logs.'
        : 'All Firebase emulators are operational.';

  return {
    status,
    emulators: results,
    activeCount,
    totalCount: endpoints.length,
    instructions
  };
}

export async function invokeCloudFunction(
  functionName: string,
  data: Record<string, unknown> = {},
  options?: { projectId?: string; region?: string; authUid?: string }
): Promise<{ success: boolean; status: number; data?: unknown; error?: string }> {
  const projectId = options?.projectId || process.env.GCLOUD_PROJECT || 'demo-apohub';
  const region = options?.region || 'asia-southeast2';
  const url = `http://127.0.0.1:5001/${projectId}/${region}/${functionName}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (options?.authUid) {
      headers['Authorization'] = `Bearer owner`;
      headers['x-apohub-auth-uid'] = options.authUid;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data }),
      signal: AbortSignal.timeout(10000)
    });

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }

    return {
      success: res.ok,
      status: res.status,
      data: parsed
    };
  } catch (err: unknown) {
    return {
      success: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
