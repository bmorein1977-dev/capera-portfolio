import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import pg from 'pg';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";
import { createLocalDevPgMemPool } from "./localDevDb";

const { Pool: NodePgPool } = pg;

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Local-dev-only sentinel: an in-memory Postgres (no real server) for environments
// where provisioning a real database isn't practical. See server/localDevDb.ts.
const isLocalDevPgMem = process.env.DATABASE_URL === "pgmem://local";

// Neon's serverless driver requires Neon's websocket proxy, which only exists for
// neon.tech-hosted databases. For a plain local/self-hosted Postgres (local dev),
// fall back to the standard node-postgres driver instead.
const isNeonDatabase = process.env.DATABASE_URL.includes("neon.tech");

export const pool = isLocalDevPgMem
  ? createLocalDevPgMemPool()
  : isNeonDatabase
    ? new NeonPool({ connectionString: process.env.DATABASE_URL })
    : new NodePgPool({ connectionString: process.env.DATABASE_URL });

export const db = isNeonDatabase
  ? drizzleNeon({ client: pool as NeonPool, schema })
  : drizzleNodePg(pool as any, { schema });
