# CrisisMesh — Piano di Sviluppo & Roadmap

Documento programmatico sull'evoluzione architetturale, crittografica e radio di CrisisMesh.

---

## 🎯 Obiettivi Raggiunti — Versione 1.0.0 (Stabile)

- [x] **Identità Crittografica Deterministica**: Coppie di chiavi asimmetriche Ed25519 (RFC 8032) con Node ID derivato dall'impronta crittografica SHA-256 (`cm_<pubkey_hash>`).
- [x] **Integrità Busta Mesh & Anti-Manomissione**: Firma digitale Ed25519 dell'envelope canonico e rilevamento deterministico di manomissioni in transito (`[CMSH-ERR-7104]`).
- [x] **Coda Store-and-Forward Tollerante ai Ritardi (DTN)**: Gestione differita prioritizzata (`CRITICAL` > `HIGH` > `NORMAL` > `LOW`) con cache anti-duplicazione scorrevole (`SeenCache`) e soppressione automatica di loop o broadcast storm.
- [x] **Persistenza Atomica su Journal (Crash Resilience)**: Coda con scrittura atomica temporanea su file per garantire la sopravvivenza dei messaggi non recapitati a blackout energetici o spegnimenti forzati.
- [x] **Crittografia End-to-End Autenticata (E2EE)**: Chiavi X25519 dedicate per scambio segreto ECDH e cifratura AEAD AES-256-GCM per proteggere messaggi medici e referti da relay intermedi.
- [x] **Protocollo di Riconciliazione Epidemica (Delta Sync)**: Handshake bidirezionale `sync_offer` e `sync_request` per scambiare unicamente i pacchetti mancanti, salvaguardando canali radio a banda ultra-ridotta.
- [x] **Scoperta Peer & Tabella di Vicinato**: Beacons periodici `heartbeat` a 1 salto per mappare i nodi nel raggio di ricezione e monitorare i vicini attivi.
- [x] **Conferma di Consegna End-to-End (ACK Envelopes)**: Generazione automatica di ricevute firmate sui messaggi diretti recapitati a destinazione.
- [x] **Routing Vettoriale Deterministico**: Tabella di routing dinamica a minima distanza (`RouteEntry`) aggiornata con metriche di salti e prossimi nodi di transito.
- [x] **Trasporto UDP Broadcast su Rete Locale**: Comunicazione locale senza connessione internet né cloud infrastructure tra processi e dispositivi sulla stessa LAN o hotspot.
- [x] **Hardware Adapter LoRa UART/Serial**: Connessione a ricetrasmettitori LoRa fisici (Semtech SX1262 / SX1276, Heltec, LilyGO TTGO T-Beam ESP32) con framing e checksum CRC-16-CCITT.
- [x] **Scambio Fisico Sneakernet (Data Mule)**: Esportazione e importazione di bundle crittografici (`.bundle.json`) per trasporto a mano su memorie USB o schede SD.
- [x] **Portale Web Offline e Dashboard di Emergenza**: Server HTTP nativo (`node:http`) accessibile da browser mobile/laptop con pulsante S.O.S., coordinate GPS e feed in tempo reale.
- [x] **Prova di Laboratorio Verificabile (First Slice)**: Benchmark deterministico riproducibile su 3 nodi con partizione simulata, bufferizzazione mobile e consegna al 100%.
- [x] **Zero Dipendenze Runtime & Core Guard**: Motore modulare strictly < 1.500 LOC con suite di test automatizzati (23/23 test passati al 100%).

---

## 🚀 Prossimi Passi — Versione 1.1 (Q1 2027)

- [ ] **Bridge Bluetooth Low Energy (BLE Mesh)**: Supporto a comunicazioni mesh punto-punto tra smartphone offline tramite advertising BLE.
- [ ] **Compressione Compatta dei Pacchetti (CBOR / Deflate)**: Riduzione dei payload a meno di 128 byte per massimizzare la portata RF su bande ISM 868/433 MHz.
- [ ] **Gateway di Riconnessione Opportunistica (Internet Ingress)**: Sincronizzazione automatica degli allarmi con piattaforme di soccorso quando un nodo mobile rientra in copertura cellulare 4G/5G o satellitare.

---

## 🌐 Visione a Lungo Termine — Versione 2.0 (2027+)

- [ ] **Uplink Satellitare LEO Diretto**: Integrazione trasparente con transceiver satellitari a pacchetto (Iridium Short Burst Data / Direct-to-Cell) per stazioni base remote.
- [ ] **Firme di Soglia Multi-Partecipante (Threshold Ed25519)**: Autorizzazioni congiunte crittografiche tra più soccorritori per disposizioni di massima gravità (es. evacuazioni di massa).
