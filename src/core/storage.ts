// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import fs from 'node:fs';
import path from 'node:path';
import type {
  MeshPacket,
  SneakernetBundle
} from './types.ts';
import { CMSH_MAGIC, PRIORITY_WEIGHTS } from './types.ts';
import { verifyPacketSignature } from './identity.ts';

export interface StorageOptions {
  maxPackets?: number;
  seenCacheTtlSeconds?: number;
  storagePath?: string;
}

/**
 * Delay-Tolerant Store-and-Forward Queue with priority scheduling,
 * duplicate filtering, persistence journaling and sneakernet bundle support.
 */
export class StoreAndForwardQueue {
  private queue: MeshPacket[] = [];
  private seenPackets = new Map<string, number>(); // packetId -> expiresAt
  private readonly maxPackets: number;
  private readonly seenTtlMs: number;
  private readonly storagePath?: string;

  constructor(options: StorageOptions = {}) {
    this.maxPackets = options.maxPackets ?? 500;
    this.seenTtlMs = (options.seenCacheTtlSeconds ?? 3600) * 1000;
    this.storagePath = options.storagePath;

    if (this.storagePath) {
      this.loadJournal();
    }
  }

  public isDuplicate(packetId: string): boolean {
    this.purgeExpiredSeen();
    return this.seenPackets.has(packetId);
  }

  public markSeen(packetId: string): void {
    this.seenPackets.set(packetId, Date.now() + this.seenTtlMs);
  }

  public enqueue(packet: MeshPacket): boolean {
    if (this.isExpired(packet)) {
      return false;
    }

    if (this.queue.some((p) => p.header.id === packet.header.id)) {
      return false;
    }

    this.markSeen(packet.header.id);

    // If buffer is full, remove oldest lowest-priority item
    if (this.queue.length >= this.maxPackets) {
      this.evictLowestPriority();
    }

    this.queue.push(packet);
    this.sortQueue();
    this.persistJournal();
    return true;
  }

  public peek(): MeshPacket | undefined {
    this.purgeExpired();
    return this.queue[0];
  }

  public dequeue(): MeshPacket | undefined {
    this.purgeExpired();
    const packet = this.queue.shift();
    if (packet) {
      this.persistJournal();
    }
    return packet;
  }

  public getAll(): MeshPacket[] {
    this.purgeExpired();
    return [...this.queue];
  }

  public size(): number {
    this.purgeExpired();
    return this.queue.length;
  }

  public clear(): void {
    this.queue = [];
  }

  public isExpired(packet: MeshPacket, now = Date.now()): boolean {
    const expiresAt = packet.header.timestamp + packet.header.ttl * 1000;
    return now > expiresAt;
  }

  public purgeExpired(now = Date.now()): number {
    const initial = this.queue.length;
    this.queue = this.queue.filter((p) => !this.isExpired(p, now));
    return initial - this.queue.length;
  }

  private purgeExpiredSeen(now = Date.now()): void {
    for (const [id, expiresAt] of this.seenPackets.entries()) {
      if (now > expiresAt) {
        this.seenPackets.delete(id);
      }
    }
  }

  private sortQueue(): void {
    // Sort by priority descending (critical first), then by timestamp ascending (FIFO for same priority)
    this.queue.sort((a, b) => {
      const weightA = PRIORITY_WEIGHTS[a.header.priority] ?? 50;
      const weightB = PRIORITY_WEIGHTS[b.header.priority] ?? 50;
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      return a.header.timestamp - b.header.timestamp;
    });
  }

  private evictLowestPriority(): void {
    // Evict lowest priority (last items in sorted queue)
    if (this.queue.length > 0) {
      this.queue.pop();
      this.persistJournal();
    }
  }

  private loadJournal(): void {
    try {
      if (!this.storagePath || !fs.existsSync(this.storagePath)) return;
      const raw = fs.readFileSync(this.storagePath, 'utf8');
      const loaded = JSON.parse(raw) as MeshPacket[];
      if (Array.isArray(loaded)) {
        for (const packet of loaded) {
          if (verifyPacketSignature(packet) && !this.isExpired(packet)) {
            this.seenPackets.set(packet.header.id, Date.now() + this.seenTtlMs);
            this.queue.push(packet);
          }
        }
        this.sortQueue();
      }
    } catch {
      // In disaster situations, fail soft if journal read error
    }
  }

  private persistJournal(): void {
    if (!this.storagePath) return;
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmp = `${this.storagePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.queue, null, 2), 'utf8');
      fs.renameSync(tmp, this.storagePath);
    } catch {
      // Fallback
    }
  }

  /**
   * Serializes buffered packets into a portable sneakernet bundle.
   */
  public exportBundle(exporterNodeId: string, notes?: string): SneakernetBundle {
    this.purgeExpired();
    return {
      magic: CMSH_MAGIC,
      exportedAt: Date.now(),
      exporterNodeId,
      notes,
      packetCount: this.queue.length,
      packets: [...this.queue]
    };
  }

  /**
   * Imports packets from a sneakernet bundle, validating signatures and dropping duplicates.
   */
  public importBundle(bundle: SneakernetBundle): { imported: number; rejected: number } {
    if (bundle.magic !== CMSH_MAGIC || !Array.isArray(bundle.packets)) {
      throw new Error('[CMSH-ERR-3102] Invalid sneakernet bundle format or magic header');
    }
    let imported = 0;
    let rejected = 0;

    for (const packet of bundle.packets) {
      if (!verifyPacketSignature(packet)) {
        rejected++;
        continue;
      }
      if (this.enqueue(packet)) {
        imported++;
      } else {
        rejected++;
      }
    }

    return { imported, rejected };
  }
}
