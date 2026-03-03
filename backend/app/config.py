"""Application configuration — populated from CLI args or defaults."""

from dataclasses import dataclass


@dataclass
class Settings:
    port: int = 8089
    token: str = ""
    debug: bool = True


settings = Settings()