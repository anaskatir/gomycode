# Karna — Assistant Vocal en Darija pour Épiceries

Karna est une solution d'intelligence artificielle vocale conçue pour simplifier et digitaliser la gestion du carnet de crédit (*Karna*) chez les épiciers au Maroc. Elle permet d'enregistrer des ventes à crédit et des règlements par simple dictée vocale en Darija.

---

## 📐 Architecture du Pipeline Vocal

```mermaid
graph TD
    A[🎙️ Entrée Vocale Darija .m4a] --> B[⚡ Engine ASR / Whisper]
    B --> C[📄 Transcription Brute]
    C --> D[🧠 NLU / Extraction d'Entités]
    D --> E[📊 Données Structurées JSON]
    E --> F[💾 Base de Données & UI Tableau de Bord]

    subgraph Benchmark Pipeline
        E <-->|Évaluation BLEU / WER| G[🎯 expected.json]
    end