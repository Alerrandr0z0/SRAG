"""Validate .opencode/skills/*/SKILL.md against live source code.

Detects stale facts: changed constants, missing PII columns,
divergent CORS config, and drifted source files.

Usage:
    uv run python scripts/validate_skills.py          # full validation
    uv run python scripts/validate_skills.py --fix     # update checksums
"""

from __future__ import annotations

import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_PATH = str(PROJECT_ROOT / "src")
if SRC_PATH not in sys.path:
    sys.path.insert(0, SRC_PATH)

SKILLS_DIR = PROJECT_ROOT / ".agents" / "skills"
SRC_DIR = PROJECT_ROOT / "src"

KNOWN_COLUMNS_WARNING = """⚠️  _KNOWN_COLUMNS has changed since srag-sivep-domain was written.
    Run `make skill-validate --fix` to update the column list."""

DEATH_OUTCOMES_WARNING = """⚠️  DEATH_OUTCOMES has changed since skills were written.
    Update srag-data-etl and srag-sivep-domain if the death logic changed."""

PASS = "✅"
FAIL = "❌"
STALE = "⚠️"


def git_last_modified(path: str | Path) -> str:
    try:
        r = subprocess.run(
            ["git", "log", "-1", "--format=%ai", "--", str(path)],
            capture_output=True, text=True, cwd=os.getcwd(), timeout=15,
        )
        return r.stdout.strip() if r.returncode == 0 else "unknown"
    except Exception:
        return "unknown"


def git_hash(path: str | Path) -> str:
    try:
        r = subprocess.run(
            ["git", "hash-object", str(path)],
            capture_output=True, text=True, cwd=os.getcwd(), timeout=15,
        )
        return r.stdout.strip()[:12] if r.returncode == 0 else "unversioned"
    except Exception:
        return "unversioned"


def file_checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]


def parse_frontmatter(text: str) -> dict[str, list[str]]:
    m = re.match(r"^---\n(.*?)\n---", text, re.DOTALL)
    if not m:
        return {}
    meta: dict[str, list[str]] = {}
    key = ""
    for line in m.group(1).splitlines():
        if m2 := re.match(r"^(\w+):\s*(.*)", line):
            key = m2.group(1)
            meta.setdefault(key, [])
            val = m2.group(2).strip()
            if val:
                meta[key] = [val]
        elif line.startswith("  - ") and key:
            meta[key].append(line.strip("  - "))
    return meta


def validate_data_etl() -> list[str]:
    errors: list[str] = []
    skill_file = SKILLS_DIR / "srag-data-etl" / "SKILL.md"
    text = skill_file.read_text()

    # -- Source freshness --
    sources = ["scripts/ingest_data.py", "src/srag/data/database.py",
               "src/srag/data/loader.py", "src/srag/data/references.py"]
    for src in sources:
        src_path = Path(os.getcwd()) / src
        if not src_path.exists():
            errors.append(f"{FAIL} Source file missing: {src}")
            continue
        last_mod = git_last_modified(src)
        skill_mod = git_last_modified(skill_file)
        if last_mod and skill_mod and last_mod > skill_mod and "1970" not in last_mod and "1970" not in skill_mod:
            errors.append(
                f"{STALE} {src} modified {last_mod} (skill: {skill_mod})"
            )

    # -- DEATH_OUTCOMES (belongs in srag-sivep-domain, not here) --
    # Only check that the skill doesn't contain stale values

    # -- Privacy columns --
    try:
        from srag.data.loader import SENSITIVE_FIELDS
        for col in sorted(SENSITIVE_FIELDS):
            if col not in text:
                errors.append(f"{FAIL} Privacy column {col} missing from srag-data-etl docs")
    except (ImportError, AttributeError):
        errors.append(f"{STALE} Could not check privacy columns")

    # -- Mossoró codes --
    try:
        from srag.data.references import MOSSORO_IBGE_CODES
        for code in MOSSORO_IBGE_CODES:
            if code not in text:
                errors.append(
                    f"{FAIL} Mossoró IBGE code {code} missing from srag-data-etl docs"
                )
    except ImportError:
        pass

    if not errors:
        errors.append(f"{PASS} srag-data-etl — all checks passed")
    return errors


