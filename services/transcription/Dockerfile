# ============================================
# BD Pipeline — Transcription Sidecar Dockerfile
# FastAPI + faster-whisper
# ============================================

FROM python:3.11-slim AS base

# System deps for faster-whisper (audio processing)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the whisper model during build to avoid startup delay
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('medium', device='cpu', compute_type='int8')"

COPY . .

EXPOSE 5001

# Run with uvicorn for production-grade async handling
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001", "--workers", "2"]
