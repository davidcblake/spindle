"use client";

import { openDB, type IDBPDatabase } from "idb";
import type { JournalEntry } from "./study";

/**
 * Local-first journal cache (IndexedDB). The source of truth is Supabase;
 * this cache makes the journal fully readable offline and instant to open.
 * Deletions made offline are queued and replayed on reconnect.
 */

const DB_NAME = "spindle";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore("journal", { keyPath: "id" });
        database.createObjectStore("pendingDeletes", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function cacheJournal(entries: JournalEntry[]): Promise<void> {
  try {
    const database = await db();
    const tx = database.transaction("journal", "readwrite");
    await tx.store.clear();
    for (const entry of entries) await tx.store.put(entry);
    await tx.done;
  } catch {
    // Private browsing / quota exceeded — the app still works in-memory.
  }
}

export async function readCachedJournal(): Promise<JournalEntry[]> {
  try {
    const database = await db();
    const entries = (await database.getAll("journal")) as JournalEntry[];
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export async function cacheEntry(entry: JournalEntry): Promise<void> {
  try {
    const database = await db();
    await database.put("journal", entry);
  } catch {
    /* non-fatal */
  }
}

export async function removeCachedEntry(id: string): Promise<void> {
  try {
    const database = await db();
    await database.delete("journal", id);
  } catch {
    /* non-fatal */
  }
}

export async function queuePendingDelete(id: string): Promise<void> {
  try {
    const database = await db();
    await database.put("pendingDeletes", { id });
  } catch {
    /* non-fatal */
  }
}

export async function drainPendingDeletes(): Promise<string[]> {
  try {
    const database = await db();
    const pending = (await database.getAll("pendingDeletes")) as { id: string }[];
    return pending.map((p) => p.id);
  } catch {
    return [];
  }
}

export async function clearPendingDelete(id: string): Promise<void> {
  try {
    const database = await db();
    await database.delete("pendingDeletes", id);
  } catch {
    /* non-fatal */
  }
}
