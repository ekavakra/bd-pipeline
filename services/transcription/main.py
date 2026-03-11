"""
FastAPI Transcription Sidecar

Audio transcription using faster-whisper and AI summarization via Ollama.
This service runs as a separate container and communicates with the main API
via HTTP.
"""

import os
import time
import tempfile
import logging
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# ── Configuration ─────────────────────────────

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

logging.basicConfig(level=LOG_LEVEL, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Global model reference (loaded at startup)
whisper_model = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the Whisper model once at startup."""
    global whisper_model
    logger.info(f"Loading faster-whisper model: {WHISPER_MODEL_SIZE}")
    from faster_whisper import WhisperModel

    whisper_model = WhisperModel(
        WHISPER_MODEL_SIZE,
        device="cpu",
        compute_type="int8",
    )
    logger.info("Whisper model loaded successfully")
    yield
    logger.info("Shutting down transcription service")


app = FastAPI(
    title="BD Pipeline Transcription Service",
    version="1.0.0",
    lifespan=lifespan,
)


# ── Request / Response Models ─────────────────


class TranscribeRequest(BaseModel):
    """Request body for transcription."""

    audio_url: str


class TranscribeResponse(BaseModel):
    """Response body for transcription."""

    text: str
    segments: list[dict]
    language: str
    duration: float


class SummarizeRequest(BaseModel):
    """Request body for AI summarization."""

    text: str


class SummarizeResponse(BaseModel):
    """Response body for AI summarization."""

    summary: str
    key_insights: list[str]


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    whisper_model: str
    uptime: float


# ── Track startup time ────────────────────────

_start_time = time.time()


# ── Endpoints ─────────────────────────────────


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Liveness/readiness check."""
    return HealthResponse(
        status="ok" if whisper_model is not None else "loading",
        whisper_model=WHISPER_MODEL_SIZE,
        uptime=time.time() - _start_time,
    )


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(request: TranscribeRequest):
    """
    Transcribe an audio file from a URL.

    Downloads the audio file, runs faster-whisper, and returns the transcript
    with segment-level timestamps.
    """
    if whisper_model is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    logger.info(f"Transcribing audio from: {request.audio_url}")

    try:
        # Download the audio file
        async with httpx.AsyncClient(timeout=300) as client:
            response = await client.get(request.audio_url)
            response.raise_for_status()

        # Write to temp file for whisper processing
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        # Run transcription
        segments_iter, info = whisper_model.transcribe(
            tmp_path,
            beam_size=5,
            word_timestamps=True,
        )

        segments = []
        full_text_parts = []
        total_duration = 0.0

        for segment in segments_iter:
            segments.append(
                {
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2),
                    "text": segment.text.strip(),
                }
            )
            full_text_parts.append(segment.text.strip())
            total_duration = max(total_duration, segment.end)

        full_text = " ".join(full_text_parts)

        # Clean up temp file
        os.unlink(tmp_path)

        logger.info(
            f"Transcription complete: {len(segments)} segments, "
            f"{total_duration:.1f}s, language={info.language}"
        )

        return TranscribeResponse(
            text=full_text,
            segments=segments,
            language=info.language,
            duration=total_duration,
        )

    except httpx.HTTPError as e:
        logger.error(f"Failed to download audio: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to download audio: {str(e)}")
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@app.post("/summarize", response_model=SummarizeResponse)
async def summarize_transcript(request: SummarizeRequest):
    """
    Generate an AI summary and key insights from a transcript using Ollama.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    logger.info(f"Summarizing transcript ({len(request.text)} chars)")

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            # Call Ollama for summarization
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": (
                        "You are an expert business analyst. Analyze this discovery call transcript "
                        "and provide:\n"
                        "1. A concise summary (2-3 paragraphs)\n"
                        "2. Key insights as a JSON array of strings\n\n"
                        f"Transcript:\n{request.text[:8000]}\n\n"
                        "Respond in this exact JSON format:\n"
                        '{"summary": "...", "key_insights": ["insight1", "insight2", ...]}'
                    ),
                    "stream": False,
                    "options": {"temperature": 0.3},
                },
            )
            response.raise_for_status()

        data = response.json()
        ai_response = data.get("response", "")

        # Parse the JSON response from Ollama
        import json

        try:
            parsed = json.loads(ai_response)
            summary = parsed.get("summary", ai_response)
            key_insights = parsed.get("key_insights", [])
        except json.JSONDecodeError:
            # If AI doesn't return valid JSON, use raw text
            summary = ai_response
            key_insights = []

        logger.info(f"Summary generated: {len(key_insights)} insights")

        return SummarizeResponse(summary=summary, key_insights=key_insights)

    except httpx.HTTPError as e:
        logger.error(f"Ollama request failed: {e}")
        raise HTTPException(status_code=502, detail=f"AI service unavailable: {str(e)}")
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")
