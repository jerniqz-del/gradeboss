import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "./types.js";
import { seedData } from "./seed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * A tiny, dependency-free JSON file store. Chosen over a native database
 * (e.g. better-sqlite3) so the environment needs no build toolchain and stays
 * reproducible across Cloud Agent boots.
 */
export class Store {
  private data: Database;

  constructor(private readonly filePath: string) {
    this.data = this.load();
  }

  private load(): Database {
    if (existsSync(this.filePath)) {
      try {
        return JSON.parse(readFileSync(this.filePath, "utf-8")) as Database;
      } catch {
        // Corrupt file: fall back to a fresh seed rather than crashing.
      }
    }
    const seeded = seedData();
    this.persist(seeded);
    return seeded;
  }

  private persist(data: Database): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  private save(): void {
    this.persist(this.data);
  }

  getAll(): Database {
    return this.data;
  }

  add<K extends keyof Database>(collection: K, item: Database[K][number]): Database[K][number] {
    (this.data[collection] as Database[K][number][]).push(item);
    this.save();
    return item;
  }

  remove<K extends keyof Database>(collection: K, id: string): boolean {
    const list = this.data[collection] as { id: string }[];
    const index = list.findIndex((entry) => entry.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    this.save();
    return true;
  }

  reset(): void {
    this.data = seedData();
    this.save();
  }
}

export const defaultDataFile = resolve(__dirname, "..", "data", "gradeboss.json");
