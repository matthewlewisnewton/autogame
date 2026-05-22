"""Tests for QwenVisionAgent._write_settings — the JSON config that points
qwen at Ollama and enables the playwright MCP. Ported from
lib.sh::write_qwen_vision_settings (lib.sh:828-882)."""
from __future__ import annotations

import json
from pathlib import Path

from harness.agents.qwen import QwenVisionAgent, QwenVisionAgentConfig


def test_settings_file_schema(tmp_path: Path):
    """The generated JSON has the keys qwen + the playwright MCP need."""
    agent = QwenVisionAgent(QwenVisionAgentConfig(
        vision_model="qwen3.6:27b-q8_0",
        vision_base_url="http://localhost:11434/v1",
        vision_api_key="ollama-test",
    ))
    settings = tmp_path / "settings.json"
    mcp_out = tmp_path / "mcp-out"
    agent._write_settings(settings, mcp_out)

    config = json.loads(settings.read_text())
    # Env carries the API key under the name the model provider references.
    assert config["env"]["OLLAMA_API_KEY"] == "ollama-test"
    # Model block names the right model + image modality.
    assert config["model"]["name"] == "qwen3.6:27b-q8_0"
    assert config["model"]["generationConfig"]["modalities"]["image"] is True
    # Model provider uses the configured base URL.
    provider = config["modelProviders"]["openai"][0]
    assert provider["baseUrl"] == "http://localhost:11434/v1"
    assert provider["envKey"] == "OLLAMA_API_KEY"
    # MCP playwright entry points at the mcp-out dir with the vision cap.
    pw = config["mcpServers"]["playwright"]
    assert pw["command"] == "npx"
    assert "--caps" in pw["args"] and "vision" in pw["args"]
    assert str(mcp_out) in pw["args"]
    assert "playwright" in config["mcp"]["allowed"]
    # Schema version pin.
    assert config["$version"] == 4


def test_mcp_output_dir_created(tmp_path: Path):
    agent = QwenVisionAgent()
    settings = tmp_path / "settings.json"
    mcp_out = tmp_path / "mcp-out"
    assert not mcp_out.exists()
    agent._write_settings(settings, mcp_out)
    assert mcp_out.is_dir()


def test_settings_parent_created(tmp_path: Path):
    agent = QwenVisionAgent()
    settings = tmp_path / "deep" / "dir" / "settings.json"
    mcp_out = tmp_path / "mcp"
    agent._write_settings(settings, mcp_out)
    assert settings.exists()
