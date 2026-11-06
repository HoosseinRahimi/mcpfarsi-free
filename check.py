import json
import re
import sys
from pathlib import Path

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("index.html")
h = path.read_text(encoding="utf-8")
kb = round(len(h.encode()) / 1024)
checks = {
    "file": str(path),
    "size KB": kb,
    "external src=": len(re.findall(r"""src\s*=\s*(?:["']?)https?:""", h)),
    "css url(http": len(re.findall(r"""url\(\s*(?:["']?)https?:""", h)),
    "link tag remote": len(re.findall(r"<link[^>]+https?:", h)),
    "script src=": len(re.findall(r"<script[^>]+src=", h)),
    "@import": len(re.findall(r"@import", h)),
    "anchor https (allowed)": len(re.findall(r'href="https://', h)),
    "embedded fonts": len(re.findall(r"data:font/woff2", h)),
    "emoji icons": len(re.findall("[\U0001F300-\U0001FAFF\u2600-\u27BF]", h)),
    "inline style attrs": len(re.findall(r'\sstyle="', h)),
    "hardcoded indigo tells": len(re.findall(r"#6366f1|#4f46e5|#8b5cf6|#a855f7", h, re.I)),
}
for k, v in checks.items():
    print(f"{k:28} {v}")

data = json.loads(re.search(r'<script type="application/json" id="data-catalog">(.*?)</script>', h, re.S).group(1))
copy = json.loads(re.search(r'<script type="application/json" id="data-copy">(.*?)</script>', h, re.S).group(1))
print("servers", len(data["servers"]), "tools", sum(s["tool_count"] for s in data["servers"]),
      "groups", len(data["groups"]))
missing = [s["name"] for s in data["servers"] if s["name"] not in copy["servers"]]
print("servers missing fa copy:", missing or "none")

bad = 0
if checks["external src="] or checks["css url(http"] or checks["link tag remote"]:
    print("FAIL: page is not self-contained")
    bad = 1
if missing:
    print("FAIL: Persian copy missing")
    bad = 1
sys.exit(bad)
