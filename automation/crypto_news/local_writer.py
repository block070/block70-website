from __future__ import annotations

"""
Local Ollama writer using the user's high-quality prompt and subprocess API.

This module is used as a more robust fallback when the HTTP-based writer
struggles to parse JSON responses.
"""

import json
import re
import subprocess
from dataclasses import dataclass
from typing import List

from automation.crypto_news.config import CONFIG
from automation.crypto_news.utils import clean_text if False else None  # type: ignore


@dataclass
class LocalGeneratedArticle:
    title: str
    content: str
    tags: List[str]
    sentiment: str


def _clean_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _call_ollama_subprocess(prompt: str) -> str:
    model = CONFIG.ollama_model or "llama3"
    result = subprocess.run(
        ["ollama", "run", model],
        input=prompt.encode("utf-8"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=180,
    )
    output = result.stdout.decode("utf-8", errors="ignore").strip()
    return output


def _extract_json(text: str) -> dict:
    try:
        match = re.search(r"{.*}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception:
        pass
    return {}


def _build_prompt(title: str, summary: str) -> str:
    """
    High-quality prompt with explicit JSON-only output contract.
    """
    return f"""
You are a professional crypto journalist writing for a website called Block70.

Your job is to transform the provided news into a completely original, high-quality article.

CRITICAL RULES:

* DO NOT copy phrases from the source
* DO NOT summarize — REWRITE with a new angle
* Write like a confident crypto analyst
* Keep it engaging, slightly opinionated, but factual
* Avoid fluff and generic AI language

STYLE:

* Clear, sharp, modern
* Slightly bold tone (not neutral newswire)
* Write like someone who understands markets

OUTPUT MUST BE VALID JSON ONLY:
{{
  "title": "...",
  "content": "...",
  "tags": ["...", "..."],
  "sentiment": "bullish | bearish | neutral"
}}

CONTENT STRUCTURE:

1. Hook (strong opening sentence)
2. What happened (reframed)
3. Why it matters (market impact)
4. Optional insight or forward-looking angle

ARTICLE LENGTH:
300–600 words

INPUT DATA:
Title: {_clean_text(title)}
Summary: {_clean_text(summary)}
""".strip()


def generate_local_article(title: str, summary: str) -> LocalGeneratedArticle | None:
    prompt = _build_prompt(title, summary)
    raw = _call_ollama_subprocess(prompt)
    data = _extract_json(raw)

    if not data:
        return None

    art_title = str(data.get("title", "")).strip()
    content = str(data.get("content", "")).strip()
    tags = data.get("tags") or []
    sentiment = str(data.get("sentiment", "") or "neutral").strip()

    if not art_title or not content:
        return None

    if not isinstance(tags, list):
        tags = [str(tags)]

    return LocalGeneratedArticle(
        title=art_title,
        content=content,
        tags=[str(t) for t in tags],
        sentiment=sentiment,
    )

