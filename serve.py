"""
Plain localhost server for Free NPC Maker (no Vite required).
Maps /animations and /rigs from ./static like Vite publicDir.
"""
from __future__ import annotations

import mimetypes
import os
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
PORT = int(os.environ.get("PORT", "8770"))

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("application/wasm", ".wasm")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def translate_path(self, path: str) -> str:
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if clean.startswith("/animations/") or clean.startswith("/rigs/"):
            return str(STATIC / clean.lstrip("/").replace("/", os.sep))
        return super().translate_path(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Free NPC Maker — http://127.0.0.1:{PORT}/")
    print("Ctrl+C to stop.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
