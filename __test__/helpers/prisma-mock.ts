import { vi } from "vitest";

type MockFn = ReturnType<typeof vi.fn>;

/**
 * Shape of the Prisma client used by the services. Only the delegates and
 * escape hatches the services touch are modelled; every method is a `vi.fn`.
 */
export type PrismaMock = {
  users: {
    findUnique: MockFn;
    count: MockFn;
    create: MockFn;
  };
  couples: {
    findUnique: MockFn;
    create: MockFn;
  };
  conflicts: {
    create: MockFn;
    findMany: MockFn;
    findFirst: MockFn;
    update: MockFn;
    updateMany: MockFn;
  };
  messages: {
    findMany: MockFn;
    create: MockFn;
  };
  perspectives: {
    findUnique: MockFn;
    upsert: MockFn;
    update: MockFn;
    updateMany: MockFn;
    count: MockFn;
  };
  refresh_tokens: {
    findUnique: MockFn;
    create: MockFn;
    updateMany: MockFn;
  };
  $queryRaw: MockFn;
  $transaction: MockFn;
};

/**
 * Builds a fresh deep mock of `prisma`. Interactive transactions run their
 * callback against this same object, matching how the services use `tx`.
 */
export function createPrismaMock(): PrismaMock {
  const prisma: PrismaMock = {
    users: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    couples: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    conflicts: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    messages: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    perspectives: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    refresh_tokens: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };

  resetPrismaMock(prisma);

  return prisma;
}

/**
 * Re-installs the default interactive-transaction behaviour after
 * `mockReset: true` wipes every mock implementation before each test.
 */
export function resetPrismaMock(prisma: PrismaMock): void {
  prisma.$transaction.mockReset();
  prisma.$transaction.mockImplementation(
    async (input: unknown): Promise<unknown> => {
      if (typeof input === "function") {
        return (input as (tx: PrismaMock) => unknown)(prisma);
      }

      return input;
    },
  );
}
