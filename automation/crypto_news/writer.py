from __future__ import annotations

"""
Article generation using a local Ollama model.
"""

import json
import time
from dataclasses import dataclass
from typing import Tuple

import requests

from .config import CONFIG
from .utils import infer_sentiment, log


@dataclass
class GeneratedArticle:
    title: str
    content: str
    sentiment: str


PROMPT_TEMPLATE = """
You are an expert crypto analyst writing for Block70, a serious crypto intelligence terminal.

Write a completely original, SEO-friendly article based on the source news below.

Requirements:
- DO NOT copy sentences or phrasing from the source.
- Use a confident, analytical, crypto-native tone.
- 300–600 words.
- Structure:
  1) Short hook introduction
  2) Bullet or short-paragraph key points
  3) Market impact analysis
  4) Optional opinionated angle about why it matters for serious market participants
- Include a new, engaging headline that is NOT a rewording of the original.

Return JSON with keys: "title", "content".

Source title: "{title}"
Source summary: "{summary}"
""".strip()


class OllamaWriter:
    def __init__(self, base_url: str | None = None, model: str | None = None):
        self.base_url = base_url or CONFIG.ollama_base_url
        self.model = model or CONFIG.ollama_model

    def _call_ollama(self, prompt: str) -> str:
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }
        resp = requests.post(url, json=payload, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "")

    def generate_article(
        self, source_title: str, source_summary: str, max_retries: int = 3
    ) -> GeneratedArticle | None:
        prompt = PROMPT_TEMPLATE.format(title=source_title, summary=source_summary)
        last_error: Exception | None = None

        for attempt in range(1, max_retries + 1):
            try:
                raw = self._call_ollama(prompt)
                title, content = self._parse_response(raw)
                if not content or len(content.split()) < CONFIG.min_words:
                    raise ValueError("Generated content too short")
                sentiment = infer_sentiment(content)
                log("INFO", f"Ollama generated article (attempt {attempt})")
                return GeneratedArticle(title=title, content=content, sentiment=sentiment)
            except Exception as exc:
                last_error = exc
                log("ERROR", f"Ollama generation failed (attempt {attempt}): {exc}")
                time.sleep(2 * attempt)

        log("ERROR", f"Ollama generation ultimately failed after {max_retries} attempts: {last_error}")
        return None

    def _parse_response(self, text: str) -> Tuple[str, str]:
        """
        Try to parse a JSON object from the model response.
        If the whole response is not valid JSON, attempt to extract a JSON block.
        """
        text = text.strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # crude extraction of first {...} block
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                snippet = text[start : end + 1]
                data = json.loads(snippet)
            else:
                raise

        title = str(data.get("title", "")).strip()
        content = str(data.get("content", "")).strip()
        if not title:
            # fall back: take first line as title
            first_line, _, rest = content.partition("\n")
            title = first_line.strip() or "Crypto Market Update"
            content = rest.strip()

        return title, content

