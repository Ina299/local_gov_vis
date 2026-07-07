#!/usr/bin/env python3
"""
CLI for extracting budget data from prefecture PDFs.

Usage:
    # Extract all enabled prefectures
    python extract_cli.py

    # Extract specific prefectures
    python extract_cli.py --prefectures 27_osaka 14_kanagawa

    # List available prefectures
    python extract_cli.py --list

    # Force re-download and re-extraction
    python extract_cli.py --force

    # Merge extracted data into web app
    python extract_cli.py --merge
"""
import argparse
import logging
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from extractors import Config, ExtractionPipeline


def setup_logging(verbose: bool = False) -> None:
    """Configure logging."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )


def list_prefectures(config: Config) -> None:
    """List all available prefectures."""
    print("\n Available prefectures:")
    print("-" * 60)

    for key in config.list_prefectures():
        pref = config.get_prefecture(key)
        if pref:
            status = "enabled" if pref.enabled else "disabled"
            pages = f"pages {pref.pages}" if pref.pages else "no pages"
            print(f"  {key:<15} {pref.name:<10} ({pref.code}) - {pages}")

    print("-" * 60)
    print(f" Total: {len(config.list_prefectures())} prefectures\n")


def merge_to_web(config: Config, output_dir: Path) -> None:
    """Merge extracted data into web app budgets.json."""
    import json

    budgets_path = output_dir.parent.parent.parent / "web" / "public" / "budgets.json"

    if not budgets_path.exists():
        print(f"Error: budgets.json not found at {budgets_path}")
        return

    # Load current budgets
    with open(budgets_path, "r", encoding="utf-8") as f:
        budgets = json.load(f)

    # Process each extracted prefecture
    updated = 0
    for pref_dir in output_dir.iterdir():
        if not pref_dir.is_dir():
            continue

        data_file = pref_dir / "budget_data.json"
        if not data_file.exists():
            continue

        with open(data_file, "r", encoding="utf-8") as f:
            extracted = json.load(f)

        # Find matching budget entry
        code = extracted.get("code")
        budget_idx = next(
            (i for i, b in enumerate(budgets) if b.get("code") == code),
            None
        )

        if budget_idx is None:
            print(f"  No matching budget entry for {code}")
            continue

        # Convert extracted categories to budget format
        # Determine unit multiplier (convert to 円)
        unit = extracted.get("unit", "千円")
        if unit == "百万円":
            multiplier = 1_000_000
        elif unit == "千円":
            multiplier = 1_000
        elif unit == "円":
            multiplier = 1
        else:
            multiplier = 1_000  # Default to 千円

        expenditures = []
        for cat in extracted.get("categories", []):
            name = cat.get("款名", "")
            amount = cat.get("予算額", 0) * multiplier
            category = config.get_category(name)

            expenditures.append({
                "name": name,
                "amount": amount,
                "category": category
            })

        if expenditures:
            total = sum(e["amount"] for e in expenditures)
            budgets[budget_idx]["expenditures"] = expenditures
            budgets[budget_idx]["totalExpenditure"] = total
            budgets[budget_idx]["totalRevenue"] = total
            budgets[budget_idx]["sourceUrl"] = extracted.get("source_url", "")
            budgets[budget_idx]["crawledAt"] = extracted.get("extracted_at", "")

            print(f"  Updated {extracted.get('prefecture')}: {len(expenditures)} categories")
            updated += 1

    # Save updated budgets
    with open(budgets_path, "w", encoding="utf-8") as f:
        json.dump(budgets, f, ensure_ascii=False, indent=2)

    print(f"\nMerged {updated} prefectures into {budgets_path}")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Extract budget data from Japanese prefecture PDFs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        "-p", "--prefectures",
        nargs="+",
        help="Specific prefectures to extract (e.g., 27_osaka 14_kanagawa)"
    )
    parser.add_argument(
        "-l", "--list",
        action="store_true",
        help="List available prefectures and exit"
    )
    parser.add_argument(
        "-f", "--force",
        action="store_true",
        help="Force re-download and re-extraction"
    )
    parser.add_argument(
        "-m", "--merge",
        action="store_true",
        help="Merge extracted data into web app budgets.json"
    )
    parser.add_argument(
        "-c", "--config",
        type=Path,
        help="Path to config file (default: config/prefectures.yaml)"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )

    args = parser.parse_args()
    setup_logging(args.verbose)

    # Load configuration
    try:
        config = Config.load(args.config)
    except FileNotFoundError as e:
        print(f"Error: {e}")
        return 1

    # Handle --list
    if args.list:
        list_prefectures(config)
        return 0

    # Initialize pipeline
    output_dir = Path(__file__).parent.parent / "output" / "prefectures"
    pipeline = ExtractionPipeline(config, output_dir)

    # Handle --merge only
    if args.merge and not args.prefectures:
        merge_to_web(config, output_dir)
        return 0

    # Run extraction
    prefectures = args.prefectures
    if not prefectures:
        prefectures = config.list_prefectures()

    if not prefectures:
        print("No prefectures to process. Check config or use --prefectures.")
        return 1

    print(f"\nExtracting {len(prefectures)} prefecture(s)...")
    print("=" * 60)

    try:
        results = pipeline.extract_all(
            prefectures=prefectures,
            force_download=args.force,
            force_convert=args.force
        )

        # Summary
        success = sum(1 for r in results.values() if r.success)
        failed = len(results) - success

        print("\n" + "=" * 60)
        print(f"Extraction complete: {success} succeeded, {failed} failed")

        # Merge if requested
        if args.merge:
            print("\nMerging to web app...")
            merge_to_web(config, output_dir)

    finally:
        pipeline.cleanup()

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
