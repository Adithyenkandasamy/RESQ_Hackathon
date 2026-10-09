# Emergency AI Module

FastAPI microservice for ambulance and hospital emergency management — image recognition (Gemini), audio transcription/TTS (ElevenLabs), and LLM-generated summaries (Grok/xAI).

---

## Project structure

```
emergency_ai/
├── main.py                  # App entry-point, router registration, /health
├── .env                     # Real secrets — NOT committed
├── .env.example             # Template — committed
├── .gitignore
├── requirements.txt
├── README.md
└── routers/
    ├── __init__.py
    ├── image.py             # POST /image/analyze  — Gemini vision
    ├── audio.py             # POST /audio/transcribe | /audio/speak — ElevenLabs
    └── llm.py               # POST /llm/summary  — Grok/xAI
```

---

## Quick start

```bash
# 1. Clone / enter the project folder
cd emergency_ai

# 2. Create and activate a virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure secrets
cp .env.example .env
# Edit .env and fill in your real API keys

# 5. Run the dev server
uvicorn main:app --reload --port 8000
```

Swagger UI → http://127.0.0.1:8000/docs

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| POST | `/image/analyze` | Upload patient image → Gemini vision description |
| POST | `/audio/transcribe` | Upload audio recording → ElevenLabs transcript |
| POST | `/audio/speak` | Submit precaution text → ElevenLabs TTS audio |
| POST | `/llm/summary` | Submit all findings → Grok hospital summary + helper precautions |

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google AI Studio / Gemini API key |
| `GEMINI_MODEL` | Gemini model ID (default `gemini-2.5-flash-lite`) |
| `ELEVENLABS_API_KEY` | ElevenLabs API key |
| `ELEVENLABS_STT_MODEL` | Speech-to-text model (default `scribe_v2`) |
| `ELEVENLABS_TTS_MODEL` | Text-to-speech model (default `eleven_flash_v2_5`) |
| `ELEVENLABS_VOICE_ID` | TTS voice ID (fixed `5klqvwuBHYwcS99jLmDR`) |
| `XAI_API_KEY` | xAI / Grok API key |
| `XAI_MODEL` | Grok model ID |
| `MAX_IMAGE_SIZE_MB` | Max image upload size in MB (default `10`) |
| `MAX_AUDIO_SIZE_MB` | Max audio upload size in MB (default `20`) |

---

## Typical workflow

1. Ambulance helper uploads patient image + audio recording.
2. **In parallel**: Gemini analyzes the image; ElevenLabs transcribes the audio.
3. Both results (+ patient info / vitals) are sent to the `/llm/summary` endpoint.
4. Grok returns:
   - `hospital_summary` — for the hospital dashboard.
   - `helper_precautions` — plain-language first-aid text.
5. `helper_precautions` text is passed to `/audio/speak`, which returns MP3 audio.
6. The ambulance app plays the audio to the helper.

---

## Safety & compliance notes

- API keys are loaded exclusively from `.env` and never logged or returned in responses.
- Image analysis describes only **visible findings** — no diagnoses, no severity classification.
- Precautions are selected from a clinician-approved guidance library; Grok does **not** invent medical instructions.
- All responses carry `requires_clinical_review: true` where applicable.
- Review your cloud providers' data-processing agreements before using real patient data.
- This module does **not** implement Kafka, database persistence, or main-backend integration.
