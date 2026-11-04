import { readFile } from "node:fs/promises";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool, type QueryResultRow } from "pg";

export type TestDatabase = {
  connectionUri: string;
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ) => Promise<T[]>;
  reset: () => Promise<void>;
  stop: () => Promise<void>;
};

/**
 * Boots a throwaway PostgreSQL instance and applies the canonical MVP schema
 * from `docs/db/`, avoiding any assumption about a Prisma migration chain.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("bridge")
    .withUsername("bridge")
    .withPassword("bridge")
    .start();

  const connectionUri = container.getConnectionUri();
  const pool = new Pool({ connectionString: connectionUri });

  try {
    const schema = await readFile(
      new URL("../../docs/db/V1__table_init.sql", import.meta.url),
      "utf8",
    );

    await pool.query(schema);
  } catch (error) {
    await pool.end();
    await container.stop();
    throw error;
  }

  return {
    connectionUri,
    query: async <T extends QueryResultRow = QueryResultRow>(
      text: string,
      values?: unknown[],
    ) => {
      const result = await pool.query<T>(text, values);
      return result.rows;
    },
    reset: async () => {
      await pool.query(
        "TRUNCATE TABLE refresh_tokens, messages, perspectives, conflicts, users, couples RESTART IDENTITY CASCADE",
      );
    },
    stop: async () => {
      await pool.end();
      await container.stop();
    },
  };
}
