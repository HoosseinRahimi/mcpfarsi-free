import argparse
import base64
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"

# Catalog sources, most self-contained first:
#   1. data/servers.json shipped with the repo (snapshot of the public manifest)
#   2. ../_repos/iran-mcp/servers.json (when building inside the authoring workspace)
CATALOG_CANDIDATES = [
    ROOT / "data" / "servers.json",
    ROOT.parent / "_repos" / "iran-mcp" / "servers.json",
    ROOT / "_repos" / "iran-mcp" / "servers.json",
]

# 13 filter groups over the catalog's raw categories.
GROUPS = [
    {"id": "shop", "fa": "فروشگاه اینترنتی", "en": "Shopping",
     "cats": ["shopping", "prices"]},
    {"id": "beauty", "fa": "آرایشی و پوشاک", "en": "Beauty & fashion",
     "cats": ["beauty", "fashion"]},
    {"id": "classifieds", "fa": "آگهی و خودرو", "en": "Classifieds & cars",
     "cats": ["classifieds", "cars"]},
    {"id": "food", "fa": "غذا و خرید روزانه", "en": "Food & grocery",
     "cats": ["food"]},
    {"id": "travel", "fa": "سفر و اقامت", "en": "Travel & stays",
     "cats": ["travel"]},
    {"id": "finance", "fa": "مالی و بازار سرمایه", "en": "Money & markets",
     "cats": ["stocks", "economy", "crypto", "business"]},
    {"id": "jobs", "fa": "کار و فریلنس", "en": "Jobs & freelance",
     "cats": ["jobs", "freelance"]},
    {"id": "health", "fa": "سلامت و پزشک", "en": "Health",
     "cats": ["health"]},
    {"id": "media", "fa": "کتاب، خبر و سرگرمی", "en": "Books, news & media",
     "cats": ["books", "learning", "news", "sports", "entertainment", "video"]},
    {"id": "maps", "fa": "نقشه و مکان", "en": "Maps & places",
     "cats": ["maps"]},
    {"id": "gov", "fa": "دولت، قانون و آمار", "en": "Government & law",
     "cats": ["law", "tax", "calendar", "quakes"]},
    {"id": "dev", "fa": "ابزار توسعه", "en": "Dev & cloud",
     "cats": ["software", "cloud"]},
    {"id": "comm", "fa": "پیام و پرداخت", "en": "Messaging & payments",
     "cats": ["messaging"]},
]

FA_MONTHS = ["ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن",
             "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"]
FA_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


def fa_num(n: int) -> str:
    return str(n).translate(FA_DIGITS)


def find_catalog() -> Path:
    for p in CATALOG_CANDIDATES:
        if p.exists():
            return p
    raise SystemExit(
        "servers.json not found. Put a copy at data/servers.json "
        "(from github.com/sepehr071/iran-mcp) next to build.py."
    )


def load_catalog(path: Path) -> list[dict]:
    servers = json.loads(path.read_text(encoding="utf-8"))
    keep = ["name", "title", "category", "site", "description", "version",
            "pypi", "repository", "registry_name", "run", "url", "auth",
            "read_only", "env", "tool_count", "tools"]
    cleaned = []
    for s in servers:
        row = {k: s.get(k) for k in keep}
        row["env"] = [
            {"name": e.get("name"), "isRequired": bool(e.get("isRequired")),
             "isSecret": bool(e.get("isSecret")),
             "description": (e.get("description") or "")[:200]}
            for e in (s.get("env") or [])
        ]
        row["tools"] = [
            {"name": t.get("name"), "title": t.get("title") or "", "summary": t.get("summary") or ""}
            for t in (s.get("tools") or [])
        ]
        row["pkg"] = s.get("pypi") or s["name"]
        row["run"] = s.get("run") or ""
        row["url"] = s.get("url") or ""
        cleaned.append(row)
    return cleaned


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the single-file static site.")
    parser.add_argument("--out", default=str(ROOT / "index.html"),
                        help="output HTML path (default: index.html next to build.py)")
    args = parser.parse_args()

    catalog_path = find_catalog()
    servers = load_catalog(catalog_path)
    copy = json.loads((SRC / "copy_fa.json").read_text(encoding="utf-8"))
    css = (SRC / "styles.css").read_text(encoding="utf-8")
    js = (SRC / "app.js").read_text(encoding="utf-8")
    tpl = (SRC / "index.template.html").read_text(encoding="utf-8")

    known = {c for g in GROUPS for c in g["cats"]}
    groups = [dict(g) for g in GROUPS]
    leftovers = sorted({s["category"] for s in servers} - known)
    if leftovers:
        groups.append({"id": "other", "fa": "سایر", "en": "Other", "cats": leftovers})

    n_servers = len(servers)
    n_tools = sum(s["tool_count"] for s in servers)
    assert n_servers == len({s["name"] for s in servers}), "duplicate server names"

    today = date(2026, 11, 6)
    meta = {
        "servers": n_servers,
        "tools": n_tools,
        "groups": len(groups),
        "date_fa": f"{fa_num(today.day)} {FA_MONTHS[today.month - 1]} {fa_num(today.year)}",
        "date_en": today.strftime("%d %b %Y"),
        "source": "github.com/sepehr071/iran-mcp",
    }
    data = {"meta": meta, "servers": servers, "groups": groups}

    for weight in ("400", "500", "700"):
        path = SRC / "fonts" / f"vazir-{weight}.woff2"
        b64 = base64.b64encode(path.read_bytes()).decode("ascii")
        css = css.replace(f'url("fonts/vazir-{weight}.woff2")',
                          f'url("data:font/woff2;base64,{b64}")')

    def safe_json(obj) -> str:
        return json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")

    html = (tpl
            .replace("/*{{FONTS}}*/", "")
            .replace("/*{{CSS}}*/", css)
            .replace("{{DATA_JSON}}", safe_json(data))
            .replace("{{COPY_JSON}}", safe_json(copy))
            .replace("/*{{JS}}*/", js))

    html = html.replace('id="n-servers">72<', f'id="n-servers">{fa_num(n_servers)}<')
    html = html.replace('id="n-tools">896<', f'id="n-tools">{fa_num(n_tools)}<')
    html = html.replace('id="n-groups">13<', f'id="n-groups">{fa_num(len(groups))}<')
    html = html.replace('id="footer-date">', f'id="footer-date">{meta["date_fa"]}')
    html = html.replace("۷۲ سرور · ۸۹۶ ابزار", f"{fa_num(n_servers)} سرور · {fa_num(n_tools)} ابزار")
    html = html.replace("۷۲ سرور و ۸۹۶ ابزار", f"{fa_num(n_servers)} سرور و {fa_num(n_tools)} ابزار")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")

    size_kb = out.stat().st_size / 1024
    print(f"built {out}  ({size_kb:.0f} KB)")
    print(f"catalog {catalog_path}")
    print(f"servers={n_servers} tools={n_tools} groups={len(groups)} "
          f"categories={len({s['category'] for s in servers})}")


if __name__ == "__main__":
    main()
