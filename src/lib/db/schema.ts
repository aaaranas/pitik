import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import type { Capture, OutboxItem, Roll, Settings, Strip } from "./types";

export const DB_NAME = "pitik";
export const DB_VERSION = 1;

export interface PitikDB extends DBSchema {
  rolls: {
    key: string;
    value: Roll;
    indexes: {
      by_updated: number;
      by_share_code: string;
      by_sync: string;
    };
  };
  captures: {
    key: string;
    value: Capture;
    indexes: {
      by_roll: string;
      /** Compound so a roll's frames come back already in shooting order. */
      by_roll_created: [string, number];
      by_sync: string;
    };
  };
  strips: {
    key: string;
    value: Strip;
    indexes: {
      by_roll: string;
      by_created: number;
      by_sync: string;
    };
  };
  outbox: {
    key: string;
    value: OutboxItem;
    indexes: { by_next_attempt: number };
  };
  settings: {
    key: string;
    value: Settings;
  };
}

let instance: Promise<IDBPDatabase<PitikDB>> | null = null;

/**
 * Opens (and memoises) the database.
 *
 * Guarded so importing anything from the data layer stays safe during SSR —
 * every page in this app is server-rendered first, and none of them may touch
 * IndexedDB while doing it.
 */
export function getDB(): Promise<IDBPDatabase<PitikDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable in this environment."));
  }
  if (!instance) {
    instance = openDB<PitikDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Written as a fall-through ladder so future versions only ever add
        // the delta. Never reorder or renumber these blocks.
        if (oldVersion < 1) {
          const rolls = db.createObjectStore("rolls", { keyPath: "id" });
          rolls.createIndex("by_updated", "updatedAt");
          rolls.createIndex("by_share_code", "shareCode");
          rolls.createIndex("by_sync", "syncState");

          const captures = db.createObjectStore("captures", { keyPath: "id" });
          captures.createIndex("by_roll", "rollId");
          captures.createIndex("by_roll_created", ["rollId", "createdAt"]);
          captures.createIndex("by_sync", "syncState");

          const strips = db.createObjectStore("strips", { keyPath: "id" });
          strips.createIndex("by_roll", "rollId");
          strips.createIndex("by_created", "createdAt");
          strips.createIndex("by_sync", "syncState");

          const outbox = db.createObjectStore("outbox", { keyPath: "id" });
          outbox.createIndex("by_next_attempt", "nextAttemptAt");

          db.createObjectStore("settings");
        }
      },
      blocked() {
        console.warn("[pitik] Another tab is holding an older database open.");
      },
      terminated() {
        // Chrome can kill the connection under memory pressure mid-session.
        // Dropping the memo means the next call transparently reopens.
        instance = null;
      },
    });
  }
  return instance;
}

/** Test seam — forces the next {@link getDB} call to reopen. */
export function resetDBHandle(): void {
  instance = null;
}
