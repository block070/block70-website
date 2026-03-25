from __future__ import annotations

import logging
import os
import smtplib
from email.mime.text import MIMEText

import requests

logger = logging.getLogger(__name__)


def send_smtp_email(*, to_addr: str, subject: str, body: str) -> tuple[bool, str]:
    host = os.getenv("SMTP_HOST", "").strip()
    if not host:
        logger.info("SMTP_HOST not set; skip email to %s: %s", to_addr, subject)
        return False, "smtp_not_configured"
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "").strip()
    password = os.getenv("SMTP_PASSWORD", "").strip()
    from_addr = os.getenv("SMTP_FROM", user or "alerts@block70.local")
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr
    try:
        with smtplib.SMTP(host, port, timeout=20) as smtp:
            smtp.starttls()
            if user and password:
                smtp.login(user, password)
            smtp.sendmail(from_addr, [to_addr], msg.as_string())
        return True, ""
    except Exception as e:
        logger.exception("smtp send failed: %s", e)
        return False, str(e)


def send_telegram_text(*, bot_token: str, chat_id: str, text: str) -> tuple[bool, str]:
    if not chat_id or not bot_token:
        return False, "missing_telegram_config"
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    try:
        r = requests.post(
            url,
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
            timeout=15,
        )
        data = r.json()
        if not r.ok:
            return False, str(data.get("description", r.text))
        return True, ""
    except Exception as e:
        logger.exception("telegram send failed: %s", e)
        return False, str(e)
