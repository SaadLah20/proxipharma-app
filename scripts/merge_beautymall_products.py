#!/usr/bin/env python3
"""
Fusionne le catalogue WooCommerce (CSV principal) avec le sitemap BeautyMall.

Sorties (dossier --out-dir, défaut : dossier de ce script) :
  - products_final.csv      : toutes les colonnes du CSV principal + url_produit + url_image_valide
  - products_unmatched.csv  : lignes sans correspondance (score < seuil)

Matching : nom produit normalisé ↔ slug sitemap (RapidFuzz, seuil 85 %).

Installation (si Python est installé) :
  pip install -r scripts/requirements-beautymall-merge.txt

Alternative sans Python (recommandé si pip/python introuvables) :
  node scripts/merge-beautymall-products.mjs

Usage :
  python scripts/merge_beautymall_products.py
  python scripts/merge_beautymall_products.py --main "C:/Users/pc/Downloads/wp-https___PRODUCTS PARA (1).csv"
  python scripts/merge_beautymall_products.py --threshold 90
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import unicodedata
from pathlib import Path

try:
    from rapidfuzz import fuzz, process
except ImportError:
    print(
        "RapidFuzz est requis : pip install -r scripts/requirements-beautymall-merge.txt",
        file=sys.stderr,
    )
    sys.exit(1)

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_MAIN = Path(r"C:\Users\pc\Downloads\wp-https___PRODUCTS PARA (1).csv")
DEFAULT_SITEMAP = SCRIPT_DIR / "beautymall_sitemap_products.csv"
DEFAULT_OUT_DIR = SCRIPT_DIR
MATCH_THRESHOLD = 85
PROGRESS_EVERY = 250


def normalize_name_for_slug_match(text: str) -> str:
    """Minuscules, sans accents, espaces → tirets, caractères spéciaux retirés."""
    if not text:
        return ""
    s = text.strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def read_csv_dicts(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ValueError(f"CSV sans en-tête : {path}")
        fieldnames = list(reader.fieldnames)
        rows: list[dict[str, str]] = []
        for raw in reader:
            row = {k: (v if v is not None else "") for k, v in raw.items()}
            rows.append(row)
    return fieldnames, rows


def write_csv_dicts(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def load_sitemap(path: Path) -> tuple[list[str], dict[str, dict[str, str]]]:
    _, rows = read_csv_dicts(path)
    slugs: list[str] = []
    by_slug: dict[str, dict[str, str]] = {}
    for row in rows:
        slug = (row.get("slug") or "").strip()
        if not slug:
            continue
        slugs.append(slug)
        by_slug[slug] = {
            "slug": slug,
            "url_produit": (row.get("url_produit") or "").strip(),
            "url_image": (row.get("url_image") or "").strip(),
        }
    return slugs, by_slug


def find_best_match(
    normalized_name: str,
    slugs: list[str],
    by_slug: dict[str, dict[str, str]],
    threshold: float,
) -> tuple[dict[str, str] | None, float]:
    if not normalized_name:
        return None, 0.0

    if normalized_name in by_slug:
        return by_slug[normalized_name], 100.0

    wr = process.extractOne(
        normalized_name,
        slugs,
        scorer=fuzz.WRatio,
        score_cutoff=threshold,
    )
    tsr = process.extractOne(
        normalized_name,
        slugs,
        scorer=fuzz.token_set_ratio,
        score_cutoff=threshold,
    )

    candidates: list[tuple[str, float, int]] = []
    if wr:
        candidates.append((wr[0], float(wr[1]), 0))
    if tsr:
        candidates.append((tsr[0], float(tsr[1]), 1))

    if not candidates:
        return None, 0.0

    best_slug, best_score, _ = max(candidates, key=lambda x: (x[1], -x[2]))
    return by_slug[best_slug], best_score


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Fusion CSV produits + sitemap BeautyMall (RapidFuzz).")
    p.add_argument("--main", type=Path, default=DEFAULT_MAIN, help="CSV principal WooCommerce")
    p.add_argument("--sitemap", type=Path, default=DEFAULT_SITEMAP, help="CSV sitemap BeautyMall")
    p.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR, help="Dossier de sortie")
    p.add_argument(
        "--threshold",
        type=float,
        default=MATCH_THRESHOLD,
        help="Score minimum RapidFuzz (0-100, défaut 85)",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    main_path: Path = args.main
    sitemap_path: Path = args.sitemap
    out_dir: Path = args.out_dir
    threshold: float = args.threshold

    if not main_path.is_file():
        print(f"Fichier principal introuvable : {main_path}", file=sys.stderr)
        sys.exit(1)
    if not sitemap_path.is_file():
        print(f"Sitemap introuvable : {sitemap_path}", file=sys.stderr)
        sys.exit(1)

    out_dir.mkdir(parents=True, exist_ok=True)
    out_final = out_dir / "products_final.csv"
    out_unmatched = out_dir / "products_unmatched.csv"

    print(f"CSV principal : {main_path}")
    print(f"Sitemap       : {sitemap_path}")
    print(f"Seuil RapidFuzz : {threshold}%")
    print("Chargement sitemap…")
    slugs, by_slug = load_sitemap(sitemap_path)
    print(f"  {len(slugs)} slug(s) dans le sitemap")

    print("Chargement catalogue principal…")
    main_fields, main_rows = read_csv_dicts(main_path)
    print(f"  {len(main_rows)} ligne(s) produit")

    extra_cols = ["url_produit", "url_image_valide"]
    out_fields = main_fields + [c for c in extra_cols if c not in main_fields]

    final_rows: list[dict[str, str]] = []
    unmatched_rows: list[dict[str, str]] = []
    matched_count = 0

    for i, row in enumerate(main_rows, start=1):
        name = (row.get("name") or "").strip()
        norm = normalize_name_for_slug_match(name)
        hit, score = find_best_match(norm, slugs, by_slug, threshold)

        out_row = dict(row)
        if hit:
            out_row["url_produit"] = hit["url_produit"]
            out_row["url_image_valide"] = hit["url_image"]
            matched_count += 1
        else:
            out_row["url_produit"] = ""
            out_row["url_image_valide"] = ""
            unmatched_rows.append(out_row)

        final_rows.append(out_row)

        if i % PROGRESS_EVERY == 0:
            print(f"  … {i}/{len(main_rows)} traités ({matched_count} correspondances)")

    write_csv_dicts(out_final, out_fields, final_rows)
    write_csv_dicts(out_unmatched, out_fields, unmatched_rows)

    total = len(main_rows)
    unmatched_count = len(unmatched_rows)
    rate = (matched_count / total * 100.0) if total else 0.0

    print("")
    print("Terminé.")
    print(f"  Fichier fusionné   : {out_final}")
    print(f"  Sans correspondance : {out_unmatched}")
    print(f"  Produits (CSV principal) : {total}")
    print(f"  Correspondances trouvées : {matched_count}")
    print(f"  Sans correspondance      : {unmatched_count}")
    print(f"  Taux de correspondance   : {rate:.2f} %")


if __name__ == "__main__":
    main()
