# CrisisMesh — Resilient Store-and-Forward Mesh for Blackouts & Outages

[Italiano](README.it.md) · [English](README.md) · [Architecture](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md) · [Launch Checklist](docs/LAUNCH.md)

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![CI](https://github.com/MRJonam91/CrisisMesh/actions/workflows/ci.yml/badge.svg)](https://github.com/MRJonam91/CrisisMesh/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22.18-brightgreen)](package.json)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-success)](package.json)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-MRJonam91-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/MRJonam91)

Autonomous, zero-dependency peer-to-peer store-and-forward mesh communication protocol and delay-tolerant engine (DTN) designed for infrastructure collapse, grid blackouts, and network partitions. Featuring Ed25519 asymmetric cryptographic signatures, prioritized emergency outbox, broadcast loop suppression, and sneakernet data-mule bundle interchange.

```
┌─────────────────────────────────┐               ┌─────────────────────────────────┐
│     Disaster Outpost Alpha      │               │      Base Relief Hospital       │
│  (Isolated by network blackout) │ ◄── PARTITION ──► │  (Waiting for triage reports)   │
└────────────────┬────────────────┘  (Link Down)  └────────────────▲────────────────┘
                 │ Signed Envelope                                 │ Verified Triage
                 ▼                                                 │
        ┌──────────────────────────────────────────────────────────┴┐
        │                  Rover Mule Relay (Node B)                │
        │  • Buffers packets in Store-and-Forward Priority Queue   │
        │  • Moves across partitioned terrain                       │
        │  • Opportunistically flushes to Base when in RF range     │
        └───────────────────────────────────────────────────────────┘
```

---

## 🎯 The Problem

When telecommunication infrastructure collapses (earthquakes, severe storms, energy grid blackouts, or civil disruptions), conventional communications fail abruptly:
- **Centralized Dependency**: Cellular towers and ISP fiber lines depend on grid power, centralized DNS, and cloud brokers.
- **Immediate Packet Drop**: Standard IP routing drops packets when no direct end-to-end route exists, losing crucial distress calls.
- **Spoofing and Forgery**: Unauthenticated amateur RF channels are vulnerable to malicious spoofing, panic hoaxes, and message alterations.
- **Broadcast Storms**: Naive multi-hop packet flooding saturates fragile low-bandwidth radio channels with infinite loops.

---

## 🛰️ The Solution: CrisisMesh

CrisisMesh provides a lightweight, resilient delay-tolerant mesh communication network:
- **Deterministic Cryptographic Identity & E2EE**: Every peer generates an Ed25519 signing keypair and an X25519 keypair. The Node ID is a SHA-256 fingerprint (`cm_<pubkey_hash>`). Direct messages support authenticated End-to-End Encryption (AES-256-GCM via X25519 ECDH) ensuring confidentiality across intermediary relays.
- **Cryptographic Packet Envelope**: Every message (broadcast or direct) is sealed with an Ed25519 digital signature covering the canonical JSON header and payload. Any alteration in transit triggers `[CMSH-ERR-7104]` and immediate rejection.
- **Delay-Tolerant Store-and-Forward Queue (DTN)**: When target nodes are out of range or partitioned, messages are buffered in memory or persisted to an atomic crash-resilient journal file (`--journal`). Packets are strictly prioritized (`CRITICAL` > `HIGH` > `NORMAL` > `LOW`).
- **Epidemic Delta Synchronization**: Bandwidth-saving `sync_offer` and `sync_request` handshake transfers *only* missing packets across encounters, protecting narrow LoRa and VHF channels from saturation.
- **Neighbor Discovery & Beacons**: Single-hop heartbeats enable dynamic peer discovery and neighbor link mapping (`peer:discovered`).
- **Broadcast Storm & Loop Mitigation**: Built-in sliding `SeenCache` (LRU deduplication) and strict `maxHops` bounds prevent packet amplification loops across mesh relays.
- **Pluggable Transports**:
  - `VirtualRadioTransport`: In-memory radio simulation with configurable latency, loss rates, and partition switches for reproducible lab trials.
  - `UdpMeshTransport`: Real LAN UDP broadcast transport for instant offline multi-process and multi-device mesh links with zero cloud infrastructure.
  - `SneakernetBundle`: Offline file bundle export/import for physical transfer via USB flash drives or SD cards carried by personnel or drones.
- **Zero Runtime Dependencies**: Written in pure modern TypeScript relying exclusively on Node.js standard modules (`node:crypto`, `node:dgram`, `node:events`).
- **Core Guard**: Lean modular architecture strictly contained within < 1,500 lines of core code.

---

## ⚠️ Safety Boundaries & Notice

> [!CAUTION]
> **CRITICAL SAFETY NOTICE**: CrisisMesh is an experimental research prototype for delay-tolerant communications. It is **NOT** certified as a life-safety emergency channel, a replacement for official 112/911 emergency services, or a regulated search-and-rescue communication system. Always prioritize authorized emergency response radio channels where available.

---

## 🚀 Quick start​‌​​‌‌​‌​‌​‌​​‌​​‌​​‌​‌​​​‌‌‌​​‌​​‌‌​​​‌​​‌​‌‌​‌​‌‌​​​​‌​‌‌‌​​‌‌​‌‌​‌​​​​​‌​‌‌​‌​​‌‌‌​​‌​‌‌​​‌‌​​​‌‌​​‌​​‌‌​​​‌​​​‌‌​‌‌‌​​‌‌​​​‌

Run the verifiable first slice lab trial in seconds:

```bash
# 1. Run the reproducible First Verifiable Slice lab trial
npx crisismesh trial

# 2. Generate a new node cryptographic identity
npx crisismesh identity create --name "field-post-1" --out ./node.json

# 3. Start a local UDP mesh listener daemon
npx crisismesh node start --id ./node.json --port 8443

# 4. Launch the offline emergency Web Portal & REST API
npx crisismesh web --web-port 3000 --port 8443

# 5. Broadcast a signed emergency distress packet
npx crisismesh send -m "Need clean water at Sector 4" --priority critical --port 8443

# 6. Dispatch a structured S.O.S. distress beacon
npx crisismesh sos --category medical --lat 45.07 --lon 7.68 --needs "Blood plasma"
```

---

## 🧪 First Verifiable Slice: Lab Trial

CrisisMesh includes an automated, deterministic trial script (`src/core/labTrial.ts`) simulating a 3-node disaster response deployment:
- **Outpost Alpha**: Isolated at a disaster site, broadcasts 3 messages with different priorities.
- **Rover Mule**: Mobile vehicle with store-and-forward queue moving across a simulated radio partition (140 ms latency, 5% loss).
- **Command Base**: Receives relayed messages, verifies 100% of Ed25519 signatures, preserves triage priority, and intercepts active adversary tampering probes.

Run the trial anytime:
```bash
npm run trial
```

---

## 💻 Programmatic Usage (SDK)

```typescript
import {
  createIdentity,
  CrisisNode,
  UdpMeshTransport,
  VirtualRadioChannel,
  VirtualRadioTransport
} from 'crisismesh';

// 1. Create cryptographic identity
const identity = createIdentity('rescue-unit-1');

// 2. Initialize node
const node = new CrisisNode({ identity });

// 3. Attach UDP mesh transport (LAN broadcast)
node.addTransport(new UdpMeshTransport({ port: 8443 }));

// 4. Handle incoming messages
node.on('message', (msg) => {
  console.log(`[${msg.priority.toUpperCase()}] From ${msg.sender}:`, msg.payload);
  console.log(`Signature authentic: ${msg.signatureVerified}`);
});

// 5. Start and broadcast signed distress alert
await node.start();
await node.broadcast(
  { situation: 'Power failure', fuelRemainingMinutes: 45 },
  { priority: 'critical', ttl: 7200 }
);
```

---

## ☕ Support & Donations

CrisisMesh is 100% open source under the permissive **Apache-2.0** license. If this project advances your resilience research or field mesh initiatives, consider supporting development:

- **GitHub Sponsors:** [sponsor @MRJonam91](https://github.com/sponsors/MRJonam91)
- **Ko-fi:** [ko-fi.com/mrjonam](https://ko-fi.com/mrjonam)
- **Buy Me a Coffee:** [buymeacoffee.com/mrjonam](https://buymeacoffee.com/mrjonam)
- **PayPal:** [paypal.me/manorollo](https://paypal.me/manorollo)

---

## 📄 License & Attribution

- **Source Code**: [Apache-2.0](LICENSE) — Copyright (c) 2026 Manoj Rollo ([@MRJonam91](https://github.com/MRJonam91)). See [NOTICE](NOTICE) and [LICENSING.md](LICENSING.md).
- **Documentation**: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
