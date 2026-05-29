"""Pull raw data: international results CSV + bookmaker odds."""
from __future__ import annotations
import json
import os
import urllib.request
from pathlib import Path

RAW = Path("data/raw")
RESULTS_URL = "https://raw.githubusercontent.com/martj42/international_results/master/results.csv"
ODDS_BASE = "https://api.the-odds-api.com/v4/sports"


def _load_env() -> None:
    p = Path(".env")
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def fetch_results(force: bool = False) -> Path:
    RAW.mkdir(parents=True, exist_ok=True)
    out = RAW / "results.csv"
    if out.exists() and not force:
        return out
    req = urllib.request.Request(RESULTS_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as r:
        out.write_bytes(r.read())
    return out


def _get_json(url: str) -> object:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def fetch_odds(force: bool = False) -> dict:
    _load_env()
    key = os.environ.get("THE_ODDS_API_KEY")
    if not key:
        raise RuntimeError("THE_ODDS_API_KEY missing from .env")
    RAW.mkdir(parents=True, exist_ok=True)
    out = RAW / "odds.json"
    if out.exists() and not force:
        return json.loads(out.read_text())

    h2h = _get_json(
        f"{ODDS_BASE}/soccer_fifa_world_cup/odds/"
        f"?apiKey={key}&regions=eu,uk&markets=h2h&oddsFormat=decimal"
    )
    outrights = _get_json(
        f"{ODDS_BASE}/soccer_fifa_world_cup_winner/odds/"
        f"?apiKey={key}&regions=eu,uk&markets=outrights&oddsFormat=decimal"
    )
    bundle = {"h2h": h2h, "outrights": outrights}
    out.write_text(json.dumps(bundle, indent=2))
    return bundle


if __name__ == "__main__":
    p = fetch_results()
    print("results:", p, p.stat().st_size, "bytes")
    o = fetch_odds()
    print("odds h2h events:", len(o["h2h"]))
    print("outright bookmakers:", len(o["outrights"][0]["bookmakers"]) if o["outrights"] else 0)
