const express = require('express');
const path = require('path');
const fs = require('fs');

/**
 * @param {string | null} staticDir - Dossier du build React (index.html). Si null, API seule.
 */
function createApp(staticDir) {
  const app = express();
  app.use(express.json());

  app.get('/api', (req, res) => {
    res.json({ message: 'API prête' });
  });

  const hasSpa =
    staticDir &&
    fs.existsSync(staticDir) &&
    fs.existsSync(path.join(staticDir, 'index.html'));

  if (hasSpa) {
    app.use(express.static(staticDir));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.json({ message: 'API prête (build frontend absent — lancez npm run build dans frontend/)' });
    });
  }

  return app;
}

const defaultStatic = path.join(__dirname, '..', 'frontend', 'build');
const staticForCli = fs.existsSync(path.join(defaultStatic, 'index.html')) ? defaultStatic : null;
const app = createApp(staticForCli);

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    if (!staticForCli) {
      console.log('Astuce : construisez le frontend (npm run build) pour servir l’interface sur ce port.');
    }
  });
}

module.exports = { createApp, app };
