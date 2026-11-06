# Changelog — CrisisMesh

Tutte le modifiche rilevanti a questo progetto sono documentate in questo file.
Il formato si basa su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/), e rispetta il [Semantic Versioning](https://semver.org/).

## [1.2.0-beta] - 2026-11-06

### Added
- **Portale Web Offline e Dashboard di Emergenza (`src/server/webDashboard.ts`)**: Server HTTP embedded zero-dipendenze (`node:http`) per consentire a soccorritori e cittadini di connettersi da browser mobile/laptop a un hotspot offline:
  - Dashboard interattiva scura ad alto contrasto con feed in tempo reale dei messaggi mesh e stato nodi.
  - Form S.O.S. rapido con cattura coordinate GPS tramite browser Geolocation API.
  - REST API completa: `/health`, `/api/status`, `/api/inbox`, `/api/peers`, `/api/routes`, `/api/send`, `/api/sos`, `/api/bundle/export`, `/api/bundle/import`.
- **Conferma di Consegna Autenticata End-to-End (ACK Envelopes)**: Generazione automatica di buste firmate `ack` sui messaggi diretti recapitati, con evento `message:acked` e tracciamento `node.getAcks()`.
- **Routing Vettoriale Deterministico a Minima Distanza**: Mappatura automatica della tabella di routing (`RouteEntry`) con aggiornamento dinamico del prossimo salto (`nextHopNodeId`) e distanza in salti (`distanceHops`).
- **Hardware Adapter Sub-GHz LoRa UART/Serial (`src/adapters/serialLoRa.ts`)**: Adattatore per ricetrasmettitori hardware LoRa (Semtech SX1262 / SX1276, Heltec, LilyGO TTGO T-Beam ESP32) con framing di pacchetto (preambolo `0xAA 0x55`, lunghezza big-endian e checksum CRC-16-CCITT).
- **Nuovo Comando CLI `crisismesh web`**: Avvio istantaneo del portale web di emergenza e del socket radio UDP su una porta configurabile.
- **Suite di Test Completa**: 23 test automatizzati passati al 100% (ACK delivery, routing vettoriale, CRC-16, framing LoRa, portale HTTP e API REST).

## [1.1.0-alpha] - 2026-11-06

### Added
- **End-to-End Encryption (E2EE)**: Crittografia asimmetrica autenticata per messaggi diretti confidenziali tramite scambio chiavi X25519 ECDH e cifratura AEAD AES-256-GCM (`src/core/encryption.ts`), impedendo l'intercettazione da parte dei relay mesh intermedi.
- **Protocollo di Riconciliazione Epidemica (Delta Sync)**: Handshake bidirezionale `sync_offer` e `sync_request` per scambiare unicamente i pacchetti mancanti, eliminando la ritrasmissione ridondante su canali radio a banda limitata (LoRa, VHF).
- **Tabella di Vicinato e Scoperta Peer**: Beacons periodici `heartbeat` a singolo salto per mappare i nodi attivi nel raggio radio e monitorare l'attività dei vicini (`node.getPeers()`, evento `peer:discovered`).
- **Persistenza Atomica della Coda (Crash Resilience)**: Supporto a file di journaling JSON (`--journal` / `storagePath`) con scritture atomiche temporanee, per garantire la sopravvivenza dei pacchetti bufferizzati a blackout energetici e riavvii forzati.
- **Payload Strutturati per Emergenze e Triage S.O.S.**: Tipizzazione forte per coordinate GPS (latitudine/longitudine), categorie di emergenza (medical, rescue, hazard, structural), fabbisogno di risorse e stima delle vittime.
- **Comando CLI `crisismesh sos`**: Invio rapido di allarmi georeferenziati prioritari da terminale.
- **Suite di Test Estesa**: Aggiunti test completi per crittografia E2EE, discovery di vicinato, tolleranza ai guasti con persistenza su disco e riconciliazione delta sync (18 test totali, 100% verdi).

## [1.0.0] - 2026-11-06

### Added
- **Core Cryptographic Identity**: Identità di nodo basate su chiavi asimmetriche Ed25519 con fingerprint univoco (`node_<pubkey_hash>`) e verifica deterministica delle firme.
- **Envelope di Protocollo Mesh**: Pacchetti con header immutabile, priorità differenziata (`critical`, `high`, `normal`, `low`), TTL, contatore di hop con prevenzione di loop e firma crittografica.
- **Coda Store-and-Forward**: Buffer di persistenza e ritrasmissione differita prioritizzato con de-duplicazione tramite cache LRU e pulizia automatica di pacchetti scaduti.
- **Motore di Routing Tollerante ai Ritardi (DTN)**: Routing epidemico opportunistico tra nodi con tracciamento del cammino (`path`) e scambio differenziale dei messaggi.
- **Trasporti Multipli**:
  - `VirtualRadioTransport`: Canale radio in-memory per lab trial con simulazione di latenza, perdita pacchetti casuale e partizioni di rete.
  - `UdpMeshTransport`: Trasporto broadcast/multicast UDP zero-dipendenze su rete locale/LAN per nodi reali e terminali peer-to-peer.
  - `Sneakernet Bundle`: Esportazione e importazione di bundle firmati su supporto fisico/file per nodi isolati senza alcuna connessione radio diretta.
- **Prova di Laboratorio Verificabile (First Slice)**: Benchmark riproducibile (`crisismesh trial`) tra due nodi locali con relay intermedio, simulazione di blackout totale e misurazione di latenza, consegna e integrità crittografica al 100%.
- **Interfaccia CLI Completa**: Comandi `crisismesh identity`, `crisismesh daemon`, `crisismesh send`, `crisismesh trial`, `crisismesh bundle export/import` e visualizzazione metriche.
- **Struttura Repository MRJonam91**: Licenza Apache-2.0, NOTICE, LICENSING, configurazione donazioni `.github/FUNDING.yml`, CI con guardia architetturale core < 1.500 righe.
