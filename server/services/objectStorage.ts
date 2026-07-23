import { Client } from "@replit/object-storage";
import { randomUUID } from "crypto";
import type { Readable } from "stream";

// Uses the Repl's default bucket automatically (DEFAULT_OBJECT_STORAGE_BUCKET_ID) - no bucketId
// needed here. Object Storage is Replit-only infrastructure; this module will throw on any call
// if run somewhere that doesn't have a bucket provisioned (e.g. local dev without Replit env vars).
//
// Lazily constructed - the Client constructor reaches out to a local Replit sidecar immediately,
// and if that connection fails it surfaces as an unhandled promise rejection that crashes the
// whole process, not just the caller. Constructing it only when actually needed means importing
// this module (which happens at server startup) can never take the server down; only an actual
// upload/download call can fail, and only in an environment without Object Storage available.
let client: Client | null = null;
function getClient(): Client {
  if (!client) {
    client = new Client();
  }
  return client;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
}

// A random prefix per upload avoids collisions and makes filenames unguessable, while keeping
// the original filename visible in the key for anyone browsing the bucket directly.
export function buildObjectKey(folder: string, originalFilename: string): string {
  return `${folder}/${randomUUID()}-${sanitizeFilename(originalFilename)}`;
}

export async function uploadObject(key: string, buffer: Buffer): Promise<void> {
  const result = await getClient().uploadFromBytes(key, buffer);
  if (!result.ok) {
    throw new Error(`Object storage upload failed for "${key}": ${result.error.message}`);
  }
}

// Streams straight through to Object Storage instead of buffering the whole file into a Buffer
// first - use this for anything that could be large (videos), where multer's memoryStorage +
// uploadFromBytes would hold the entire file in server RAM at once and risk an OOM kill on a
// memory-constrained host. Unlike uploadFromBytes, this SDK method throws directly rather than
// returning a Result, so no `.ok` check here.
export async function uploadObjectFromStream(key: string, stream: Readable): Promise<void> {
  await getClient().uploadFromStream(key, stream);
}

export async function downloadObject(key: string): Promise<Buffer> {
  const result = await getClient().downloadAsBytes(key);
  if (!result.ok) {
    throw new Error(`Object storage download failed for "${key}": ${result.error.message}`);
  }
  return result.value[0];
}

// Streams the object straight to the caller instead of buffering it into one Buffer first -
// same rationale as uploadObjectFromStream. Use this for anything that could be large (videos)
// and especially anything served for in-browser playback, where the whole file being held in
// server RAM on every view is both a memory risk and unnecessary latency.
export function downloadObjectAsStream(key: string): Readable {
  return getClient().downloadAsStream(key);
}

export async function deleteObject(key: string): Promise<void> {
  const result = await getClient().delete(key, { ignoreNotFound: true });
  if (!result.ok) {
    throw new Error(`Object storage delete failed for "${key}": ${result.error.message}`);
  }
}

export async function objectExists(key: string): Promise<boolean> {
  const result = await getClient().exists(key);
  if (!result.ok) {
    throw new Error(`Object storage exists-check failed for "${key}": ${result.error.message}`);
  }
  return result.value;
}
