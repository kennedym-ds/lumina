"""Application configuration — populated from CLI args or defaults."""

from dataclasses import dataclass, field
from pathlib import Path
import secrets


@dataclass
class Settings:
    port: int = 8089
    token: str = ""
    debug: bool = False
    plugin_dir: str = "plugins"
    model_signing_key_path: Path = field(default_factory=lambda: Path(__file__).resolve().parent / ".model-signing-key")


def get_model_signing_secret() -> bytes:
    """Get or create the per-installation model-signing secret."""

    key_path = settings.model_signing_key_path
    key_path.parent.mkdir(parents=True, exist_ok=True)

    if key_path.exists():
        return key_path.read_bytes()

    key = secrets.token_bytes(32)
    key_path.write_bytes(key)
    return key


settings = Settings()