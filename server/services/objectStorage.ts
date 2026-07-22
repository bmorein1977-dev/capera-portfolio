import { Client } from "@replit/object-storage";
import { randomUUID } from "crypto";

// Uses the Repl's default bucket automatically (DEFAULT_OBJECT_STORAGE_BUCKET_ID) - no bucketId
// needed here. Object Storage is Replit-only infrastructure; this module will throw on any call
// if run somewhere that doesn't have a bucket provisioned (e.g. local dev without Replit env vars).
const client = new Client();

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
}

// A random prefix per upload avoids collisions and makes filenames unguessable, while keeping
// the original filename visible in the key for anyone browsing the bucket directly.
export function buildObjectKey(folder: string, originalFilename: string): string {
  return `${folder}/${randomUUID()}-${sanitizeFilename(originalFilename)}`;
}

export async function uploadObject(key: string, buffer: Buffer): Promise<void> {
  const result = await client.uploadFromBytes(key, buffer);
  if (!result.ok) {
    throw new Error(`Object storage upload failed for "${key}": ${result.error.message}`);
  }
}

export async function downloadObject(key: string): Promise<Buffer> {
  const result = await client.downloadAsBytes(key);
  if (!result.ok) {
    throw new Error(`Object storage download failed for "${key}": ${result.error.message}`);
  }
  return result.value[0];
}

export async function deleteObject(key: string): Promise<void> {
  const result = await client.delete(key, { ignoreNotFound: true });
  if (!result.ok) {
    throw new Error(`Object storage delete failed for "${key}": ${result.error.message}`);
  }
}

export async function objectExists(key: string): Promise<boolean> {
  const result = await client.exists(key);
  if (!result.ok) {
    throw new Error(`Object storage exists-check failed for "${key}": ${result.error.message}`);
  }
  return result.value;
}
