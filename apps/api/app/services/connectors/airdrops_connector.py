from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import List, Optional

import feedparser
import requests
from bs4 import BeautifulSoup


@dataclass(frozen=True)
class ExternalAirdrop:
    """
    Normalized external airdrop record.

    This is a thin abstraction over heterogeneous sources (Airdrops.io,
    DappRadar, ICO Drops, etc.) so the airdrop pipeline can treat them
    uniformly.
    """

    project_name: str
    chain: Optional[str]
    description: str
    reward_estimate: Optional[float]
    difficulty: Optional[str]
    status: str  # active | upcoming | expired
    source: str
    source_url: str
    timestamp: datetime


class AirdropsConnector:
    """
    Aggregates airdrop metadata from multiple public sources.

    Design constraints:
    - Only use free, publicly accessible pages (no paid APIs).
    - Prefer RSS where available; fall back to lightweight HTML parsing.
    - Keep parsing resilient: if a source layout changes, fail-soft and
      continue with remaining sources.
    """

    def __init__(self, session: Optional[requests.Session] = None) -> None:
        self._session = session or requests.Session()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def fetch_all(self, *, limit: int = 50) -> List[ExternalAirdrop]:
        items: List[ExternalAirdrop] = []
        items.extend(self._fetch_airdropalert_rss(limit=limit))
        items.extend(self._fetch_airdrops_io(limit=limit))
        items.extend(self._fetch_dappradar(limit=limit))
        items.extend(self._fetch_ico_drops(limit=limit))
        # Best-effort de-duplication by (project_name, source_url)
        seen: set[tuple[str, str]] = set()
        unique: List[ExternalAirdrop] = []
        for item in items:
            key = (item.project_name.strip().lower(), item.source_url.strip().lower())
            if key in seen:
                continue
            seen.add(key)
            unique.append(item)
        return unique[:limit]

    # ------------------------------------------------------------------
    # AirdropAlert (RSS)
    # ------------------------------------------------------------------
    def _fetch_airdropalert_rss(self, *, limit: int) -> List[ExternalAirdrop]:
        """
        Public RSS feed from AirdropAlert. Parsed with feedparser; HTML
        stripped from summaries. Fails soft on network or parse errors.
        """
        url = "https://airdropalert.com/feed/rssfeed"
        try:
            resp = self._session.get(url, timeout=10)
            resp.raise_for_status()
        except Exception:
            return []

        parsed = feedparser.parse(resp.text)
        out: List[ExternalAirdrop] = []
        now = datetime.now(timezone.utc)

        for entry in getattr(parsed, "entries", [])[: limit * 2]:
            title = (getattr(entry, "title", "") or "").strip()
            link = (getattr(entry, "link", "") or "").strip()
            if not title or not link:
                continue

            raw_summary = (
                getattr(entry, "summary", "")
                or getattr(entry, "description", "")
                or ""
            )
            try:
                desc = BeautifulSoup(raw_summary, "html.parser").get_text(" ", strip=True)
            except Exception:
                desc = str(raw_summary).strip()

            ts = now
            published = getattr(entry, "published", None) or getattr(entry, "updated", None)
            if published:
                try:
                    ts = parsedate_to_datetime(str(published)).astimezone(timezone.utc)
                except Exception:
                    ts = now

            out.append(
                ExternalAirdrop(
                    project_name=title[:500],
                    chain=None,
                    description=(desc or "Airdrop listing from AirdropAlert RSS.")[:2000],
                    reward_estimate=None,
                    difficulty=None,
                    status="active",
                    source="AirdropAlert",
                    source_url=link,
                    timestamp=ts,
                )
            )
            if len(out) >= limit:
                break

        return out

    # ------------------------------------------------------------------
    # Airdrops.io
    # ------------------------------------------------------------------
    def _fetch_airdrops_io(self, *, limit: int) -> List[ExternalAirdrop]:
        """
        Scrape latest / upcoming airdrops from Airdrops.io.

        There is no documented RSS feed, so we fall back to HTML parsing of
        the main listing page. Parsing is intentionally shallow: we collect
        project name, short blurb, link, and status when available.
        """
        url = "https://airdrops.io/"
        try:
            resp = self._session.get(url, timeout=10)
            resp.raise_for_status()
        except Exception:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        cards = soup.select(".airdrops .a-card, .airdrops .airdrops-card, article")
        out: List[ExternalAirdrop] = []
        now = datetime.now(timezone.utc)

        for card in cards[: limit * 2]:
            title_el = card.select_one("h3, h2, .title, .a-title")
            link_el = card.select_one("a[href]")
            desc_el = card.select_one("p, .excerpt, .description")

            if not title_el or not link_el:
                continue

            name = title_el.get_text(strip=True)
            href = link_el.get("href") or ""
            if href.startswith("/"):
                source_url = f"https://airdrops.io{href}"
            else:
                source_url = href

            desc = (desc_el.get_text(" ", strip=True) if desc_el else "").strip()

            badge = card.select_one(".status, .badge, .a-badge")
            status_text = (badge.get_text(strip=True).lower() if badge else "")
            if "upcoming" in status_text:
                status = "upcoming"
            elif "ended" in status_text or "expired" in status_text:
                status = "expired"
            else:
                status = "active"

            out.append(
                ExternalAirdrop(
                    project_name=name,
                    chain=None,
                    description=desc or "Airdrop listed on Airdrops.io.",
                    reward_estimate=None,
                    difficulty=None,
                    status=status,
                    source="Airdrops.io",
                    source_url=source_url,
                    timestamp=now,
                )
            )
            if len(out) >= limit:
                break

        return out

    # ------------------------------------------------------------------
    # DappRadar
    # ------------------------------------------------------------------
    def _fetch_dappradar(self, *, limit: int) -> List[ExternalAirdrop]:
        """
        Scrape DappRadar's airdrops listing page.

        The exact URL and layout may evolve; this implementation uses
        best-effort selectors and fails softly when the structure changes.
        """
        url = "https://dappradar.com/airdrops"
        try:
            resp = self._session.get(url, timeout=10)
            resp.raise_for_status()
        except Exception:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        cards = soup.select("a[href*='/airdrops/'], article")
        out: List[ExternalAirdrop] = []
        now = datetime.now(timezone.utc)

        for card in cards[: limit * 2]:
            title_el = card.select_one("h3, h2, .title, .sc-f")
            if not title_el:
                continue
            name = title_el.get_text(strip=True)
            href = card.get("href") or ""
            if href.startswith("/"):
                source_url = f"https://dappradar.com{href}"
            else:
                source_url = href

            desc_el = card.select_one("p, .description, .subtitle")
            desc = (desc_el.get_text(" ", strip=True) if desc_el else "").strip()

            chain_el = card.select_one("[data-chain], .chain, .network")
            chain = chain_el.get_text(strip=True).lower() if chain_el else None

            badge = card.select_one(".badge, .status")
            status_text = (badge.get_text(strip=True).lower() if badge else "")
            if "upcoming" in status_text:
                status = "upcoming"
            elif "ended" in status_text or "expired" in status_text or "closed" in status_text:
                status = "expired"
            else:
                status = "active"

            out.append(
                ExternalAirdrop(
                    project_name=name,
                    chain=chain,
                    description=desc or "Airdrop listed on DappRadar.",
                    reward_estimate=None,
                    difficulty=None,
                    status=status,
                    source="DappRadar",
                    source_url=source_url,
                    timestamp=now,
                )
            )
            if len(out) >= limit:
                break

        return out

    # ------------------------------------------------------------------
    # ICO Drops
    # ------------------------------------------------------------------
    def _fetch_ico_drops(self, *, limit: int) -> List[ExternalAirdrop]:
        """
        Scrape ICO Drops for active / upcoming token sale style campaigns that
        resemble airdrops or incentive programs.
        """
        url = "https://icodrops.com/category/upcoming-ico/"
        try:
            resp = self._session.get(url, timeout=10)
            resp.raise_for_status()
        except Exception:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        cards = soup.select(".ico-card, .ico-row, .col-md-12, article")
        out: List[ExternalAirdrop] = []
        now = datetime.now(timezone.utc)

        for card in cards[: limit * 2]:
            title_el = card.select_one("h3, h2, .ico-name, .title")
            link_el = card.select_one("a[href]")
            if not title_el or not link_el:
                continue
            name = title_el.get_text(strip=True)
            href = link_el.get("href") or ""
            if href.startswith("/"):
                source_url = f"https://icodrops.com{href}"
            else:
                source_url = href

            desc_el = card.select_one(".ico-description, p, .description")
            desc = (desc_el.get_text(" ", strip=True) if desc_el else "").strip()

            status_el = card.select_one(".ico-status, .status")
            status_text = (status_el.get_text(strip=True).lower() if status_el else "")
            if "upcoming" in status_text:
                status = "upcoming"
            elif "ended" in status_text or "finished" in status_text:
                status = "expired"
            else:
                status = "active"

            out.append(
                ExternalAirdrop(
                    project_name=name,
                    chain=None,
                    description=desc or "Campaign listed on ICO Drops.",
                    reward_estimate=None,
                    difficulty=None,
                    status=status,
                    source="ICO Drops",
                    source_url=source_url,
                    timestamp=now,
                )
            )
            if len(out) >= limit:
                break

        return out

