# Checklist di Lancio / Launch Checklist — CrisisMesh v1.0.0

Guida per il rilascio in produzione e la pubblicazione di CrisisMesh.

## Checklist di Rilascio

- [x] Licenza Apache-2.0 verificata e file `NOTICE` presente
- [x] File `LICENSING.md` bilingue con matrice di attribuzione e diritti
- [x] Canali di donazione attivi in `.github/FUNDING.yml` e nei `README`
- [x] Pipeline di Continuous Integration (GitHub Actions) configurata per Node.js 22 e 24
- [x] Guardia architetturale core verificata (< 1.500 LOC, attualmente 965 LOC)
- [x] Suite di test automatizzati completa (12/12 test passati al 100%)
- [x] Documentazione bilingue completa (Italiano / English)
- [x] Prova di laboratorio verificabile riproducibile (`crisismesh trial` / `npm run trial`)
- [x] Avvertenza etica e confini operativi evidenziati nei README
- [x] Portale web offline di emergenza e REST API verificati
- [x] Adapter hardware LoRa con CRC-16 verificato
- [x] Transizione della repository a **Public** su GitHub

## Canali di Promozione e Lancio

1. **Hacker News (Show HN)**:
   - Titolo: *Show HN: CrisisMesh – Resilient store-and-forward peer mesh for blackouts with signed packets*
   - Contenuto: Prototipo delay-tolerant in TypeScript zero-dipendenze per comunicazione peer-to-peer durante disastri e blackout di rete, con firme Ed25519 e lab trial riproducibile.

2. **Reddit (r/networking, r/meshnet, r/amateurradio, r/selfhosted)**:
   - Presentazione dell'architettura store-and-forward e simulazione radio deterministica.

3. **Community Open Source & Disaster Resilience**:
   - Condivisione con collettivi di civic tech, radioamatori e progetti di resilienza territoriale.
