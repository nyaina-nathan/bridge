import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../prisma/generated/client";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({
  connectionString,
  // The pg adapter assumes timestamptz values are already in UTC. Pin the
  // session so reads don't shift with the server's local timezone.
  options: "-c timezone=UTC",
});
const prisma = new PrismaClient({ adapter });

export { prisma };