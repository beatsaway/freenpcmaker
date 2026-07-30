# Free NPC Maker

Version hub — pick a build from the launch page.

| Folder | Version | Notes |
|--------|---------|--------|
| `v1.01/` | **latest** | Current build (face seating, neck join, skull-safe hair) |
| `v1.0/` | classic | Original push release |

## Run

```bat
start.bat
```

Opens http://127.0.0.1:8770/ — tap a version to start.

Each version folder also has its own `start.bat` if you want to run one alone.

## Deploy (Netlify)

Linked to this repo. Root `netlify.toml` publishes the hub as **static** (no `npm run build`).

If a deploy still fails after a restructure, in Netlify → Site settings → Build & deploy:

- **Base directory:** empty (repo root)
- **Build command:** leave blank / use `netlify.toml`
- **Publish directory:** `.` (or clear so `netlify.toml` wins)
- Turn off any old SPA `/* → /index.html` redirect that would swallow `/v1.01/`