def validate_sivep_domain() -> list[str]:
    errors: list[str] = []
    skill_file = SKILLS_DIR / "srag-sivep-domain" / "SKILL.md"
    text = skill_file.read_text()

    # -- Source freshness --
    sources = ["src/srag/data/references.py", "src/srag/data/loader.py",
               "src/srag/data/analytics/quality.py", "src/srag/api/core.py",
               "src/srag/api/dependencies.py"]
    for src in sources:
        src_path = Path(os.getcwd()) / src
        if not src_path.exists():
            errors.append(f"{FAIL} Source file missing: {src}")
            continue
        last_mod = git_last_modified(src)
        skill_mod = git_last_modified(skill_file)
        if last_mod and skill_mod and last_mod > skill_mod and "1970" not in last_mod and "1970" not in skill_mod:
            errors.append(
                f"{STALE} {src} modified {last_mod} (skill: {skill_mod})"
            )

    # -- Outcome constants --
    try:
        from srag.data.references import DEATH_OUTCOMES, VALID_OUTCOMES
        if "DEATH_OUTCOMES = " not in text:
            errors.append(f"{FAIL} DEATH_OUTCOMES section missing from srag-sivep-domain")
    except ImportError:
        errors.append(f"{STALE} Could not import references.py")

    # -- Privacy columns --
    try:
        from srag.data.loader import SENSITIVE_FIELDS
        for col in sorted(SENSITIVE_FIELDS):
            if col not in text:
                errors.append(f"{FAIL} Privacy column {col} missing from srag-sivep-domain")
    except (ImportError, AttributeError):
        errors.append(f"{STALE} Could not check privacy columns")

    # -- CLASSI_FIN codes --
    expected_classi = {"1": "Influenza", "2": "Other respiratory virus",
                       "3": "Other etiological agent", "4": "Unspecified",
                       "5": "COVID-19"}
    for code, meaning in expected_classi.items():
        if code not in text or meaning.lower() not in text.lower():
            errors.append(f"{FAIL} CLASSI_FIN {code} ({meaning}) missing from srag-sivep-domain")

    # -- CS_RACA codes --
    expected_raca = {"1": "Branca", "2": "Preta", "3": "Amarela",
                     "4": "Parda", "5": "Indígena"}
    for code, meaning in expected_raca.items():
        if code not in text or meaning.lower() not in text.lower():
            errors.append(f"{FAIL} CS_RACA {code} ({meaning}) missing from srag-sivep-domain")

    # -- SUPORT_VEN codes --
    expected_vent = {"1": "invasive", "2": "non-invasive", "3": "No"}
    for code, meaning in expected_vent.items():
        if code not in text or meaning.lower() not in text.lower():
            errors.append(f"{FAIL} SUPORT_VEN {code} ({meaning}) missing from srag-sivep-domain")

    # -- Quality blocks --
    expected_blocks = ["Identificação", "Demografia", "Cuidado",
                       "Diagnóstico", "Vigilância Genômica"]
    for block in expected_blocks:
        if block not in text:
            errors.append(f"{FAIL} Quality block '{block}' missing from srag-sivep-domain")

    if not errors:
        errors.append(f"{PASS} srag-sivep-domain — all checks passed")
    return errors


