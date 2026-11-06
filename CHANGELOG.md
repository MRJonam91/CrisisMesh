# Changelog — CrisisMesh

Tutte le modifiche rilevanti a questo progetto sono documentate in questo file.
Il formato si basa su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/), e rispetta il [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-06

### Added
- **Core Cryptographic Identity & E2EE**:
  - Identità asimmetriche Ed25519 (RFC 8032) con Node ID derivato dall'impronta crittografica SHA-256 (`cm_<pubkey_hash>`).
  - Crittografia end-to-end autenticata (E2EE) con scambio chiavi X25519 ECDH e cifratura AEAD AES-256-GCM (`src/core/encryption.ts`) per messaggi diretti confidenziali.
  - Firma crittografica e digest canonico SHA-256 con rigetto deterministico di manomissioni in transito (`[CMSH-ERR-7104]`).
- **Coda Store-and-Forward Tollerante ai Ritardi (DTN)**:
  - Buffer prioritizzato per scenari di blackout e interruzioni infrastrutturali (`CRITICAL` > `HIGH` > `NORMAL` > `LOW`).
  - Cache scorrevole `SeenCache` (LRU) per mitigare loop e tempeste di broadcast su maglie radio.
  - Persistenza atomica su file di journaling per sopravvivere a crash improvvisi e riavvii energetici.
- **Protocollo di Riconciliazione Epidemica (Delta Sync)**:
  - Handshake leggero `sync_offer` e `sync_request` per trasferire solo pacchetti mancanti su canali radio lenti.
- **Tabella di Vicinato & Routing Vettoriale**:
  - Beacons periodici `heartbeat` a 1 salto per scoperta dinamica dei peer vicini (`node.getPeers()`).
  - Tabella di routing dinamica a minima distanza (`RouteEntry`) con apprendimento metriche dei salti.
  - Conferma automatica di ricezione end-to-end con envelope firmati `ack`.
- **Trasporti Pluggabili & Hardware**:
  - `UdpMeshTransport`: Rete broadcast/multicast locale a zero dipendenze per comunicazioni offline su LAN/Wi-Fi.
  - `SerialLoRaTransport`: Adattatore per ricetrasmettitori LoRa hardware (SX1262 / SX1276) su interfaccia seriale UART con framing e checksum CRC-16-CCITT.
  - `VirtualRadioTransport`: Canale in-memory con simulazione fedele di latenza e partizioni per test automatici.
  - `SneakernetBundle`: Esportazione e importazione di bundle fisici crittografici per data mule su chiavette USB o microSD.
- **Portale Web Offline e Dashboard di Emergenza (`src/server/webDashboard.ts`)**:
  - Server HTTP autonomo (`node:http`) per consultazione da smartphone o PC connessi all'hotspot offline del nodo.
  - Interfaccia dark-mode reattiva, invio S.O.S. georeferenziato con API HTML5 Geolocation e REST API completa.
- **Interfaccia CLI Completa (`crisismesh`)**:
  - Comandi `trial`, `identity create`, `node start`, `web`, `send`, `sos`, `bundle export`, `bundle import`, `sponsor`.
- **Prima Prova Verificabile (Lab Trial)**:
  - Benchmark riproducibile su 3 nodi con partizione simulata, bufferizzazione mobile e consegna al 100%.
- **Governance & Standard Open Source**:
  - Licenza Apache-2.0, file NOTICE, LICENSING.md bilingue, canali di supporto `.github/FUNDING.yml`, CI GitHub Actions con guardia architetturale core < 1.500 LOC e suite di 23 test automatizzati passati al 100%.
