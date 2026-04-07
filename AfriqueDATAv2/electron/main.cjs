/**
 * Smart Gestion — fenêtre Electron + serveur Express intégré (backend + build React).
 */
const { app, BrowserWindow, Menu, shell, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// Évite que Chromium fige l’onglet / le rendu quand la fenêtre est réduite (spinner infini au retour).
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows', 'true');
app.commandLine.appendSwitch('disable-renderer-backgrounding', 'true');

const pkg = require('./package.json');
const PORT = Number(process.env.SMARTGESTION_PORT) || 17892;

let mainWindow;
let httpServer;

function backendRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend');
  }
  return path.join(__dirname, '..', 'backend');
}

function staticRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'frontend-build');
  }
  return path.join(__dirname, '..', 'frontend', 'build');
}

/** Logo plateforme (même fichier que le portail / favicon). */
function resolveIconPath() {
  const packaged = path.join(process.resourcesPath, 'logo-salle-numerique.png');
  const dev = path.join(__dirname, '..', 'frontend', 'public', 'logo-salle-numerique.png');
  const p = app.isPackaged ? packaged : dev;
  return fs.existsSync(p) ? p : undefined;
}

function windowIcon() {
  const p = resolveIconPath();
  if (!p) return undefined;
  try {
    return nativeImage.createFromPath(p);
  } catch {
    return undefined;
  }
}

function triggerRendererRepaint(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents
    .executeJavaScript(
      `requestAnimationFrame(function(){
        window.dispatchEvent(new Event('resize'));
        document.body && (document.body.style.opacity='0.9999');
        requestAnimationFrame(function(){ document.body && (document.body.style.opacity=''); });
      });`
    )
    .catch(() => {});
}

function createBrowser() {
  const win = new BrowserWindow({
    width: 1366,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    icon: windowIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
    title: `Smart Gestion v${pkg.version}`,
  });

  win.once('ready-to-show', () => win.show());
  win.loadURL(`http://127.0.0.1:${PORT}/`);

  // Après réduction / retour sur l’app : forcer un repaint (corrige écran figé ou loader infini côté GPU).
  const onResume = () => {
    if (win.isMinimized()) return;
    setTimeout(() => triggerRendererRepaint(win), 50);
  };
  win.on('restore', onResume);
  win.on('show', onResume);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

function buildMenu() {
  return Menu.buildFromTemplate([
    { label: 'Fichier', submenu: [{ role: 'quit', label: 'Quitter' }] },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Actualiser' },
        { role: 'toggleDevTools', label: 'Outils de développement' },
      ],
    },
    { label: 'Aide', submenu: [{ label: `Version ${pkg.version}`, enabled: false }] },
  ]);
}

async function startExpress() {
  const back = backendRoot();
  const stat = staticRoot();
  const indexHtml = path.join(stat, 'index.html');

  if (!fs.existsSync(indexHtml)) {
    const msg =
      'Build React introuvable.\n\n' +
      'Exécutez depuis le dossier electron :\n' +
      '  npm run build:frontend\n\n' +
      `Chemin attendu : ${indexHtml}`;
    dialog.showErrorBox('Smart Gestion', msg);
    throw new Error(msg);
  }

  const indexJs = path.join(back, 'index.js');
  if (!fs.existsSync(indexJs)) {
    dialog.showErrorBox('Smart Gestion', `Backend introuvable : ${indexJs}`);
    throw new Error('Backend manquant');
  }

  // Résolution de express depuis backend/node_modules
  const { createApp } = require(indexJs);
  const expressApp = createApp(stat);

  return new Promise((resolve, reject) => {
    try {
      const srv = expressApp.listen(PORT, '127.0.0.1', () => resolve(srv));
      srv.on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}

app.whenReady().then(async () => {
  try {
    httpServer = await startExpress();
  } catch (e) {
    console.error(e);
    app.quit();
    return;
  }

  Menu.setApplicationMenu(buildMenu());
  mainWindow = createBrowser();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createBrowser();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
});