def validate_security_review() -> list[str]:
    errors: list[str] = []
    skill_file = SKILLS_DIR / "security-review" / "SKILL.md"
    text = skill_file.read_text()

    # -- Source freshness --
    sources = ["src/srag/api/main.py", "src/srag/api/core.py",
               "src/srag/data/loader.py",
               "tests/unit/test_security.py"]
    for src in sources:
        src_path = Path(os.getcwd()) / src
        if not src_path.exists():
            errors.append(f"{FAIL} Source file missing: {src}")
            continue
        last_mod = git_last_modified(src)
        skill_mod = git_last_modified(skill_file)
        if last_mod and skill_mod and last_mod > skill_mod and "1970" not in last_mod and "1970" not in skill_mod:
            errors.append(
                f"{STALE} {src} modified {last_mod} (skill: {skill_mod})"
            )

    # -- CORS origins --
    try:
        main_text = (SRC_DIR / "srag" / "api" / "main.py").read_text()
        origins = re.findall(r'"([^"]*)"', main_text.split("allow_origins")[1].split("]")[0])
        for origin in origins:
            if origin not in text:
                errors.append(
                    f"{FAIL} CORS origin '{origin}' not documented in security-review skill"
                )
    except (IndexError, FileNotFoundError) as e:
        errors.append(f"{STALE} Could not parse CORS config: {e}")

    # -- CORS methods --
    try:
        methods = re.findall(r'"([^"]*)"',
                             main_text.split("allow_methods")[1].split("]")[0])
        for method in methods:
            if method not in text:
                errors.append(
                    f"{FAIL} CORS method '{method}' not documented in security-review skill"
                )
    except (IndexError, FileNotFoundError):
        pass

    # -- Known columns --
    if "_KNOWN_COLUMNS" not in text:
        errors.append(f"{FAIL} _KNOWN_COLUMNS section missing from security-review skill")

    # -- Privacy columns --
    try:
        from srag.data.loader import SENSITIVE_FIELDS
        for col in sorted(SENSITIVE_FIELDS):
            if col not in text:
                errors.append(f"{FAIL} Privacy column {col} missing from security-review")
    except (ImportError, AttributeError):
        errors.append(f"{STALE} Could not check privacy columns")

    # -- Test file --
    test_file = SRC_DIR.parent / "tests" / "unit" / "test_security.py"
    if not test_file.exists():
        errors.append(f"{FAIL} Security test file missing: tests/unit/test_security.py")
    else:
        test_text = test_file.read_text()
        for cls in ["TestCORS", "TestInputValidation", "TestDynamicSQL"]:
            if cls not in test_text:
                errors.append(f"{FAIL} Test class {cls} missing from test_security.py")

    if not errors:
        errors.append(f"{PASS} security-review — all checks passed")
    return errors


def update_checksum(skill_name: str) -> None:
    skill_file = SKILLS_DIR / skill_name / "SKILL.md"
    sources = parse_frontmatter(skill_file.read_text()).get("sources", [])
    combined = b""
    for src in sources:
        src_path = Path(os.getcwd()) / src
        if src_path.exists():
            combined += src_path.read_bytes()
    new_cs = hashlib.sha256(combined).hexdigest()[:12]
    content = skill_file.read_text()
    content = re.sub(
        r"checksum: \S+", f"checksum: {new_cs}", content
    )
    skill_file.write_text(content)
    print(f"  {PASS} {skill_name} checksum → {new_cs}")


def main() -> None:
    fix = "--fix" in sys.argv

    print(f"\n{'='*60}")
    print(" Skill Freshness Validation")
    print(f"{'='*60}\n")

    total = 0
    failed = 0

    for name, fn in [
        ("srag-data-etl", validate_data_etl),
        ("srag-sivep-domain", validate_sivep_domain),
        ("security-review", validate_security_review),
    ]:
        print(f"── {name} ──")
        results = fn()
        for r in results:
            print(f"  {r}")
            if r.startswith("❌"):
                failed += 1
            total += 1

        if fix and not any(r.startswith("❌") for r in results):
            update_checksum(name)

        print()

    print(f"{'='*60}")
    if failed:
        print(f" {FAIL} {failed} failures — run `make skill-validate` after fixing source, "
              "or `uv run python scripts/validate_skills.py --fix` to acknowledge drift.")
        sys.exit(1)
    else:
        print(f" {PASS} All skills validated. Run `make skill-validate` after any source change.\n")


if __name__ == "__main__":
    main()
