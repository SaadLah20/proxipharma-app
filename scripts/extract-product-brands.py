#!/usr/bin/env python3
"""
Extraction intelligente des marques (brand) pour le catalogue Beautymall / Supabase.

Sources analysées :
  - noms produits (préfixes récurrents, marques composées)
  - slugs Beautymall (colonne subcategory ou url_produit CSV)
  - descriptions HTML (full_description / description)

Prérequis :
  pip install -r scripts/requirements-product-brands.txt

Variables (.env.local à la racine du projet) :
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  DATABASE_URL ou SUPABASE_DB_URL (optionnel, pour ALTER TABLE automatique)

Usage :
  python scripts/extract-product-brands.py --dry-run
  python scripts/extract-product-brands.py --source csv --csv scripts/products_final.csv
  python scripts/extract-product-brands.py --yes
  python scripts/extract-product-brands.py --report scripts/brand-extraction-report.json

Étapes :
  1. Charge tous les produits
  2. Construit un dictionnaire de marques (fréquence + validation slug)
  3. Affiche les 200 marques les plus fréquentes + exemples
  4. Demande confirmation (sauf --yes / --dry-run)
  5. Crée brand / brand_confidence si besoin, puis met à jour Supabase
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore

try:
    from supabase import Client, create_client
except ImportError:
    Client = None  # type: ignore
    create_client = None  # type: ignore

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DEFAULT_CSV = SCRIPT_DIR / "products_final.csv"
DEFAULT_REPORT = SCRIPT_DIR / "brand-extraction-report.json"
DEFAULT_AUDIT_CSV = SCRIPT_DIR / "brand-unidentified-audit.csv"
DEFAULT_AUDIT_SUMMARY = SCRIPT_DIR / "brand-unidentified-patterns.json"

# ---------------------------------------------------------------------------
# Constantes métier
# ---------------------------------------------------------------------------

MIN_BRAND_FREQUENCY = 8
MIN_SLUG_BRAND_FREQUENCY = 3
MIN_COMPOUND_BRAND_FREQUENCY = 5
HIGH_FREQUENCY_THRESHOLD = 20
MAX_BRAND_WORDS = 5
MAX_AUTO_BRAND_WORDS = 4
MAX_SLUG_TOKENS = 6
BRAND_CHAIN_RETENTION = 0.65
PREVIEW_BRAND_COUNT = 200
EXAMPLES_PER_BRAND = 2
UPDATE_BATCH_SIZE = 200

GENERIC_PREFIX_KEYS = frozenset(
    {
        "la",
        "le",
        "les",
        "de",
        "du",
        "des",
        "et",
        "en",
        "pour",
        "avec",
        "sans",
        "the",
        "a",
        "un",
        "une",
        "dr",
        "pro",
        "new",
        "eau",
        "l",
        "d",
        "mg",
        "mgd",
        "bebe",
        "baby",
        "vita",
        "natural",
        "nature",
        "bio",
        "plus",
        "super",
        "ultra",
        "mini",
        "maxi",
        "set",
        "lot",
        "pack",
        "offre",
        "coffret",
    }
)

# Racines composées : seul « Dr » est rejeté, mais « Dr Brown » / « MGD Nature » sont OK.
COMPOUND_BRAND_STARTERS = frozenset(
    {
        "dr",
        "mgd",
        "pro",
        "bio",
        "d",
        "j",
        "th",
        "cc",
        "h",
        "m",
        "my",
        "ht",
        "zo",
        "bc",
        "so",
        "rr",
        "ht",
    }
)

PACK_OFFER_PATTERN = re.compile(
    r"\b("
    r"pack|lot|coffret|offre|offert|promo|duo|bundle|"
    r"achete|achetes|achetés|gratuit|\+|\=|x\s*\d+|"
    r"\d+\s*\+\s*\d+"
    r")\b|"
    r"-pack(?:-|$)|offert(?:-|$)",
    re.I,
)

PRODUCT_TYPE_WORDS = frozenset(
    {
        "creme",
        "crème",
        "gel",
        "lait",
        "huile",
        "spray",
        "baume",
        "fluide",
        "serum",
        "sérum",
        "masque",
        "shampoing",
        "dentifrice",
        "bain",
        "savon",
        "soin",
        "soins",
        "protection",
        "mousse",
        "poudre",
        "stick",
        "rouge",
        "fond",
        "teint",
        "anti",
        "peau",
        "visage",
        "corps",
        "cheveux",
        "spf",
        "ml",
        "g",
        "pcs",
        "pieces",
        "pièces",
        "contour",
        "nettoyant",
        "hydratant",
        "nourrissant",
        "reparateur",
        "réparateur",
        "douche",
        "deodorant",
        "déodorant",
        "coffret",
        "brosse",
        "biberon",
        "serviettes",
        "coton",
        "tiges",
        "lingettes",
        "patch",
        "patches",
        "capsules",
        "comprime",
        "comprimé",
        "gélules",
        "gelules",
        "solution",
        "émulsion",
        "emulsion",
        "lotion",
        "tonique",
        "mascara",
        "eyeliner",
        "lipstick",
        "gloss",
        "vernis",
        "dissolvant",
        "démaquillant",
        "demaquillant",
        "repulsif",
        "répulsif",
    }
)

SLUG_STOP_TOKENS = frozenset(
    PRODUCT_TYPE_WORDS
    | {
        "offre",
        "lot",
        "pack",
        "set",
        "promo",
        "gratuit",
        "offert",
        "achetes",
        "achete",
        "1",
        "2",
        "3",
    }
)

PACK_SLUG_STOP = frozenset(
    SLUG_STOP_TOKENS
    | {"pack", "duo", "promo", "trousse", "offert", "offerte", "gratuit", "bad", "achetes", "achete"}
)

# Marques composées / orthographe canonique (clé = normalize_key)
KNOWN_BRAND_DISPLAY: dict[str, str] = {
    "la roche posay": "La Roche-Posay",
    "eau thermale avene": "Eau Thermale Avène",
    "eau thermale": "Eau Thermale Avène",
    "avene": "Avène",
    "etat pur": "Etat Pur",
    "institut esthederm": "Institut Esthederm",
    "esthederm": "Institut Esthederm",
    "roger gallet": "Roger & Gallet",
    "oral b": "Oral-B",
    "pierre fabre oral care": "Pierre Fabre Oral Care",
    "laboratoires acm": "Laboratoires ACM",
    "acm": "ACM",
    "a derma": "A-Derma",
    "uriage": "Uriage",
    "bioderma": "Bioderma",
    "svr": "SVR",
    "vichy": "Vichy",
    "caudalie": "Caudalie",
    "nuxe": "Nuxe",
    "isdin": "ISDIN",
    "ducray": "Ducray",
    "roge cavailles": "Rogé Cavailles",
    "maybelline": "Maybelline",
    "garnier": "Garnier",
    "l oreal": "L'Oréal",
    "l oreal paris": "L'Oréal Paris",
    "cerave": "CeraVe",
    "some by mi": "Some By Mi",
    "3 chenes": "3Chênes",
    "3chenes": "3Chênes",
    "mason natural": "Mason Natural",
    "racine vita": "Racine Vita",
    "naturo pathica": "Naturo Pathica",
    "absolute new york": "Absolute New York",
    "isispharma": "IsisPharma",
    "ziaja": "Ziaja",
    "hismile": "HiSmile",
    "mgd nature": "MGD Nature",
    "dr brown": "Dr Brown's",
    "dr browns": "Dr Brown's",
    "dr scholl": "Dr Scholl's",
    "palmer s": "Palmer's",
    "palmer": "Palmer's",
    "douaa cosmetics": "Douaa Cosmetics",
    "douaa": "Douaa Cosmetics",
    "biomagic": "Biomagic",
    "wella": "Wella",
    "j beverly hills": "J Beverly Hills",
    "bio oil": "Bio-Oil",
    "th vitalia": "TH Vitalia",
    "cc pharma": "CC Pharma",
    "niya skin": "Niya Skin",
    "olaskin": "Olaskin",
    "oleoban": "Oleoban",
    "mamajoo": "Mamajoo",
    "zyoderm": "Zyoderm",
    "gelix": "Gelix",
    "valary": "Valary",
    "novacapil": "Novacapil",
    "novophane": "Novophane",
    "otezia": "Otézia",
    "eluday": "Eluday",
    "elgydium": "Elgydium",
    "h s": "H&S",
    "hs": "H&S",
    "m d": "M&D",
    "md": "M&D",
    "d biotic": "D-Biotic",
    "d cap": "D-Cap",
    "pro vital": "Pro Vital",
    "sante bio": "Santé Bio",
    "urban care": "Urban Care",
    "naturesoin": "NaturEsoin",
    "nature soin": "NaturEsoin",
    "dietaroma": "Dietaroma",
    "ultra compact": "Ultra Compact",
    # v2.1 — audit juin 2026 (slug / seuil fréquence / marque embarquée)
    "elancyl": "Elancyl",
    "panticell": "P'anticell",
    "p anticell": "P'anticell",
    "mgd": "MGD Nature",
    "biomin": "BioMin",
    "vitae": "Vitae",
    "pharco": "Pharco",
    "sylaplaie": "Sylaplaie",
    "soins sur mesure": "Soins Sur Mesure",
    "i love my hair": "I Love My Hair",
    "dr althea": "Dr. Althea",
    "dr shuller": "Dr. Shuller",
    "dr shoes": "Dr Shoes",
    "jumiso": "Jumiso",
    "pilea": "Pilea",
    "egosan": "Egosan",
    "delia": "Delia",
    "cosmetix": "Cosmetix",
    "ss laboratory": "SS Laboratory",
    "contour": "Contour",
    "df": "DF",
    "cotton plus": "Cotton Plus",
    "remescar": "Remescar",
    "sinomarin": "Sinomarin",
    "dyson": "Dyson",
    "joone": "Joone",
    "biokarite": "Biokarite",
    "elcea": "Elcea",
    "kanellia": "Kanellia",
    "chlorhexil": "Chlorhexil",
    "lero": "Lero",
    "malia s": "Malia's",
    "ahlam": "Ahlam",
    "magics": "Magics",
    "h and t": "H&T",
}

BRAND_DDL_SQL = """
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand_confidence INTEGER;
"""


# ---------------------------------------------------------------------------
# Utilitaires texte
# ---------------------------------------------------------------------------


def decode_product_text(text: str) -> str:
    """Décode entités HTML WooCommerce / Beautymall (L&rsquo;Oréal, &#038;, etc.)."""
    if not text:
        return ""
    s = unescape(text)
    s = s.replace("\u2019", "'").replace("\u2018", "'").replace("`", "'")
    return s.strip()


def normalize_key(text: str) -> str:
    """Minuscules, sans accents, espaces normalisés."""
    if not text:
        return ""
    s = decode_product_text(text).lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"(\w)'(\w)", r"\1 \2", s)
    s = re.sub(r"\s*&\s*", " and ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def slug_key(text: str) -> str:
    """Forme slug Beautymall."""
    key = normalize_key(text)
    return key.replace(" ", "-")


def strip_html(html: str) -> str:
    if not html:
        return ""
    text = unescape(html)
    text = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", text)
    text = re.sub(r"(?is)<br\s*/?>", "\n", text)
    text = re.sub(r"(?is)<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def slug_from_url(url: str) -> str:
    m = re.search(r"/product/([^/?#]+)", url or "", flags=re.I)
    return m.group(1).strip("/") if m else ""


def configure_system_ssl() -> None:
    """
    Certificats SSL Windows/macOS (équivalent de `node --use-system-ca` dans ce projet).
    """
    try:
        import truststore

        truststore.inject_into_ssl()
        return
    except ImportError:
        pass
    try:
        import certifi

        bundle = certifi.where()
        os.environ.setdefault("SSL_CERT_FILE", bundle)
        os.environ.setdefault("REQUESTS_CA_BUNDLE", bundle)
    except ImportError:
        pass


def create_supabase_client(url: str, key: str) -> Client:
    configure_system_ssl()
    if httpx is not None:
        try:
            from supabase.lib.client_options import SyncClientOptions

            http = httpx.Client(timeout=120.0)
            options = SyncClientOptions(httpx_client=http)
            return create_client(url, key, options)
        except Exception:
            pass
    return create_client(url, key)


def load_env_local() -> None:
    env_path = PROJECT_ROOT / ".env.local"
    if load_dotenv is not None and env_path.is_file():
        load_dotenv(env_path, override=False)
        return
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line.strip())
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        if (val.startswith('"') and val.endswith('"')) or (
            val.startswith("'") and val.endswith("'")
        ):
            val = val[1:-1]
        os.environ.setdefault(key, val)


def parse_csv_records(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError(f"CSV sans en-tête : {path}")
        rows: list[dict[str, str]] = []
        for raw in reader:
            rows.append({k: (v if v is not None else "") for k, v in raw.items()})
    return rows


# ---------------------------------------------------------------------------
# Modèles
# ---------------------------------------------------------------------------


@dataclass
class ProductRow:
    id: str
    name: str
    description: str = ""
    slug: str = ""
    url_produit: str = ""

    @property
    def plain_description(self) -> str:
        return strip_html(self.description)


@dataclass
class BrandCandidate:
    key: str
    display: str
    frequency: int
    slug_hits: int = 0
    name_hits: int = 0
    sources: set[str] = field(default_factory=set)


@dataclass
class BrandAssignment:
    brand: str | None
    confidence: int
    method: str


# ---------------------------------------------------------------------------
# Chargement produits
# ---------------------------------------------------------------------------


def normalize_product_row(raw: dict[str, Any]) -> ProductRow | None:
    name = decode_product_text(raw.get("name") or "")
    if not name:
        return None
    pid = str(raw.get("id") or raw.get("woo_id") or "").strip()
    desc = (
        raw.get("full_description")
        or raw.get("description")
        or raw.get("short_description")
        or ""
    )
    slug = (raw.get("subcategory") or raw.get("slug") or "").strip()
    url = (raw.get("url_produit") or "").strip()
    if not slug and url:
        slug = slug_from_url(url)
    return ProductRow(
        id=pid or name,
        name=name,
        description=str(desc or ""),
        slug=slug,
        url_produit=url,
    )


def load_products_from_csv(path: Path) -> list[ProductRow]:
    records = parse_csv_records(path)
    products: list[ProductRow] = []
    for i, rec in enumerate(records):
        rec = dict(rec)
        if not rec.get("id"):
            rec["id"] = f"csv-{i + 1}"
        row = normalize_product_row(rec)
        if row:
            products.append(row)
    return products


def fetch_products_from_supabase(client: Client) -> list[ProductRow]:
    products: list[ProductRow] = []
    offset = 0
    page_size = 1000
    while True:
        resp = (
            client.table("products")
            .select("id,name,full_description,subcategory,photo_url")
            .order("name")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = resp.data or []
        for raw in batch:
            row = normalize_product_row(raw)
            if row:
                products.append(row)
        if len(batch) < page_size:
            break
        offset += page_size
    return products


# ---------------------------------------------------------------------------
# Construction dictionnaire marques
# ---------------------------------------------------------------------------


def name_prefix_counts(products: list[ProductRow]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for product in products:
        tokens = product.name.split()
        for n in range(1, min(MAX_BRAND_WORDS, len(tokens)) + 1):
            chunk = tokens[:n]
            last_parts = normalize_key(chunk[-1]).split()
            if not last_parts:
                break
            last_norm = last_parts[-1]
            if last_norm in PRODUCT_TYPE_WORDS:
                break
            key = normalize_key(" ".join(chunk))
            if not key or re.fullmatch(r"\d+", key):
                continue
            counts[key] += 1
    return counts


def slug_prefix_counts(products: list[ProductRow]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for product in products:
        if not product.slug:
            continue
        parts = [p for p in product.slug.split("-") if p]
        for n in range(1, min(MAX_SLUG_TOKENS, len(parts)) + 1):
            token = parts[n - 1]
            if token in SLUG_STOP_TOKENS or re.fullmatch(r"\d+", token):
                continue
            pref = "-".join(parts[:n])
            counts[pref] += 1
    return counts


def is_generic_short_brand(key: str) -> bool:
    words = key.split()
    if len(words) == 1 and words[0] in GENERIC_PREFIX_KEYS:
        return True
    if len(words) == 1 and len(words[0]) <= 2:
        return True
    if len(words) >= 2 and words[0] in COMPOUND_BRAND_STARTERS:
        return False
    return False


def slug_brand_prefix_parts(slug: str) -> list[str]:
    """Tokens slug utiles pour détecter la marque (ignore chiffres / stopwords en tête)."""
    parts = [p for p in (slug or "").split("-") if p]
    while parts and (
        parts[0] in PACK_SLUG_STOP
        or re.fullmatch(r"\d+", parts[0])
        or parts[0] in SLUG_STOP_TOKENS
    ):
        parts.pop(0)
    return parts


def slug_leading_ngram_counts(products: list[ProductRow]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for product in products:
        parts = slug_brand_prefix_parts(product.slug)
        if not parts:
            continue
        for n in range(1, min(3, len(parts)) + 1):
            chunk = parts[:n]
            if chunk[-1] in PACK_SLUG_STOP:
                break
            key = normalize_key(" ".join(chunk))
            if not key or is_generic_short_brand(key):
                continue
            counts[key] += 1
    return counts


def slug_first_token_counts(products: list[ProductRow]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for product in products:
        parts = slug_brand_prefix_parts(product.slug)
        if not parts:
            continue
        key = normalize_key(parts[0])
        if key and not is_generic_short_brand(key):
            counts[key] += 1
    return counts


def is_pack_or_offer(name: str, slug: str) -> bool:
    text = decode_product_text(name)
    if PACK_OFFER_PATTERN.search(text):
        return True
    slug_l = (slug or "").lower()
    return any(
        token in slug_l.split("-")
        for token in ("pack", "offert", "offerte", "promo", "duo", "lot", "coffret")
    )


def extend_brand_terminal(root_key: str, counts: dict[str, int]) -> str:
    """
    Prolonge une marque composée tant que le mot suivant reste majoritaire
    (ex. La → La Roche → La Roche-Posay), sans absorber les gammes produit
    (ex. Maybelline → Maybelline Super Stay).
    """
    if root_key in KNOWN_BRAND_DISPLAY:
        max_words = len(normalize_key(KNOWN_BRAND_DISPLAY[root_key]).split())
    else:
        max_words = MAX_AUTO_BRAND_WORDS

    current = root_key
    current_freq = counts.get(current, 0)
    while len(current.split()) < max_words:
        extensions = [
            k
            for k in counts
            if k.startswith(current + " ") and len(k.split()) == len(current.split()) + 1
        ]
        if not extensions:
            break
        best_ext = max(extensions, key=lambda k: counts[k])
        if current_freq <= 0 or counts[best_ext] / current_freq < BRAND_CHAIN_RETENTION:
            break
        current = best_ext
        current_freq = counts[best_ext]
    return current


def extract_brand_terminals(
    name_counts: Counter[str],
    slug_first_counts: Counter[str],
    slug_ngram_counts: Counter[str],
) -> dict[str, int]:
    """Construit des marques « terminales » (pas des gammes / lignes produit)."""
    counts: dict[str, int] = dict(name_counts)
    for counter in (slug_first_counts, slug_ngram_counts):
        for key, freq in counter.items():
            if freq >= MIN_SLUG_BRAND_FREQUENCY:
                counts[key] = max(counts.get(key, 0), freq)

    roots: set[str] = set()
    for key, freq in counts.items():
        if freq >= MIN_BRAND_FREQUENCY and len(key.split()) == 1 and not is_generic_short_brand(key):
            roots.add(key)
    for key, freq in counts.items():
        words = key.split()
        if (
            len(words) >= 2
            and words[0] in COMPOUND_BRAND_STARTERS
            and freq >= MIN_COMPOUND_BRAND_FREQUENCY
        ):
            roots.add(words[0])
    for counter in (slug_first_counts, slug_ngram_counts):
        for key, freq in counter.items():
            if freq >= MIN_SLUG_BRAND_FREQUENCY and not is_generic_short_brand(key):
                roots.add(key.split()[0] if " " in key else key)
    for key in KNOWN_BRAND_DISPLAY:
        roots.add(key)

    terminals: dict[str, int] = {}
    for root in sorted(roots, key=lambda k: (-counts.get(k, 0), k)):
        terminal = extend_brand_terminal(root, counts)
        if is_generic_short_brand(terminal):
            continue
        freq = counts.get(terminal, counts.get(root, 0))
        if freq < MIN_SLUG_BRAND_FREQUENCY and terminal not in KNOWN_BRAND_DISPLAY:
            continue
        terminals[terminal] = max(terminals.get(terminal, 0), freq)

    # Retirer les terminaux absorbés par une marque composée plus longue.
    keys = sorted(terminals.keys(), key=lambda k: (-len(k.split()), -terminals[k]))
    kept: dict[str, int] = {}
    for key in keys:
        if any(longer != key and longer.startswith(key + " ") for longer in kept):
            continue
        drop = [shorter for shorter in kept if key.startswith(shorter + " ")]
        for shorter in drop:
            del kept[shorter]
        kept[key] = terminals[key]
    return kept


def merge_slug_name_candidates(
    name_counts: Counter[str],
    slug_counts: Counter[str],
    slug_first_counts: Counter[str],
    slug_ngram_counts: Counter[str],
) -> dict[str, BrandCandidate]:
    terminals = extract_brand_terminals(name_counts, slug_first_counts, slug_ngram_counts)
    brands: dict[str, BrandCandidate] = {}

    for key, freq in terminals.items():
        brands[key] = BrandCandidate(
            key=key,
            display=KNOWN_BRAND_DISPLAY.get(key, ""),
            frequency=freq,
            sources={"frequency"},
        )

    for key, display in KNOWN_BRAND_DISPLAY.items():
        if key not in brands:
            brands[key] = BrandCandidate(
                key=key,
                display=display,
                frequency=MIN_SLUG_BRAND_FREQUENCY,
                sources={"seed"},
            )

    return brands


def extract_display_from_name(name: str, brand_key: str) -> str:
    if brand_key in KNOWN_BRAND_DISPLAY:
        return KNOWN_BRAND_DISPLAY[brand_key]

    name_tokens = name.split()
    key_tokens = brand_key.split()
    if len(name_tokens) < len(key_tokens):
        return " ".join(t.capitalize() for t in key_tokens)

    chunk = name_tokens[: len(key_tokens)]
    display = " ".join(chunk).strip()
    if display:
        return display
    return " ".join(t.capitalize() for t in key_tokens)


def enrich_brand_displays(
    brands: dict[str, BrandCandidate],
    products: list[ProductRow],
) -> None:
    display_votes: dict[str, Counter[str]] = defaultdict(Counter)
    by_first_token: dict[str, list[str]] = defaultdict(list)
    slug_prefixes: list[tuple[str, str]] = []

    for key in brands:
        by_first_token[key.split()[0]].append(key)
        slug_prefixes.append((slug_key(key), key))

    for token_keys in by_first_token.values():
        token_keys.sort(key=lambda k: (-len(k.split()), -brands[k].frequency))

    slug_prefixes.sort(key=lambda item: (-len(item[0].split("-")), item[1]))

    for product in products:
        name_key_prefix = normalize_key(product.name)
        if name_key_prefix:
            first = name_key_prefix.split()[0]
            for key in by_first_token.get(first, ()):
                if name_key_prefix == key or name_key_prefix.startswith(key + " "):
                    display_votes[key][extract_display_from_name(product.name, key)] += 1
                    brands[key].name_hits += 1
                    break

        if product.slug:
            for sk, key in slug_prefixes:
                if product.slug == sk or product.slug.startswith(sk + "-"):
                    brands[key].slug_hits += 1
                    brands[key].sources.add("slug")
                    break

    for key, cand in brands.items():
        if key in KNOWN_BRAND_DISPLAY:
            cand.display = KNOWN_BRAND_DISPLAY[key]
            continue
        votes = display_votes.get(key)
        if votes:
            cand.display = votes.most_common(1)[0][0]
        elif not cand.display:
            cand.display = " ".join(w.capitalize() for w in key.split())


def build_brand_dictionary(products: list[ProductRow]) -> dict[str, BrandCandidate]:
    name_counts = name_prefix_counts(products)
    slug_counts = slug_prefix_counts(products)
    slug_first_counts = slug_first_token_counts(products)
    slug_ngram_counts = slug_leading_ngram_counts(products)
    brands = merge_slug_name_candidates(
        name_counts, slug_counts, slug_first_counts, slug_ngram_counts
    )
    enrich_brand_displays(brands, products)
    return brands


def sorted_brands(brands: dict[str, BrandCandidate]) -> list[BrandCandidate]:
    return sorted(
        brands.values(),
        key=lambda b: (-len(b.key.split()), -b.frequency, -b.name_hits, b.display.lower()),
    )


# ---------------------------------------------------------------------------
# Attribution marque + confiance
# ---------------------------------------------------------------------------


@dataclass
class BrandMatcher:
    """Index pré-calculé pour éviter des millions d'appels normalize_key / regex."""

    ordered: list[BrandCandidate]
    brand_by_key: dict[str, BrandCandidate]
    brand_keys_sorted: list[str]
    brand_slug_sk: dict[str, str]
    by_first_token: dict[str, list[BrandCandidate]]
    slug_prefixes: list[tuple[str, BrandCandidate]]


def build_brand_matcher(brands: dict[str, BrandCandidate]) -> BrandMatcher:
    ordered = sorted_brands(brands)
    brand_by_key = {b.key: b for b in ordered}
    by_first_token: dict[str, list[BrandCandidate]] = defaultdict(list)
    brand_slug_sk: dict[str, str] = {}
    slug_prefixes: list[tuple[str, BrandCandidate]] = []

    for cand in ordered:
        by_first_token[cand.key.split()[0]].append(cand)
        sk = slug_key(cand.key)
        brand_slug_sk[cand.key] = sk
        slug_prefixes.append((sk, cand))

    slug_prefixes.sort(key=lambda item: (-len(item[0]), -item[1].frequency))

    return BrandMatcher(
        ordered=ordered,
        brand_by_key=brand_by_key,
        brand_keys_sorted=[b.key for b in ordered],
        brand_slug_sk=brand_slug_sk,
        by_first_token=dict(by_first_token),
        slug_prefixes=slug_prefixes,
    )


def name_key_starts_with_brand(name_key: str, brand_key: str) -> bool:
    return name_key == brand_key or name_key.startswith(brand_key + " ")


def slug_matches_brand(slug: str, brand_slug_sk: str) -> bool:
    if not slug:
        return False
    return slug == brand_slug_sk or slug.startswith(brand_slug_sk + "-")


def find_brand_embedded_in_name_key(
    name_key: str,
    brands: list[BrandCandidate],
) -> BrandCandidate | None:
    """Marque présente dans le nom (pas seulement en préfixe) — utile packs / offres."""
    if not name_key:
        return None
    for cand in brands:
        if re.search(rf"(?<!\w){re.escape(cand.key)}(?!\w)", name_key):
            return cand
    return None


def primary_brand_from_pack_slug(
    slug: str,
    brand_by_key: dict[str, BrandCandidate],
    ordered: list[BrandCandidate],
) -> BrandCandidate | None:
    """Extrait la marque principale depuis le slug d'un pack (après chiffres initiaux)."""
    parts = slug_brand_prefix_parts(slug)
    if not parts:
        return None
    for n in range(min(3, len(parts)), 0, -1):
        key = normalize_key(" ".join(parts[:n]))
        if not key or is_generic_short_brand(key):
            continue
        if key in brand_by_key:
            return brand_by_key[key]
        if key in KNOWN_BRAND_DISPLAY:
            return BrandCandidate(
                key=key,
                display=KNOWN_BRAND_DISPLAY[key],
                frequency=MIN_SLUG_BRAND_FREQUENCY,
                sources={"pack_slug"},
            )
    first = normalize_key(parts[0])
    if first and not is_generic_short_brand(first):
        for cand in ordered:
            if cand.key == first or cand.key.startswith(first + " "):
                return cand
        if first in KNOWN_BRAND_DISPLAY:
            return BrandCandidate(
                key=first,
                display=KNOWN_BRAND_DISPLAY[first],
                frequency=MIN_SLUG_BRAND_FREQUENCY,
                sources={"pack_slug"},
            )
    return None


def find_brand_in_description(description: str, brand_keys: list[str]) -> str | None:
    raw = strip_html(description)
    plain = normalize_key(raw)
    if not plain:
        return None

    label_match = re.search(
        r"(?is)(?:marque|brand|fabricant)\s*[:\-–—]\s*([^\n,.;|]+)",
        raw,
    )
    if label_match:
        label_key = normalize_key(label_match.group(1))
        for key in sorted(brand_keys, key=lambda k: -len(k.split())):
            if label_key == key or label_key.startswith(key + " "):
                return key

    for key in sorted(brand_keys, key=lambda k: -len(k.split())):
        if re.search(rf"(?<!\w){re.escape(key)}(?!\w)", plain):
            return key
    return None


def assign_brand_to_product(
    product: ProductRow,
    matcher: BrandMatcher,
) -> BrandAssignment:
    name_key = normalize_key(product.name)
    slug = product.slug or ""
    name_candidates = matcher.by_first_token.get(name_key.split()[0], ()) if name_key else ()

    for cand in name_candidates:
        if not name_key_starts_with_brand(name_key, cand.key):
            continue
        brand_slug_sk = matcher.brand_slug_sk[cand.key]
        slug_hit = slug_matches_brand(slug, brand_slug_sk)
        if slug_hit:
            return BrandAssignment(cand.display, 100, "name+slug")
        if cand.frequency >= HIGH_FREQUENCY_THRESHOLD:
            return BrandAssignment(cand.display, 100, "name+freq")
        if slug:
            conf = 80 if cand.frequency >= MIN_BRAND_FREQUENCY else 50
            return BrandAssignment(cand.display, conf, "name")
        conf = 80 if cand.frequency >= HIGH_FREQUENCY_THRESHOLD else 50
        return BrandAssignment(cand.display, conf, "name")

    if slug:
        for brand_slug_sk, cand in matcher.slug_prefixes:
            if slug_matches_brand(slug, brand_slug_sk):
                conf = 80 if cand.frequency >= HIGH_FREQUENCY_THRESHOLD else 50
                return BrandAssignment(cand.display, conf, "slug")

    if product.description:
        desc_key = find_brand_in_description(product.description, matcher.brand_keys_sorted)
        if desc_key:
            cand = matcher.brand_by_key[desc_key]
            return BrandAssignment(cand.display, 50, "description")

    pack = is_pack_or_offer(product.name, product.slug)
    embedded = find_brand_embedded_in_name_key(name_key, matcher.ordered)
    if embedded:
        method = "pack_name_embedded" if pack else "name_embedded"
        return BrandAssignment(embedded.display, 50, method)

    if pack and slug:
        slug_cand = primary_brand_from_pack_slug(slug, matcher.brand_by_key, matcher.ordered)
        if slug_cand:
            return BrandAssignment(slug_cand.display, 50, "pack_slug")

    return BrandAssignment(None, 0, "none")


def assign_all_products(
    products: list[ProductRow],
    brands: dict[str, BrandCandidate],
) -> list[tuple[ProductRow, BrandAssignment]]:
    matcher = build_brand_matcher(brands)
    return [(p, assign_brand_to_product(p, matcher)) for p in products]


def catalog_first_token_counts(products: list[ProductRow]) -> Counter[str]:
    counts: Counter[str] = Counter()
    for product in products:
        token = first_token_key(product.name)
        if token:
            counts[token] += 1
    return counts


def first_token_key(name: str) -> str:
    tokens = name.split()
    if not tokens:
        return ""
    return normalize_key(tokens[0])


def slug_first_token_key(slug: str) -> str:
    if not slug:
        return ""
    first = slug.split("-", 1)[0]
    return normalize_key(first.replace("-", " "))


def guess_unidentified_reason(
    product: ProductRow,
    brands: dict[str, BrandCandidate],
    name_first_counts: Counter[str],
    brand_keys: list[str],
) -> tuple[str, str]:
    """Code motif + détail court pour l'audit des non-identifiés."""
    ft = first_token_key(product.name)
    sf = slug_first_token_key(product.slug)

    if not (product.name or "").strip():
        return "nom_vide", ""
    if re.match(r"^\d", product.name.strip()):
        return "nom_commence_par_chiffre", ft or product.name[:40]
    if "&" in product.name or "&#" in product.name:
        return "entites_html_dans_nom", ft
    if not product.slug:
        return "sans_slug_beautymall", sf
    if ft in GENERIC_PREFIX_KEYS:
        return "premier_mot_generique", ft
    if sf and sf not in brands and name_first_counts.get(sf, 0) >= MIN_SLUG_BRAND_FREQUENCY:
        return "slug_suggere_marque_hors_dict", f"{sf} ({name_first_counts[sf]} produits)"
    desc_key = find_brand_in_description(product.description, brand_keys)
    if desc_key and desc_key in brands:
        return "marque_dans_description_seulement", brands[desc_key].display
    if ft and ft not in brands:
        freq = name_first_counts.get(ft, 0)
        if 3 <= freq < MIN_BRAND_FREQUENCY:
            return "marque_rare_sous_seuil", f"{ft} ({freq} produits, seuil {MIN_BRAND_FREQUENCY})"
        if 0 < freq <= 2:
            return "premier_mot_tres_rare", f"{ft} ({freq} produit(s))"
    if sf and sf not in brands and 0 < name_first_counts.get(sf, 0) < MIN_SLUG_BRAND_FREQUENCY:
        return "slug_rare_sous_seuil", f"{sf} ({name_first_counts.get(sf, 0)} produits)"
    return "aucune_correspondance", ft or sf


def audit_unidentified_products(
    products: list[ProductRow],
    assignments: list[tuple[ProductRow, BrandAssignment]],
    brands: dict[str, BrandCandidate],
    out_csv: Path,
    out_summary: Path,
) -> dict[str, Any]:
    brand_keys = sorted(brands.keys(), key=lambda k: (-len(k.split()), k))
    name_first_counts = catalog_first_token_counts(products)
    reason_counts: Counter[str] = Counter()
    first_token_unidentified: Counter[str] = Counter()
    slug_token_unidentified: Counter[str] = Counter()
    rows_out: list[dict[str, str]] = []

    for product, assign in assignments:
        if assign.brand:
            continue
        reason, detail = guess_unidentified_reason(
            product, brands, name_first_counts, brand_keys
        )
        reason_counts[reason] += 1
        ft = first_token_key(product.name)
        if ft:
            first_token_unidentified[ft] += 1
        sf = slug_first_token_key(product.slug)
        if sf:
            slug_token_unidentified[sf] += 1
        rows_out.append(
            {
                "id": product.id,
                "name": product.name,
                "slug": product.slug,
                "url_produit": product.url_produit,
                "first_token": ft,
                "slug_first_token": sf,
                "reason": reason,
                "reason_detail": detail,
                "description_excerpt": product.plain_description[:160],
            }
        )

    out_csv.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows_out[0].keys()) if rows_out else [
        "id", "name", "slug", "url_produit", "first_token",
        "slug_first_token", "reason", "reason_detail", "description_excerpt",
    ]
    with out_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows_out)

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "unidentified_total": len(rows_out),
        "reason_breakdown": dict(reason_counts.most_common()),
        "top_first_tokens_unidentified": [
            {"token": t, "count": c} for t, c in first_token_unidentified.most_common(40)
        ],
        "top_slug_tokens_unidentified": [
            {"token": t, "count": c} for t, c in slug_token_unidentified.most_common(40)
        ],
        "action_hints": {
            "marque_rare_sous_seuil": "Baisser --min-frequency ou ajouter des seeds KNOWN_BRAND_DISPLAY",
            "marque_dans_description_seulement": "Renforcer l'extraction depuis full_description",
            "entites_html_dans_nom": "Décoder HTML entities avant matching (L'Oréal, etc.)",
            "slug_suggere_marque_hors_dict": "Ajouter marque depuis slug Beautymall",
            "sans_slug_beautymall": "Produits sans match sitemap — peu recoverable automatiquement",
        },
    }
    out_summary.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def print_audit_summary(summary: dict[str, Any]) -> None:
    print("\n" + "=" * 72)
    print("AUDIT PRODUITS SANS MARQUE")
    print("=" * 72)
    print(f"Total non identifiés : {summary['unidentified_total']}")
    print("\nMotifs principaux :")
    for reason, count in summary["reason_breakdown"].items():
        print(f"  • {reason}: {count}")
    print("\nTop 15 premiers mots (noms non identifiés) :")
    for row in summary["top_first_tokens_unidentified"][:15]:
        print(f"  • {row['token']}: {row['count']}")
    print("\nTop 10 tokens slug Beautymall (non identifiés) :")
    for row in summary["top_slug_tokens_unidentified"][:10]:
        print(f"  • {row['token']}: {row['count']}")


# ---------------------------------------------------------------------------
# Rapport & prévisualisation
# ---------------------------------------------------------------------------


def build_report(
    products: list[ProductRow],
    assignments: list[tuple[ProductRow, BrandAssignment]],
    brands: dict[str, BrandCandidate],
) -> dict[str, Any]:
    total = len(products)
    identified = sum(1 for _, a in assignments if a.brand)
    by_confidence = Counter(a.confidence for _, a in assignments)
    brand_product_counts = Counter(
        a.brand for _, a in assignments if a.brand
    )
    top_100 = brand_product_counts.most_common(100)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_products": total,
        "identified_products": identified,
        "unidentified_products": total - identified,
        "coverage_rate_percent": round((identified / total * 100) if total else 0, 2),
        "unique_brands_assigned": len(brand_product_counts),
        "unique_brands_dictionary": len(brands),
        "confidence_breakdown": dict(sorted(by_confidence.items())),
        "top_100_brands": [{"brand": b, "count": c} for b, c in top_100],
        "unidentified_examples": [
            p.name
            for p, a in assignments
            if not a.brand
        ][:30],
    }


def print_preview(
    assignments: list[tuple[ProductRow, BrandAssignment]],
    brands: dict[str, BrandCandidate],
    limit: int = PREVIEW_BRAND_COUNT,
) -> None:
    brand_examples: dict[str, list[str]] = defaultdict(list)
    brand_counts: Counter[str] = Counter()
    for product, assign in assignments:
        if not assign.brand:
            continue
        brand_counts[assign.brand] += 1
        if len(brand_examples[assign.brand]) < EXAMPLES_PER_BRAND:
            brand_examples[assign.brand].append(product.name)

    print("\n" + "=" * 72)
    print(f"PRÉVISUALISATION — top {limit} marques détectées")
    print("=" * 72)
    for i, (brand, count) in enumerate(brand_counts.most_common(limit), start=1):
        examples = brand_examples.get(brand, [])
        ex_txt = " | ".join(examples[:EXAMPLES_PER_BRAND])
        dict_entry = next(
            (b for b in brands.values() if b.display == brand),
            None,
        )
        meta = ""
        if dict_entry:
            meta = f" [freq dict={dict_entry.frequency}, slug={dict_entry.slug_hits}, name={dict_entry.name_hits}]"
        print(f"{i:3}. {brand:<32} {count:5} prod.{meta}")
        if ex_txt:
            print(f"      ex. {ex_txt[:110]}{'…' if len(ex_txt) > 110 else ''}")


def print_summary(report: dict[str, Any]) -> None:
    print("\n" + "=" * 72)
    print("RAPPORT D'EXTRACTION")
    print("=" * 72)
    print(f"Produits total          : {report['total_products']}")
    print(f"Marques uniques         : {report['unique_brands_assigned']}")
    print(f"Produits identifiés     : {report['identified_products']}")
    print(f"Produits non identifiés : {report['unidentified_products']}")
    print(f"Taux de couverture      : {report['coverage_rate_percent']} %")
    print(f"Confiance               : {report['confidence_breakdown']}")
    print("\nTop 20 marques :")
    for row in report["top_100_brands"][:20]:
        print(f"  • {row['brand']}: {row['count']}")


# ---------------------------------------------------------------------------
# Supabase : DDL + mise à jour
# ---------------------------------------------------------------------------


def ensure_brand_columns() -> bool:
    db_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not db_url:
        print(
            "\n⚠ DATABASE_URL / SUPABASE_DB_URL absent — impossible d'exécuter ALTER TABLE automatiquement."
        )
        print("  Appliquez la migration : supabase/migrations/20260710_001_products_brand_columns.sql")
        print("  ou exécutez dans SQL Editor :\n"
        + BRAND_DDL_SQL)
        return False
    try:
        import psycopg2
    except ImportError:
        print("\n⚠ psycopg2-binary manquant — installez les dépendances ou appliquez la migration SQL.")
        return False

    with psycopg2.connect(db_url) as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(BRAND_DDL_SQL)
    print("\nOK — colonnes brand / brand_confidence verifiees (ALTER TABLE).")
    return True


def verify_brand_columns(client: Client) -> bool:
    try:
        client.table("products").select("brand,brand_confidence").limit(1).execute()
        return True
    except Exception as exc:
        msg = str(exc).lower()
        if "brand" in msg and ("column" in msg or "schema cache" in msg):
            return False
        raise


def update_supabase_via_postgres(updates: list[dict[str, Any]]) -> int | None:
    """Mise à jour bulk via SQL direct (plus rapide), si DATABASE_URL est configurée."""
    db_url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not db_url or not updates:
        return None
    try:
        import psycopg2
        from psycopg2.extras import execute_batch
    except ImportError:
        return None

    rows = [(item["brand"], item["brand_confidence"], item["id"]) for item in updates]
    with psycopg2.connect(db_url) as conn:
        with conn.cursor() as cur:
            execute_batch(
                cur,
                """
                UPDATE public.products
                SET brand = %s, brand_confidence = %s
                WHERE id = %s::uuid
                """,
                rows,
                page_size=500,
            )
        conn.commit()
    return len(updates)


def update_supabase(
    client: Client,
    assignments: list[tuple[ProductRow, BrandAssignment]],
) -> int:
    updates: list[dict[str, Any]] = []
    for product, assign in assignments:
        if not product.id or product.id.startswith("csv-"):
            continue
        updates.append(
            {
                "id": product.id,
                "brand": assign.brand,
                "brand_confidence": assign.confidence,
            }
        )

    pg_count = update_supabase_via_postgres(updates)
    if pg_count is not None:
        print(f"\r  … {pg_count}/{len(updates)} produits mis à jour (SQL direct)")
        print()
        return pg_count

    # Ne pas utiliser upsert : PostgREST remplace toute la ligne et écrase name, etc.
    updated = 0
    for item in updates:
        client.table("products").update(
            {
                "brand": item["brand"],
                "brand_confidence": item["brand_confidence"],
            }
        ).eq("id", item["id"]).execute()
        updated += 1
        if updated % UPDATE_BATCH_SIZE == 0 or updated == len(updates):
            print(
                f"\r  … {updated}/{len(updates)} produits mis à jour",
                end="",
                flush=True,
            )
    print()
    return updated


def ask_confirmation() -> bool:
    print("\n" + "-" * 72)
    answer = input(
        "Confirmer la mise à jour Supabase (brand + brand_confidence) ? [o/N] "
    ).strip().lower()
    return answer in {"o", "oui", "y", "yes"}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extraction intelligente des marques produits (catalogue Beautymall)."
    )
    parser.add_argument(
        "--source",
        choices=("supabase", "csv"),
        default="supabase",
        help="Source des produits (défaut : supabase)",
    )
    parser.add_argument(
        "--csv",
        type=Path,
        default=DEFAULT_CSV,
        help=f"Chemin CSV si --source csv (défaut : {DEFAULT_CSV.name})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Analyse + rapport + prévisualisation, sans écriture Supabase",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Mettre à jour Supabase sans demander confirmation",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=DEFAULT_REPORT,
        help="Chemin du rapport JSON",
    )
    parser.add_argument(
        "--preview-count",
        type=int,
        default=PREVIEW_BRAND_COUNT,
        help=f"Nombre de marques affichées en prévisualisation (0 = sauter, défaut {PREVIEW_BRAND_COUNT})",
    )
    parser.add_argument(
        "--min-frequency",
        type=int,
        default=MIN_BRAND_FREQUENCY,
        help=f"Fréquence minimale pour entrer dans le dictionnaire (défaut {MIN_BRAND_FREQUENCY})",
    )
    parser.add_argument(
        "--audit-unidentified",
        nargs="?",
        const=str(DEFAULT_AUDIT_CSV),
        default="",
        metavar="CSV",
        help=(
            "Audit des produits sans marque → CSV (+ JSON motifs). "
            "N'écrit pas Supabase. Utilise --source csv par défaut."
        ),
    )
    parser.add_argument(
        "--audit-summary",
        type=Path,
        default=DEFAULT_AUDIT_SUMMARY,
        help="Rapport JSON des motifs (avec --audit-unidentified)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    global MIN_BRAND_FREQUENCY
    MIN_BRAND_FREQUENCY = max(2, args.min_frequency)

    load_env_local()

    audit_mode = bool(args.audit_unidentified)
    if audit_mode and args.source == "supabase":
        args.source = "csv"
        print("(audit — lecture CSV locale, sans toucher Supabase)")

    print("Chargement des produits…")
    products: list[ProductRow]
    supabase_client: Client | None = None

    if args.source == "csv":
        if not args.csv.is_file():
            print(f"CSV introuvable : {args.csv}", file=sys.stderr)
            return 1
        products = load_products_from_csv(args.csv)
        print(f"  {len(products)} produit(s) depuis {args.csv}")
    else:
        if create_client is None:
            print(
                "Installez les dépendances : pip install -r scripts/requirements-product-brands.txt",
                file=sys.stderr,
            )
            return 1
        url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            print(
                "Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local",
                file=sys.stderr,
            )
            return 1
        supabase_client = create_supabase_client(url, key)
        products = fetch_products_from_supabase(supabase_client)
        print(f"  {len(products)} produit(s) depuis Supabase")

    if not products:
        print("Aucun produit à traiter.", file=sys.stderr)
        return 1

    print("Construction du dictionnaire de marques…")
    brands = build_brand_dictionary(products)
    print(f"  {len(brands)} entrée(s) dans le dictionnaire")

    print("Attribution marque + score de confiance…")
    assignments = assign_all_products(products, brands)

    if audit_mode:
        audit_csv = Path(args.audit_unidentified)
        summary = audit_unidentified_products(
            products, assignments, brands, audit_csv, args.audit_summary
        )
        print_audit_summary(summary)
        print(f"\nExport détaillé : {audit_csv}")
        print(f"Synthèse motifs  : {args.audit_summary}")
        return 0

    report = build_report(products, assignments, brands)
    if args.preview_count > 0:
        print_preview(assignments, brands, limit=args.preview_count)
    print_summary(report)

    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nRapport JSON : {args.report}")

    if args.dry_run or args.source == "csv":
        if args.source == "csv":
            print("\n(mode CSV — aucune écriture Supabase ; utilisez --source supabase pour appliquer)")
        else:
            print("\n(dry-run — aucune écriture Supabase)")
        return 0

    if supabase_client is None:
        return 0

    if not args.yes and not ask_confirmation():
        print("Annulé — aucune modification Supabase.")
        return 0

    if not verify_brand_columns(supabase_client):
        ok = ensure_brand_columns()
        if not ok:
            print("\nColonnes manquantes. Appliquez la migration puis relancez.", file=sys.stderr)
            return 1
        if not verify_brand_columns(supabase_client):
            print("Les colonnes brand / brand_confidence restent inaccessibles.", file=sys.stderr)
            return 1

    print("\nMise à jour Supabase…")
    count = update_supabase(supabase_client, assignments)
    print(f"Termine : {count} produit(s) mis a jour.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
