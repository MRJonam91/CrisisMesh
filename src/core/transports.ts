// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Manoj Rollo (MRJonam91)

import dgram from 'node:dgram';
import type { MeshPacket, RadioSimulationProfile } from './types.ts';

export type PacketHandler = (packet: MeshPacket, fromAddress: string) => void;

export interface MeshTransport {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  broadcast(packet: MeshPacket): Promise<void>;
  sendTo(packet: MeshPacket, destinationAddress: string): Promise<void>;
  onPacket(handler: PacketHandler): void;
}

/**
 * Shared in-memory channel for simulated RF transmissions between virtual nodes.
 */
export class VirtualRadioChannel {
  private transports = new Set<VirtualRadioTransport>();

  public register(transport: VirtualRadioTransport): void {
    this.transports.add(transport);
  }

  public unregister(transport: VirtualRadioTransport): void {
    this.transports.delete(transport);
  }

  public async transmit(sender: VirtualRadioTransport, packet: MeshPacket): Promise<void> {
    const senderProfile = sender.getProfile();
    if (senderProfile.isPartitioned) {
      return; // Link physically down / blackout zone
    }

    for (const receiver of this.transports) {
      if (receiver === sender) {
        continue;
      }
      const receiverProfile = receiver.getProfile();
      if (receiverProfile.isPartitioned) {
        continue;
      }

      // Check packet loss simulation (combined sender + receiver loss)
      const combinedLoss = Math.max(
        senderProfile.packetLossRate,
        receiverProfile.packetLossRate
      );
      if (combinedLoss > 0 && Math.random() < combinedLoss) {
        continue; // Packet dropped by RF noise / attenuation
      }

      // Calculate total simulated flight delay
      const totalDelay = senderProfile.latencyMs + receiverProfile.latencyMs;

      // Delayed delivery
      if (totalDelay > 0) {
        setTimeout(() => {
          receiver.deliverIncoming(packet, `virtual://${sender.nodeId}`);
        }, totalDelay);
      } else {
        receiver.deliverIncoming(packet, `virtual://${sender.nodeId}`);
      }
    }
  }
}

/**
 * Virtual radio transport for lab trials, benchmarks and isolated node tests.
 */
export class VirtualRadioTransport implements MeshTransport {
  public readonly name = 'virtual-radio';
  public readonly nodeId: string;
  private channel: VirtualRadioChannel;
  private profile: RadioSimulationProfile;
  private handler: PacketHandler | null = null;
  private isRunning = false;

  constructor(
    nodeId: string,
    channel: VirtualRadioChannel,
    profile: RadioSimulationProfile = { latencyMs: 20, packetLossRate: 0 }
  ) {
    this.nodeId = nodeId;
    this.channel = channel;
    this.profile = { ...profile };
  }

  public getProfile(): RadioSimulationProfile {
    return this.profile;
  }

  public setProfile(profile: Partial<RadioSimulationProfile>): void {
    this.profile = { ...this.profile, ...profile };
  }

  public async start(): Promise<void> {
    this.channel.register(this);
    this.isRunning = true;
  }

  public async stop(): Promise<void> {
    this.channel.unregister(this);
    this.isRunning = false;
  }

  public async broadcast(packet: MeshPacket): Promise<void> {
    if (!this.isRunning) return;
    await this.channel.transmit(this, packet);
  }

  public async sendTo(packet: MeshPacket, _destinationAddress: string): Promise<void> {
    await this.broadcast(packet);
  }

  public onPacket(handler: PacketHandler): void {
    this.handler = handler;
  }

  public deliverIncoming(packet: MeshPacket, fromAddress: string): void {
    if (this.isRunning && this.handler) {
      // Pass deep clone to prevent test state cross-contamination
      const cloned = JSON.parse(JSON.stringify(packet)) as MeshPacket;
      this.handler(cloned, fromAddress);
    }
  }
}

/**
 * Local UDP transport for real local network / multi-terminal peer testing without internet.
 */
export class UdpMeshTransport implements MeshTransport {
  public readonly name = 'udp-mesh';
  private socket: dgram.Socket | null = null;
  private handler: PacketHandler | null = null;
  private port: number;
  private broadcastPort: number;
  private broadcastAddress: string;

  constructor(options: { port?: number; broadcastPort?: number; broadcastAddress?: string } = {}) {
    this.port = options.port ?? 8443;
    this.broadcastPort = options.broadcastPort ?? 8443;
    this.broadcastAddress = options.broadcastAddress ?? '127.0.0.1';
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      this.socket.on('error', (err) => {
        reject(err);
      });

      this.socket.on('message', (msg, rinfo) => {
        try {
          const parsed = JSON.parse(msg.toString('utf8')) as MeshPacket;
          if (this.handler) {
            this.handler(parsed, `${rinfo.address}:${rinfo.port}`);
          }
        } catch {
          // Discard invalid raw UDP datagrams
        }
      });

      this.socket.bind(this.port, () => {
        try {
          this.socket?.setBroadcast(true);
        } catch {
          // Fallback if OS doesn't support setBroadcast on loopback
        }
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.close(() => {
          this.socket = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public async broadcast(packet: MeshPacket): Promise<void> {
    if (!this.socket) return;
    const buf = Buffer.from(JSON.stringify(packet), 'utf8');
    return new Promise((resolve, reject) => {
      this.socket?.send(buf, 0, buf.length, this.broadcastPort, this.broadcastAddress, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public async sendTo(packet: MeshPacket, destinationAddress: string): Promise<void> {
    if (!this.socket) return;
    const [host, portStr] = destinationAddress.split(':');
    const port = portStr ? parseInt(portStr, 10) : this.broadcastPort;
    const buf = Buffer.from(JSON.stringify(packet), 'utf8');
    return new Promise((resolve, reject) => {
      this.socket?.send(buf, 0, buf.length, port, host ?? '127.0.0.1', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public onPacket(handler: PacketHandler): void {
    this.handler = handler;
  }
}
