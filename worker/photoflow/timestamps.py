"""One timestamp format, everywhere.

The catalog is read by a browser, so every timestamp in it has to be something
`new Date(...)` accepts. The old API wrote .NET's default format —
"2024-12-07 13:46:15.7349337": a space instead of T, seven fractional digits, and
no zone at all. Safari rejects it outright and Python's fromisoformat cannot read
the seven digits either, so it has to be converted rather than passed through.
"""

from datetime import datetime, timezone

# .NET writes DateTime.MinValue when it has no value, rather than null.
DOTNET_MIN_VALUE_PREFIX = "0001-01-01"


def normalize(raw: str | None) -> str | None:
    """Return an ISO-8601 UTC string, or None if there is no usable value."""
    if not raw:
        return None

    text = raw.strip()
    if not text or text.startswith(DOTNET_MIN_VALUE_PREFIX):
        return None

    parsed = _parse(text)
    return to_iso(parsed) if parsed else None


def to_iso(moment: datetime) -> str:
    """Milliseconds and a Z, which is the form every browser agrees on."""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)

    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{moment.microsecond // 1000:03d}Z"


def now_iso() -> str:
    return to_iso(datetime.now(timezone.utc))


def _parse(text: str) -> datetime | None:
    candidate = text.replace(" ", "T")

    # .NET's "ticks" precision is finer than Python parses; keep milliseconds.
    if "." in candidate:
        head, _, tail = candidate.partition(".")
        digits = ""
        for character in tail:
            if character.isdigit():
                digits += character
            else:
                break
        remainder = tail[len(digits):]
        candidate = f"{head}.{digits[:6].ljust(6, '0')}{remainder}"

    try:
        return datetime.fromisoformat(candidate.replace("Z", "+00:00"))
    except ValueError:
        return None
