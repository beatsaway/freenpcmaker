# Free NPC Maker

Procedurally generate a full character in one place: mesh, texture, rig, and animation. Great for indie projects.

## Run

**Everyday (lean, no npm):** double-click `start.bat`  
Needs [Python 3](https://www.python.org/) and internet once (Three.js CDN). Opens http://127.0.0.1:8770/

**Vite / Node workflow:** double-click `start-vite.bat`  
```bash
npm install
npm run dev
```

## Deploy (Netlify)

Connect the GitHub repo — `netlify.toml` builds with `npm run build` and publishes `dist/` (root `index.html`).

## Credits

- Human rig and animation library from [Mesh2Motion](https://mesh2motion.org/) ([mesh2motion-app](https://github.com/Mesh2Motion/mesh2motion-app))
- Developed by Beats Away — [support this project](https://buymeacoffee.com/beatsaway)
