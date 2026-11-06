# Architettura / Architecture — CrisisMesh

```
                      ┌───────────────────────────────────────┐
                      │    Disaster Outpost / Local Node A    │
                      │   (Ed25519 Keypair, Node ID: cm_a)    │
                      └──────────────────┬────────────────────┘
                                         │ Signed Envelope (Broadcast / Direct)
                                         ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                            CrisisMesh Core Engine                               │
 │                                                                                 │
 │  1. Cryptographic Identity & Envelope Integrity:                                │
 │     ├── Asymmetric Ed25519 Signing (RFC 8032)                                   │
 │     ├── Canonical JSON Envelope Digest (SHA-256)                                │
 │     └── Tamper Rejection Guard ([CMSH-ERR-7104])                                │
 │                                                                                 │
 │  2. Store-and-Forward Delay-Tolerant Queue (DTN):                               │
 │     ├── Strict Priority Scheduling: CRITICAL (100) > HIGH (75) > NORMAL (50)    │
 │     ├── Sliding SeenCache Deduplication (Mitigates Broadcast Storms)           │
 │     ├── Bounded Memory & Dynamic Eviction Policy                                │
 │     └── Automatic TTL Expiration Pruning                                        │
 │                                                                                 │
 │  3. Transport Layer Abstraction:                                                │
 │     ├── VirtualRadioTransport (Simulated RF link: Latency, Loss, Blackout Zone) │
 │     ├── UdpMeshTransport (Real LAN broadcast / P2P loopback sockets)            │
 │     └── SneakernetBundle (Physical offline USB/file courier export & import)    │
 └───────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ Hop Count + 1, Path Trace Appended
                                         ▼
                      ┌───────────────────────────────────────┐
                      │      Rover Relay / Data Mule B        │
                      │  (Buffers packets across partitions)   │
                      └──────────────────┬────────────────────┘
                                         │ Opportunistic Flush
                                         ▼
                      ┌───────────────────────────────────────┐
                      │       Base Hospital / Node C          │
                      │  (Verifies signatures & triage order) │
                      └───────────────────────────────────────┘
```

## 🇮🇹 Concetti Fondamentali

1. **Identità Crittografica Immutabile (`src/core/identity.ts`)**:
   - Ogni nodo genera una coppia di chiavi asimmetriche Ed25519 (RFC 8032).
   - Il `nodeId` è derivato in modo deterministico dall'impronta crittografica SHA-256 della chiave pubblica (`cm_<pubkey_hash>`).
   - Ogni pacchetto trasmesso include la firma digitale dell'intero envelope canonico (ID, sender, recipient, timestamp, TTL, maxHops, priority, payload).
   - Qualsiasi manomissione o alterazione in transito da parte di nodi intermedi o intercettatori comporta l'immediato scarto del pacchetto con allarme di sicurezza.

2. **Coda Store-and-Forward Tollerante ai Ritardi (`src/core/storage.ts`)**:
   - Negli scenari di blackout o calamità naturale, i nodi sono spesso partizionati e fuori dalla portata radio diretta.
   - I messaggi vengono mantenuti in un buffer prioritizzato. Gli allarmi `CRITICAL` (es. S.O.S., crolli strutturali) vengono instradati per primi rispetto a comunicazioni di servizio o telemetria.
   - La cache LRU dei pacchetti già visti (`SeenCache`) elimina i duplicati e protegge la maglia mesh da loop infiniti e broadcast storm.

3. **Trasporti Pluggabili (`src/core/transports.ts`, `src/adapters/serialLoRa.ts`)**:
   - **VirtualRadioTransport**: Canale in-memory ad alta fedeltà con parametri regolabili (latenza ms, tasso di perdita pacchetti casuale, interruttore di partizione di rete) per validazione automatica in CI e prove riproducibili.
   - **UdpMeshTransport**: Trasporto broadcast UDP reale su interfaccia di rete locale (zero dipendenze esterne oltre al runtime standard di Node.js), per consentire a due o più processi o dispositivi sulla stessa LAN/Wi-Fi di parlarsi senza connessione internet.
   - **SerialLoRaTransport**: Adattatore hardware per ricetrasmettitori sub-GHz LoRa (SX1262 / SX1276) via UART con preambolo `0xAA 0x55` e checksum CRC-16-CCITT.
   - **Sneakernet Data Mule**: Esportazione e importazione di bundle crittografici (`.bundle.json`) per il trasporto fisico su memorie USB o schede SD attraverso soccorritori o droni.

4. **Portale Web Offline e Dashboard di Emergenza (`src/server/webDashboard.ts`)**:
   - Server HTTP nativo per consultazione su smartphone o laptop connessi al nodo via Wi-Fi locale offline.
   - REST API per triage, invio S.O.S., consultazione posta in arrivo ed esportazione bundle.

5. **Confini e Limiti di Sicurezza**:
   - **Non è un canale di emergenza certificato**: CrisisMesh è un prototipo per ricerca e sperimentazione tecnologica resiliente; non sostituisce i numeri unici di emergenza (112/911) né i canali radio di protezione civile regolamentati.

---

## 🇬🇧 Architectural Core

1. **Deterministic Cryptographic Identity & E2EE (`src/core/identity.ts`, `src/core/encryption.ts`)**:
   - Every node operates with an Ed25519 signing keypair and an X25519 keypair.
   - The Node ID is an SHA-256 truncated fingerprint (`cm_<pubkey_hash>`).
   - Packets contain canonical SHA-256 digests signed by the originator's private key.
   - Direct messages support authenticated E2EE (X25519 ECDH + AES-256-GCM).
   - Tampered packets are deterministically dropped before hitting local application state.

2. **Delay-Tolerant Store-and-Forward Engine (`src/core/storage.ts`)**:
   - Prioritised outbox (`CRITICAL` > `HIGH` > `NORMAL` > `LOW`).
   - Epidemic gossip with loop-prevention through `path` recording and `maxHops` enforcement.
   - Sliding `SeenCache` preventing packet broadcast storms.
   - Distance-vector shortest path routing table with end-to-end delivery ACK envelopes.
   - Configurable TTL bounds and atomic crash-resilient disk journaling.

3. **Hardware Adapters & Offline Web**:
   - Standard `MeshTransport` interface implementations (`UdpMeshTransport`, `SerialLoRaTransport`, `VirtualRadioTransport`).
   - Built-in accessible emergency web portal and REST API (`createCrisisWebServer`).
