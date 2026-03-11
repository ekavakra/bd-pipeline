"""
Transcription Sidecar — Tests
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


def test_health_check():
    """Test the health endpoint returns proper status."""
    # Import after mocking whisper to avoid model loading
    with patch("main.whisper_model", MagicMock()):
        from main import app

        client = TestClient(app)
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "whisper_model" in data
        assert "uptime" in data


def test_transcribe_requires_audio_url():
    """Test that transcribe endpoint validates input."""
    with patch("main.whisper_model", MagicMock()):
        from main import app

        client = TestClient(app)
        response = client.post("/transcribe", json={})

        assert response.status_code == 422  # Validation error


def test_summarize_rejects_empty_text():
    """Test that summarize endpoint rejects empty text."""
    with patch("main.whisper_model", MagicMock()):
        from main import app

        client = TestClient(app)
        response = client.post("/summarize", json={"text": ""})

        assert response.status_code == 400


def test_summarize_rejects_whitespace_only():
    """Test that summarize endpoint rejects whitespace-only text."""
    with patch("main.whisper_model", MagicMock()):
        from main import app

        client = TestClient(app)
        response = client.post("/summarize", json={"text": "   "})

        assert response.status_code == 400
