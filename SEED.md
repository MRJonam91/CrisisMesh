# CrisisMesh: decision seed & verifiable trial status

IT — Scopo: La comunicazione durante interruzioni di rete è fragile. Prima prova: Prova da laboratorio tra due nodi locali con messaggi firmati e consegna differita.

EN — Purpose: Communication during network outages is fragile. First trial: Lab trial between two local nodes with signed messages and delayed delivery.

## Stato di Validazione / Validation Status (2026-11-06)

- [x] **Primo slice verificabile completato al 100%**: implementato in `src/core/labTrial.ts` ed eseguibile con `npm run trial` o `crisismesh trial`.
- [x] **Misura di successo osservabile**:
  - 3 nodi locali (Alpha, Rover Mule Relay, Base Hospital).
  - Consegna al 100% dei messaggi prioritari (CRITICAL, HIGH, NORMAL) attraverso partizione radio simulata.
  - Verifica crittografica Ed25519 (100% firme autentiche convalidate).
  - Intercettazione e scarto automatico di pacchetti alterati da avversari in transito (`[CMSH-ERR-7104]`).
  - Coda store-and-forward prioritizzata e bufferizzata su relay mobile.
- [x] **Standard MRJonam91 applicati**:
  - Licenza Apache-2.0, file `NOTICE`, `LICENSING.md`.
  - Canali di supporto e donazione `.github/FUNDING.yml`.
  - Core engine < 1.500 LOC (attualmente 1.335 LOC con guardia CI in `.github/workflows/ci.yml`).
  - Zero dipendenze esterne a runtime (moduli standard Node.js).
- [x] **Confini operativi ed etici rispettati**: avvertenza esplicita documentata in README per escludere l'uso come canale salvavita certificato.
- [x] **Traguardo Versione 1.0.0 raggiunto**: E2EE (X25519 + AES-256-GCM), riconciliazione delta sync, tabelle di routing vettoriali, ACK end-to-end, adapter hardware LoRa (`SerialLoRaTransport`) e portale web di emergenza offline (`webDashboard.ts`).

## Prossimi Passi / Next Decisions
- Test di interoperabilità con bridge Bluetooth Low Energy (BLE) per smartphone Android/iOS offline (Roadmap v1.1).
- Integrazione gateway di rete cellulare/satellitare per inoltro opportunistico su cloud.
