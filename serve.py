"""
Hub server for Free NPC Maker — launch page + versioned apps (v1.0 / v1.01).
Maps /animations and /rigs from each version's ./static (Vite publicDir convention).
"""
from __future__ import annotations

import mimetypes
import os
import re
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "8770"))
VERSIONS = ("v1.0", "v1.01")

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("application/wasm", ".wasm")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _version_from_referer(self) -> str | None:
        ref = self.headers.get("Referer", "") or ""
        for v in VERSIONS:
            if f"/{v}/" in ref or ref.rstrip("/").endswith(f"/{v}"):
                return v
        return None

    def translate_path(self, path: str) -> str:
        clean = unquote(path.split("?", 1)[0].split("#", 1)[0])

        m = re.match(r"^/(v1\.0|v1\.01)(/.*)?$", clean)
        if m:
            ver = m.group(1)
            rest = (m.group(2) or "/").lstrip("/")
            if rest == "" or rest.endswith("/"):
                # /v1.0 or /v1.0/ → index.html
                candidate = ROOT / ver / "index.html"
                if candidate.is_file():
                    return str(candidate)
            if rest.startswith("animations/") or rest.startswith("rigs/"):
                return str(ROOT / ver / "static" / rest.replace("/", os.sep))
            target = (ROOT / ver / rest.replace("/", os.sep)).resolve()
            # Stay inside the version folder
            if not str(target).startswith(str((ROOT / ver).resolve())):
                return str(ROOT / ver / "index.html")
            return str(target)

        if clean.startswith("/animations/") or clean.startswith("/rigs/"):
            ver = self._version_from_referer() or "v1.01"
            return str(ROOT / ver / "static" / clean.lstrip("/").replace("/", os.sep))

        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Free NPC Maker — http://127.0.0.1:{PORT}/")
    print("  v1.01 (latest) · v1.0")
    print("Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
