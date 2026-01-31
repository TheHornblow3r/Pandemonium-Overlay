const { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu } = require('electron');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { dialog, shell } = require('electron');
const CURRENT_VERSION = app.getVersion();
const RELEASES_URL = 'https://api.github.com/repos/TheHornblow3r/Pandemonium-Overlay/releases/latest';


app.commandLine.appendSwitch('disable-overlay-scrollbar');

// --------------------
// STATE
// --------------------
let win = null;
let corruptionWin = null;
let runewordWin = null;
let craftingWin;
let visible = false;
let isCondensedMode = false;
let condensed = true;
let normalRuneWindowHeight = null;
let breakpointWin = null;
let tray = null;
let isQuitting = false;
let splashWin;
let splashStartTime = 0;

function createSplashWindow() {
  splashStartTime = Date.now();

  splashWin = new BrowserWindow({
    width: 420,
    height: 260,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  splashWin.loadFile('splash.html');

  splashWin.once('ready-to-show', () => {
    splashWin.show();

      splashWin.webContents.send(
      'splash-version',
      app.getVersion()
    );  
  });
}
// --------------------
// CONFIG
// --------------------
const WIDTH = 300;
const HEIGHT = 500;
const CORRUPTION_WIDTH = 1000;
const CORRUPTION_HEIGHT = 650;
const RUNEWORDS_WIDTH = 1300;
const RUNEWORDS_HEIGHT = 600;
const RUNE_DATA_URL = 'https://raw.githubusercontent.com/TheHornblow3r/Pandemonium-Overlay/main/data/rune-prices.json';

async function loadRunePrices() {
  try {
    const res = await fetch(RUNE_DATA_URL);
    if (!res.ok) throw new Error('Failed to fetch rune prices');
    return await res.json();
  } catch (err) {
    console.error('Rune price load failed:', err.message);
    return {};
  }
}


let POS_FILE;
let CORRUPTION_POS_FILE;

// --------------------
// HELPERS
// --------------------
function loadPosition(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

function savePosition(win, file) {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  fs.writeFileSync(file, JSON.stringify({ x, y }));
}

function shutdownApp() {
  isQuitting = true;

  // 1. Unregister hotkeys
  globalShortcut.unregisterAll();

  // 2. Destroy ALL windows explicitly
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(win => {
    try {
      win.destroy();
    } catch {}
  });

  // 3. Force exit
  app.exit(0);
}
// Updater
async function checkForUpdates() {
  try {
    const res = await fetch(RELEASES_URL);
    const data = await res.json();

    if (!data.tag_name) return;

    const latest = data.tag_name.replace(/^v/, '');

    if (latest !== CURRENT_VERSION) {
      dialog.showMessageBox({
        type: 'info',
        buttons: ['Download', 'Later'],
        defaultId: 0,
        message: `New version available: v${latest}`,
        detail: `You are running v${CURRENT_VERSION}.`
      }).then(result => {
        if (result.response === 0) {
          shell.openExternal(data.html_url);
        }
      });
    }
  } catch (err) {
    console.log('Update check failed:', err.message);
  }
}

// --------------------
// RUNE WINDOW
// --------------------
function createMainWindow() {
  const savedPos = loadPosition(POS_FILE);

  win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x: savedPos?.x,
    y: savedPos?.y,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  normalRuneWindowHeight = 420;

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setFocusable(false);

  win.loadFile('index.html');
  
  win.webContents.on('did-finish-load', async () => {
  const runePrices = await loadRunePrices();

win.webContents.send('rune-data', runePrices);


});

  win.hide();
}

// --------------------
// CORRUPTIONS WINDOW
// --------------------
function createCorruptionWindow() {
  const savedPos = loadPosition(CORRUPTION_POS_FILE);

  corruptionWin = new BrowserWindow({
    width: CORRUPTION_WIDTH,
    height: CORRUPTION_HEIGHT,
    x: savedPos?.x,
    y: savedPos?.y,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  corruptionWin.setAlwaysOnTop(true, 'screen-saver');
  corruptionWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  corruptionWin.setFocusable(false);

  corruptionWin.loadFile('corruptions.html');
  corruptionWin.hide();

  corruptionWin.on('move', () =>
    savePosition(corruptionWin, CORRUPTION_POS_FILE)
  );
}

// --------------------
// RUNEWORDS WINDOW
// --------------------
function createRunewordWindow() {
  runewordWin = new BrowserWindow({
    width: RUNEWORDS_WIDTH,
    height: RUNEWORDS_HEIGHT,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  runewordWin.setAlwaysOnTop(true, 'screen-saver');
  runewordWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  runewordWin.loadFile('runewords.html');
  runewordWin.hide();

  runewordWin.on('close', (e) => {
    e.preventDefault();
    runewordWin.hide();
  });
}
// --------------------
// CRAFTING WINDOW
// --------------------
function createCraftingWindow() {
  craftingWin = new BrowserWindow({
    width: 900,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  craftingWin.setAlwaysOnTop(true, 'screen-saver');
  craftingWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  craftingWin.loadFile('crafting.html');
}
// --------------------
// BREAKPOINTS WINDOW
// --------------------

function createBreakpointWindow() {
  if (breakpointWin) {
    breakpointWin.isVisible()
      ? breakpointWin.hide()
      : breakpointWin.showInactive();
    return;
  }

  breakpointWin = new BrowserWindow({
    width: 360,
    height: 420,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  breakpointWin.setAlwaysOnTop(true, 'screen-saver');
  breakpointWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  breakpointWin.loadFile('breakpoints.html');

  breakpointWin.on('closed', () => {
    breakpointWin = null;
  });
}
// --------------------
// CREATE TRAY
// --------------------
function createTray() {
  if (tray) return;

  tray = new Tray(path.join(__dirname, 'assets/icon.ico'));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show All Overlays',
      click: () => {
        const windows = [
          win,
          corruptionWin,
          runewordWin,
          craftingWin,
          breakpointWin
        ];

        windows.forEach(w => {
          if (w && !w.isVisible()) {
            w.showInactive();
          }
        });
      }
    },
    { type: 'separator' },
{
  label: 'Close Overlay',
  click: () => {
    shutdownApp();
  }
}
  ]);

  tray.setToolTip('Pandemonium Overlay');
  tray.setContextMenu(contextMenu);
}

// --------------------
// APP READY
// --------------------

app.whenReady().then(async () => {
  // 🔹 SHOW SPLASH IMMEDIATELY
  createSplashWindow();

  POS_FILE = path.join(app.getPath('userData'), 'overlay-position.json');
  CORRUPTION_POS_FILE = path.join(
    app.getPath('userData'),
    'corruption-position.json'
  );

  // 🔹 CREATE WINDOWS + TRAY
  createMainWindow();
  createCorruptionWindow();
  createRunewordWindow();
  createCraftingWindow();
  createTray();

  checkForUpdates();

  // Close splash when main UI is ready
win.webContents.once('did-finish-load', () => {
  const MIN_SPLASH_TIME = 2000;
  const elapsed = Date.now() - splashStartTime;

  const closeSplash = () => {
    if (splashWin) {
      splashWin.close();
      splashWin = null;
    }
  };

  if (elapsed >= MIN_SPLASH_TIME) {
    closeSplash();
  } else {
    setTimeout(closeSplash, MIN_SPLASH_TIME - elapsed);
  }

  win.webContents.send('condensed-state', condensed);
});





// --------------------
// HOTKEYS
// --------------------

  // RUNE PRICE HOTKEY
  globalShortcut.register('Control+Shift+D', () => {
    visible ? win.hide() : win.showInactive();
    visible = !visible;
  });

  // CRAFTING HOTKEY
  globalShortcut.register('Control+Shift+V', () => {
  if (!craftingWin) return;

  if (craftingWin.isVisible()) {
    craftingWin.hide();
  } else {
    craftingWin.show();
  }
  });
  // CONDENSED HOTKEY
  globalShortcut.register('Control+Shift+K', () => {
    condensed = !condensed;
    win.webContents.send('condensed-state', condensed);
  });

  // CORRUPTIONS HOTKEY
  globalShortcut.register('Control+Shift+C', () => {
    if (corruptionWin.isVisible()) corruptionWin.hide();
    else corruptionWin.showInactive();
  });

  // RUNWORDS HOTKEY
  globalShortcut.register('Control+Shift+R', () => {
    if (runewordWin.isVisible()) runewordWin.hide();
    else runewordWin.showInactive();
  });
  // BREAKPOINTS HOTKEY
  globalShortcut.register('Control+Shift+B', () => {
  createBreakpointWindow();
});

// Hide all
let allHidden = false;

globalShortcut.register('Control+Shift+H', () => {
  const windows = [
    win,              // rune overlay
    corruptionWin,
    runewordWin,
    craftingWin,
    breakpointWin
  ];

  if (!allHidden) {
    // HIDE only visible windows
    windows.forEach(w => {
      if (w && w.isVisible()) {
        w.hide();
      }
    });
    allHidden = true;
  } else {
    // SHOW only windows that are currently hidden
    windows.forEach(w => {
      if (w && !w.isVisible()) {
        w.showInactive(); // 👈 no focus, no flicker
      }
    });
    allHidden = false;
  }
});

ipcMain.on('close-current-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.hide(); // preferred for overlays
});


});

// --------------------
// CLEANUP
// --------------------
app.on('window-all-closed', (e) => {
  if (!isQuitting) {
    e.preventDefault(); // keep tray alive
  }
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
