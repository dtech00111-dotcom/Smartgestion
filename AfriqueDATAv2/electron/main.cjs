/**
 * Smart Gestion — fenêtre Electron + serveur Express intégré (backend + build React).
 */
const { app, BrowserWindow, Menu, shell, dialog, nativeImage, powerSaveBlocker } = require('electron');
const path = require('path');
const fs = require('fs');

// Évite que Chromium fige le rendu quand la fenêtre est réduite ou qu’une autre app est au premier plan.
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows', 'true');
app.commandLine.appendSwitch('disable-renderer-backgrounding', 'true');
app.commandLine.appendSwitch('disable-background-timer-throttling', 'true');
// Windows : sans ceci, Chromium peut considérer la fenêtre comme « occluse » et geler le compositeur.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
}

const pkg = require('./package.json');
const PORT = Number(process.env.SMARTGESTION_PORT) || 17892;

let mainWindow;
let httpServer;
/** Identifiants powerSaveBlocker — évite suspension app + veille écran (borne / salle). */
let powerSaveBlockerIds = [];

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
  const js = `(function(){
    try {
      requestAnimationFrame(function(){
        window.dispatchEvent(new Event('resize'));
        var b = document.body;
        if (b) {
          b.style.transform = 'translateZ(0)';
          requestAnimationFrame(function(){
            b.style.transform = '';
            window.dispatchEvent(new Event('resize'));
          });
        }
        if (document.documentElement) {
          document.documentElement.style.outline = '1px solid transparent';
          requestAnimationFrame(function(){
            document.documentElement.style.outline = '';
          });
        }
      });
    } catch (e) {}
  })();`;
  win.webContents.executeJavaScript(js).catch(() => {});
}

function scheduleResumeRepaint(win) {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  try {
    win.webContents.setBackgroundThrottling(false);
  } catch (_) {
    /* API absente sur très vieilles versions Electron */
  }
  [0, 60, 200, 500].forEach((ms) => setTimeout(() => triggerRendererRepaint(win), ms));
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

  win.webContents.on('did-finish-load', () => {
    try {
      win.webContents.setBackgroundThrottling(false);
    } catch (_) {}
  });

  // Réduction, retour barre des tâches, ou autre app au premier plan puis focus : réveiller le rendu.
  let resumeDebounce = null;
  function onResume() {
    clearTimeout(resumeDebounce);
    resumeDebounce = setTimeout(() => scheduleResumeRepaint(win), 40);
  }
  win.on('restore', onResume);
  win.on('show', onResume);
  win.on('focus', onResume);

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

  try {
    powerSaveBlockerIds = [
      powerSaveBlocker.start('prevent-app-suspension'),
      powerSaveBlocker.start('prevent-display-sleep'),
    ];
  } catch (e) {
    console.warn('powerSaveBlocker:', e);
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
  powerSaveBlockerIds.forEach((id) => {
    try {
      if (powerSaveBlocker.isStarted(id)) powerSaveBlocker.stop(id);
    } catch (_) {}
  });
  powerSaveBlockerIds = [];
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
});
