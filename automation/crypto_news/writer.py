from __future__ import annotations

"""
Article generation using a local Ollama model.
"""

import json
import time
from dataclasses import dataclass
from typing import Tuple

import requests

from automation.crypto_news.config import CONFIG
from automation.crypto_news.utils import infer_sentiment, log
from automation.crypto_news.local_writer import generate_local_article


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
        """
        Generate an article via Ollama.

        Strategy:
        1) Call the HTTP API.
        2) Be very forgiving about the response format:
           - Try JSON first.
           - If JSON fails, treat the whole response as plain text.
        3) If HTTP completely fails, fall back to the subprocess-based writer.
        """
        prompt = PROMPT_TEMPLATE.format(title=source_title, summary=source_summary)
        last_error: Exception | None = None

        for attempt in range(1, max_retries + 1):
            try:
                raw = self._call_ollama(prompt)
                title, content = self._parse_response(raw)
                # Allow shorter articles if the model is concise; just enforce a soft floor.
                if not content or len(content.split()) < max(120, CONFIG.min_words // 2):
                    raise ValueError("Generated content too short")
                sentiment = infer_sentiment(content)
                log("INFO", f"Ollama generated article via HTTP (attempt {attempt})")
                return GeneratedArticle(title=title, content=content, sentiment=sentiment)
            except Exception as exc:
                last_error = exc
                log("ERROR", f"Ollama generation failed (attempt {attempt}): {exc}")
                time.sleep(2 * attempt)

        log("ERROR", f"Ollama HTTP generation failed after {max_retries} attempts: {last_error}")

        # Fallback to subprocess-based local writer using the user's prompt
        try:
            fallback = generate_local_article(source_title, source_summary)
            if not fallback:
                log("ERROR", "Local subprocess-based Ollama generation also failed.")
                return None
            sentiment = fallback.sentiment or infer_sentiment(fallback.content)
            log("INFO", "Ollama generation succeeded via local subprocess fallback.")
            return GeneratedArticle(
                title=fallback.title,
                content=fallback.content,
                sentiment=sentiment,
            )
        except Exception as exc:
            log("ERROR", f"Exception in local subprocess-based writer: {exc}")
            return None

    def _parse_response(self, text: str) -> Tuple[str, str]:
        """
        Parse the model response.

        We prefer JSON, but if JSON decoding fails we fall back to treating the
        entire response as plain text, using the first non-empty line as the
        title and the remainder as the body.
        """
        text = text.strip()

        # First try strict JSON
        try:
            data = json.loads(text)
            title = str(data.get("title", "")).strip()
            content = str(data.get("content", "")).strip()
            if title or content:
                if not title:
                    first_line, _, rest = content.partition("\n")
                    title = first_line.strip() or "Crypto Market Update"
                    content = rest.strip()
                return title, content
        except json.JSONDecodeError:
            # Ignore and fall through to plain-text handling.
            pass

        # Try to salvage a JSON block if present, but do not raise on failure.
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            snippet = text[start : end + 1]
            try:
                data = json.loads(snippet)
                title = str(data.get("title", "")).strip()
                content = str(data.get("content", "")).strip()
                if title or content:
                    if not title:
                        first_line, _, rest = content.partition("\n")
                        title = first_line.strip() or "Crypto Market Update"
                        content = rest.strip()
                    return title, content
            except json.JSONDecodeError:
                # Fall through to plain-text parsing.
                pass

        # Plain-text fallback: treat the whole response as article text.
        first_line, _, rest = text.partition("\n")
        title = first_line.strip() or "Crypto Market Update"
        content = (rest or "").strip()
        if not content:
            # If everything is one line, treat the whole thing as content.
            content = title
        return title, content

