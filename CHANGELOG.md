# Changelog — CrisisMesh

Tutte le modifiche rilevanti a questo progetto sono documentate in questo file.
Il formato si basa su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/), e rispetta il [Semantic Versioning](https://semver.org/).

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
