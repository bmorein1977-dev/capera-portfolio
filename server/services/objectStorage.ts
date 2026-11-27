// Where uploaded files are kept: evidence, certificates, CVs, photos, learning packages and audit documents.
//
//   STORAGE_DRIVER=azure        Azure Blob Storage. AZURE_STORAGE_CONTAINER_URL is the container's address with a SAS token that allows
//                               read, write and delete, for example https://account.blob.core.windows.net/capera?sv=...&sig=...
//   STORAGE_DRIVER=filesystem   a folder on the server or a mounted share. STORAGE_DIR is its full path. Back it up and restrict access to it.
//   STORAGE_DRIVER=replit       Replit object storage (the default when nothing else is set)
//
// For development and tests, LOCAL_OBJECT_STORAGE_DIR (ignored in production) keeps files in a folder.
import { Client } from "@replit/object-storage";
import { randomUUID } from "crypto";
import { PassThrough, Readable } from "stream";
import { pipeline } from "stream/promises";
import fs from "fs";
import os from "os";
import path from "path";

export type StorageDriver = "azure" | "filesystem" | "replit";

export function storageDriver(env: NodeJS.ProcessEnv = process.env): { driver: StorageDriver; dir?: string; containerUrl?: string } {
  const chosen = (env.STORAGE_DRIVER ?? "").trim().toLowerCase();
  if (chosen === "azure") {
    if (!env.AZURE_STORAGE_CONTAINER_URL) throw new Error("STORAGE_DRIVER=azure needs AZURE_STORAGE_CONTAINER_URL (the container address with its SAS token)");
    return { driver: "azure", containerUrl: env.AZURE_STORAGE_CONTAINER_URL };
  }
  if (chosen === "filesystem") {
    if (!env.STORAGE_DIR || !path.isAbsolute(env.STORAGE_DIR)) throw new Error("STORAGE_DRIVER=filesystem needs STORAGE_DIR, a full folder path");
    return { driver: "filesystem", dir: env.STORAGE_DIR };
  }
  if (chosen && chosen !== "replit") throw new Error(`Unknown STORAGE_DRIVER "${chosen}". Use azure, filesystem or replit.`);
  if (!chosen && env.NODE_ENV !== "production" && env.LOCAL_OBJECT_STORAGE_DIR) return { driver: "filesystem", dir: env.LOCAL_OBJECT_STORAGE_DIR };
  return { driver: "replit" };
}

// Lazily constructed: the Replit client reaches out to a local Replit service immediately, and a failure there would otherwise stop the server.
let client: Client | null = null;
function replit(): Client {
  if (!client) client = new Client();
  return client;
}

function localPath(dir: string, key: string): string {
  const root = path.resolve(dir), full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Object key is outside the storage folder");
  return full;
}

/** the address of one blob: the container address, the key, and the token that came with the container address */
export function azureBlobUrl(containerUrl: string, key: string): string {
  const u = new URL(containerUrl);
  const safe = key.split("/").map(encodeURIComponent).join("/");
  if (key.split("/").some((part) => part === ".." || part === "")) throw new Error("Object key is not valid");
  u.pathname = `${u.pathname.replace(/\/+$/, "")}/${safe}`;
  return u.toString();
}
// the token is part of the address, so an error message must never include the address
async function azure(method: string, containerUrl: string, key: string, init: RequestInit & { duplex?: "half" } = {}): Promise<Response> {
  const res = await fetch(azureBlobUrl(containerUrl, key), { ...init, method, headers: { "x-ms-version": "2021-08-06", ...(init.headers as Record<string, string> | undefined) } });
  if (!res.ok && !(method === "DELETE" && res.status === 404) && !(method === "HEAD" && res.status === 404)) {
    throw new Error(`Object storage ${method} failed for "${key}": ${res.status} ${res.statusText}`);
  }
  return res;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
}

// A random prefix per upload avoids collisions and makes filenames unguessable, while keeping the original filename visible in the key.
export function buildObjectKey(folder: string, originalFilename: string): string {
  return `${folder}/${randomUUID()}-${sanitizeFilename(originalFilename)}`;
}

export async function uploadObject(key: string, buffer: Buffer): Promise<void> {
  const s = storageDriver();
  if (s.driver === "filesystem") {
    const file = localPath(s.dir!, key);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.writeFile(file, buffer);
    return;
  }
  if (s.driver === "azure") {
    await azure("PUT", s.containerUrl!, key, { body: new Uint8Array(buffer), headers: { "x-ms-blob-type": "BlockBlob", "content-length": String(buffer.length) } });
    return;
  }
  const result = await replit().uploadFromBytes(key, buffer);
  if (!result.ok) throw new Error(`Object storage upload failed for "${key}": ${result.error.message}`);
}

// For anything that could be large (videos): the file is not held in memory.
export async function uploadObjectFromStream(key: string, stream: Readable): Promise<void> {
  const s = storageDriver();
  if (s.driver === "filesystem") {
    const file = localPath(s.dir!, key);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await pipeline(stream, fs.createWriteStream(file));
    return;
  }
  if (s.driver === "azure") {
    // Azure needs the length before it starts, so the stream is first written to a temporary file
    const temp = path.join(os.tmpdir(), `capera-upload-${randomUUID()}`);
    try {
      await pipeline(stream, fs.createWriteStream(temp));
      const { size } = await fs.promises.stat(temp);
      await azure("PUT", s.containerUrl!, key, { body: Readable.toWeb(fs.createReadStream(temp)) as any, duplex: "half", headers: { "x-ms-blob-type": "BlockBlob", "content-length": String(size) } });
    } finally {
      await fs.promises.rm(temp, { force: true });
    }
    return;
  }
  await replit().uploadFromStream(key, stream);
}

export async function downloadObject(key: string): Promise<Buffer> {
  const s = storageDriver();
  if (s.driver === "filesystem") return fs.promises.readFile(localPath(s.dir!, key));
  if (s.driver === "azure") return Buffer.from(await (await azure("GET", s.containerUrl!, key)).arrayBuffer());
  const result = await replit().downloadAsBytes(key);
  if (!result.ok) throw new Error(`Object storage download failed for "${key}": ${result.error.message}`);
  return result.value[0];
}

export function downloadObjectAsStream(key: string): Readable {
  const s = storageDriver();
  if (s.driver === "filesystem") return fs.createReadStream(localPath(s.dir!, key));
  if (s.driver === "azure") {
    const out = new PassThrough();
    azure("GET", s.containerUrl!, key)
      .then((res) => pipeline(Readable.fromWeb(res.body as any), out))
      .catch((err) => out.destroy(err as Error));
    return out;
  }
  return replit().downloadAsStream(key);
}

export async function deleteObject(key: string): Promise<void> {
  const s = storageDriver();
  if (s.driver === "filesystem") { await fs.promises.rm(localPath(s.dir!, key), { force: true }); return; }
  if (s.driver === "azure") { await azure("DELETE", s.containerUrl!, key); return; }
  const result = await replit().delete(key, { ignoreNotFound: true });
  if (!result.ok) throw new Error(`Object storage delete failed for "${key}": ${result.error.message}`);
}

export async function objectExists(key: string): Promise<boolean> {
  const s = storageDriver();
  if (s.driver === "filesystem") return fs.existsSync(localPath(s.dir!, key));
  if (s.driver === "azure") return (await azure("HEAD", s.containerUrl!, key)).ok;
  const result = await replit().exists(key);
  if (!result.ok) throw new Error(`Object storage exists-check failed for "${key}": ${result.error.message}`);
  return result.value;
}
