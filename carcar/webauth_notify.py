"""Доставка писем и SMS для веб-авторизации.

Провайдеры намеренно не зашиты: почта уходит через обычный SMTP (подходит
Resend, Postmark, SES, Gmail), SMS — через HTTP-webhook, который принимает
`{"to": "+48...", "text": "..."}`. Такой webhook легко поднять поверх Twilio,
Vonage или локального шлюза, не таща SDK в зависимости.

Если доставка не настроена, сообщение не теряется молча: в dev-режиме оно
пишется в лог целиком (удобно проверять регистрацию), в проде — только
предупреждение без кода и ссылки.
"""

from __future__ import annotations

import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

import httpx

log = logging.getLogger("carcar.webauth")


def _env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


def email_configured() -> bool:
    return bool(_env("CARCAR_SMTP_HOST") and _env("CARCAR_SMTP_FROM"))


def sms_configured() -> bool:
    return bool(_env("CARCAR_SMS_WEBHOOK_URL"))


def send_email(to: str, subject: str, text: str) -> bool:
    """Отправляет письмо. Никогда не бросает: фоновая задача не должна падать."""
    host = _env("CARCAR_SMTP_HOST")
    if not host:
        _log_undelivered("e-mail", to, text)
        return False

    sender = _env("CARCAR_SMTP_FROM") or _env("CARCAR_SMTP_USER")
    message = EmailMessage()
    message["From"] = sender
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)

    port = int(_env("CARCAR_SMTP_PORT", "587") or 587)
    user = _env("CARCAR_SMTP_USER")
    password = _env("CARCAR_SMTP_PASSWORD")
    use_ssl = _env("CARCAR_SMTP_SSL", "0") == "1" or port == 465
    use_tls = _env("CARCAR_SMTP_TLS", "1") != "0"

    try:
        if use_ssl:
            client: smtplib.SMTP = smtplib.SMTP_SSL(
                host, port, timeout=15, context=ssl.create_default_context()
            )
        else:
            client = smtplib.SMTP(host, port, timeout=15)
        with client:
            if not use_ssl and use_tls:
                client.starttls(context=ssl.create_default_context())
            if user and password:
                client.login(user, password)
            client.send_message(message)
    except Exception as exc:  # noqa: BLE001 - доставка не должна ронять запрос
        log.warning("письмо на %s не отправлено: %s", to, exc)
        return False

    log.info("письмо на %s отправлено", to)
    return True


def send_sms(phone: str, text: str) -> bool:
    """Отправляет SMS через настроенный webhook. Возвращает признак доставки."""
    url = _env("CARCAR_SMS_WEBHOOK_URL")
    if not url:
        _log_undelivered("SMS", phone, text)
        return False

    headers = {"Content-Type": "application/json"}
    token = _env("CARCAR_SMS_WEBHOOK_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        response = httpx.post(
            url,
            json={"to": phone, "text": text},
            headers=headers,
            timeout=15,
        )
        response.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        log.warning("SMS на %s не отправлено: %s", phone, exc)
        return False

    log.info("SMS на %s отправлено", phone)
    return True


def _log_undelivered(channel: str, destination: str, body: str) -> None:
    if _env("CARCAR_ALLOW_DEV") == "1":
        log.warning("%s не настроен; сообщение для %s:\n%s", channel, destination, body)
    else:
        log.error("%s не настроен: сообщение для %s не доставлено", channel, destination)


# -- готовые тексты ---------------------------------------------------------


def send_verification_email(to: str, link: str) -> bool:
    return send_email(
        to,
        "Подтвердите почту в CarCar",
        (
            "Здравствуйте!\n\n"
            "Подтвердите адрес почты, чтобы завершить регистрацию в CarCar:\n"
            f"{link}\n\n"
            "Ссылка действует 24 часа. Если вы не регистрировались, просто "
            "проигнорируйте письмо.\n"
        ),
    )


def send_password_reset_email(to: str, link: str) -> bool:
    return send_email(
        to,
        "Сброс пароля в CarCar",
        (
            "Здравствуйте!\n\n"
            "Мы получили запрос на сброс пароля. Новая ссылка действует час:\n"
            f"{link}\n\n"
            "Если запрос делали не вы, ничего не меняйте: пароль останется прежним.\n"
        ),
    )


def send_phone_code(phone: str, code: str) -> bool:
    return send_sms(phone, f"CarCar: код подтверждения {code}. Действует 10 минут.")
