// ============================================================================
// Chainable mock Supabase client.
//
// Every query-builder method returns `this` so any chain depth works without
// per-test setup. Terminal methods (`single`, `rpc`, `then`-promise-like
// behaviour) can be overridden per test.
//
// `from()` accepts an optional per-table resolver:
//   createMockSupabaseClient({ tableResolvers: { profiles: { single: ... }}})
// ============================================================================
import { vi } from "vitest";

type AnyFn = (...args: unknown[]) => unknown;

interface MockClient {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    exchangeCodeForSession: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  [k: string]: unknown;
}

export interface MockSupabaseOptions {
  /** Initial user returned by `auth.getUser()`. */
  user?: { id: string } | null;
  /** Default value for `single()` chains. */
  singleData?: unknown;
  /** Map of RPC name → resolved value. Catch-all default returned for unmatched names. */
  rpcResults?: Record<string, unknown>;
  /** Override responses per source table (anything chained off `from(table)`). */
  tableResolvers?: Record<string, Partial<MockClient>>;
}

export function createMockSupabaseClient(opts: MockSupabaseOptions = {}): MockClient {
  const { user = null, singleData = null, rpcResults = {}, tableResolvers = {} } = opts;

  const client: MockClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn((table: string) => {
      const override = tableResolvers[table];
      if (override) {
        // Return a fresh chainable proxy that uses the override for terminal methods
        return makeChainable({ ...override });
      }
      return client;
    }) as unknown as ReturnType<typeof vi.fn>,
    select: vi.fn(function (this: MockClient) { return this; }),
    insert: vi.fn(function (this: MockClient) { return this; }),
    update: vi.fn(function (this: MockClient) { return this; }),
    delete: vi.fn(function (this: MockClient) { return this; }),
    eq: vi.fn(function (this: MockClient) { return this; }),
    not: vi.fn(function (this: MockClient) { return this; }),
    in: vi.fn(function (this: MockClient) { return this; }),
    gte: vi.fn(function (this: MockClient) { return this; }),
    lte: vi.fn(function (this: MockClient) { return this; }),
    order: vi.fn(function (this: MockClient) { return this; }),
    limit: vi.fn(function (this: MockClient) { return this; }),
    single: vi.fn().mockResolvedValue({ data: singleData, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: singleData, error: null }),
    rpc: vi.fn(async (name: string) => ({
      data: name in rpcResults ? rpcResults[name] : null,
      error: null,
    })),
  };

  // Make chainables bound to the right `this`
  for (const key of ["select", "insert", "update", "delete", "eq", "not", "in", "gte", "lte", "order", "limit"] as const) {
    (client[key] as unknown as { mockImplementation: (fn: AnyFn) => void }).mockImplementation(
      () => client
    );
  }

  return client;
}

/** Build a self-chainable object from a partial spec. Each method returned by
 *  the chain proxies back to itself unless overridden. */
function makeChainable(overrides: Record<string, unknown>): Record<string, unknown> {
  const target: Record<string, unknown> = {
    select: () => target,
    insert: () => target,
    update: () => target,
    delete: () => target,
    eq: () => target,
    not: () => target,
    in: () => target,
    gte: () => target,
    lte: () => target,
    order: () => target,
    limit: () => target,
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return Object.assign(target, overrides);
}

/** Convenience: build a Supabase mock where `auth.getUser()` returns a real user. */
export function authedMock(userId = "user-1", opts: MockSupabaseOptions = {}) {
  return createMockSupabaseClient({ ...opts, user: { id: userId } });
}
