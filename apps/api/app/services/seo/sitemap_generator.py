from __future__ import annotations

"""
Sitemap generator for Block70.

This module builds an XML sitemap covering:
- Coin detail pages
- Narrative pages
- News article URLs

It is designed to be called from a lightweight FastAPI endpoint, e.g.:

  @app.get("/sitemap.xml", response_class=PlainTextResponse)
  def sitemap(db: Session = Depends(get_db)):
      return generate_sitemap(db, base_url="https://block70.xyz")
"""

from datetime import datetime
from typing import Iterable

from sqlalchemy.orm import Session

from app.models import Coin, Narrative, NewsArticle, AlphaPost, TradingStrategy


def _url_element(loc: str, lastmod: datetime | None = None, changefreq: str | None = None) -> str:
  parts = [f"  <url>\n    <loc>{loc}</loc>"]
  if lastmod:
    parts.append(f"    <lastmod>{lastmod.isoformat()}</lastmod>")
  if changefreq:
    parts.append(f"    <changefreq>{changefreq}</changefreq>")
  parts.append("  </url>")
  return "\n".join(parts)


def generate_sitemap(db: Session, base_url: str) -> str:
  """
  Generate an XML sitemap string for Block70.

  The base_url should be the public origin, e.g. "https://block70.xyz".
  """
  base_url = base_url.rstrip("/")

  urls: list[str] = []

  # Coin pages: /coins/{slug}
  for coin in db.query(Coin).all():
    loc = f"{base_url}/coins/{coin.slug}"
    lastmod = coin.updated_at if hasattr(coin, "updated_at") else None
    urls.append(_url_element(loc, lastmod=lastmod, changefreq="hourly"))

  # Narrative pages: /narratives/{slugified-name}
  for narrative in db.query(Narrative).all():
    slug = _slugify(narrative.name)
    loc = f"{base_url}/narratives/{slug}"
    urls.append(_url_element(loc, lastmod=narrative.created_at, changefreq="daily"))

  # News article URLs: use canonical URLs directly.
  for article in db.query(NewsArticle).all():
    loc = article.url
    lastmod = article.published_at or article.created_at
    urls.append(_url_element(loc, lastmod=lastmod, changefreq="daily"))

  # Alpha post SEO pages: /alpha/posts/{id}
  for post in db.query(AlphaPost).all():
    loc = f"{base_url}/alpha/posts/{post.id}"
    lastmod = post.updated_at if hasattr(post, "updated_at") else post.created_at
    urls.append(_url_element(loc, lastmod=lastmod, changefreq="daily"))

  # Public strategy pages: /strategies/{id}
  for strategy in db.query(TradingStrategy).filter(TradingStrategy.is_public == True).all():
    loc = f"{base_url}/strategies/{strategy.id}"
    lastmod = strategy.updated_at if hasattr(strategy, "updated_at") else strategy.created_at
    urls.append(_url_element(loc, lastmod=lastmod, changefreq="daily"))

  body = "\n".join(urls)
  xml = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    f"{body}\n"
    "</urlset>\n"
  )
  return xml


def _slugify(name: str) -> str:
  """
  Very small slug helper for narrative names, e.g. "Real World Assets" -> "real-world-assets".
  """
  import re

  slug = name.strip().lower()
  slug = re.sub(r"[^a-z0-9]+", "-", slug)
  slug = re.sub(r"-{2,}", "-", slug).strip("-")
  return slug or "narrative"

