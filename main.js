const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

// Application icon, loaded once and reused for the window/title bar.
const appIcon = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png'));

let mainWindow;

// Set to true once the user has confirmed closing the window (unsaved changes
// have been handled), so the close event is allowed to proceed.
let allowClose = false;

// File path passed by the OS (file association / "Open with") to open at launch.
let pendingOpenFilePath = null;

// Update notification settings.
// UPDATE_INFO_URL must return JSON like: { "version": "1.0.1", "url": "<download page>" }
// DOWNLOAD_PAGE_URL is opened in the browser when the user chooses to download.
const UPDATE_INFO_URL = 'https://USER.gitlab.io/REPO/latest.json';
const DOWNLOAD_PAGE_URL = 'https://gitlab.com/USER/REPO/-/releases';

// Download page for the most recent detected update (set when one is found).
let updateDownloadUrl = DOWNLOAD_PAGE_URL;

// Path of the JSON file used to remember which files were open.
const sessionFilePath = path.join(app.getPath('userData'), 'session.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    icon: appIcon,
    title: 'Markdown Editor ' + app.getVersion(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  // Intercept window close: let the renderer handle unsaved changes first.
  mainWindow.on('close', (event) => {
    if (allowClose) return;
    event.preventDefault();
    mainWindow.webContents.send('app-close-request');
  });
}

// Find a Markdown file path among the given command line arguments.
function getFileFromArgs(argv) {
  const candidate = argv.find(
    (arg) => /\.(md|markdown|txt)$/i.test(arg) && fs.existsSync(arg)
  );
  return candidate || null;
}

// Read a file and push it to the renderer to be opened in a new tab.
function sendOpenFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('open-external-file', { filePath, content });
    }
  } catch (error) {
    // Ignore unreadable files.
  }
}

// Ensure a single running instance so file-association launches reuse the
// existing window instead of starting a second copy.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

// A second launch (e.g. opening a .md from the file manager) forwards its
// arguments here; open that file in the existing window.
app.on('second-instance', (event, argv) => {
  const filePath = getFileFromArgs(argv);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    if (filePath) sendOpenFile(filePath);
  }
});

// macOS delivers file-open requests through this event.
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) {
    sendOpenFile(filePath);
  } else {
    pendingOpenFilePath = filePath;
  }
});

app.whenReady().then(() => {
  // Ensure Windows uses the app icon (and groups it) in the taskbar.
  app.setAppUserModelId('net.spsproject.markdowneditor');

  // Remove the native "File Edit View" application menu bar.
  Menu.setApplicationMenu(null);

  // On Windows/Linux the file path arrives as a command line argument.
  if (!pendingOpenFilePath) {
    pendingOpenFilePath = getFileFromArgs(process.argv);
  }

  createWindow();

  // Silently check for a newer version in the background at startup.
  checkForUpdate(false);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Compare two "x.y.z" version strings. Returns true when `remote` is newer.
function isNewerVersion(remote, current) {
  const remoteParts = remote.split('.').map((part) => parseInt(part, 10) || 0);
  const currentParts = current.split('.').map((part) => parseInt(part, 10) || 0);

  for (let i = 0; i < Math.max(remoteParts.length, currentParts.length); i++) {
    const a = remoteParts[i] || 0;
    const b = currentParts[i] || 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

// Check the remote version. If newer, ask the user and open the download page.
// When isManual is false, failures and the "up to date" case are silent.
async function checkForUpdate(isManual) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(UPDATE_INFO_URL, {
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const info = await response.json();
    const latestVersion = String(info.version || '').trim();
    if (!latestVersion) throw new Error('Missing version field');

    if (isNewerVersion(latestVersion, app.getVersion())) {
      // Remember the download page and reveal the "Update" menu item in the UI.
      updateDownloadUrl = info.url || DOWNLOAD_PAGE_URL;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', {
          version: latestVersion,
          url: updateDownloadUrl
        });
      }
    } else if (isManual) {
      await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Updates',
        message: 'Markdown Editor',
        detail: 'You are using the latest version (' + app.getVersion() + ').'
      });
    }
  } catch (error) {
    if (isManual) {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Updates',
        message: 'Could not check for updates.',
        detail: String(error && error.message ? error.message : error)
      });
    }
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Open a file picker (multiple selection allowed) and return the
// path and content of every chosen file as an array of objects.
ipcMain.handle('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Markdown file',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    properties: ['openFile', 'multiSelections']
  });

  if (canceled || filePaths.length === 0) return [];

  return filePaths.map((filePath) => ({
    filePath,
    content: fs.readFileSync(filePath, 'utf-8')
  }));
});

// Read a single file given an explicit path (used by the path input field).
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { filePath, content };
  } catch (error) {
    return { error: error.message };
  }
});

// Save (overwrite) the original Markdown file.
ipcMain.handle('save-file', async (event, { filePath, content }) => {
  if (!filePath) return { error: 'No file is open to save.' };
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { ok: true };
  } catch (error) {
    return { error: error.message };
  }
});

// Trigger the native print dialog for the current preview.
ipcMain.handle('print', async () => {
  mainWindow.webContents.print({ silent: false, printBackground: true });
});

// Export the current preview to a PDF file chosen by the user.
// printToPDF renders with the print stylesheet, so only the preview is included.
ipcMain.handle('export-pdf', async (event, suggestedName) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export to PDF',
    defaultPath: suggestedName || 'document.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });

  if (canceled || !filePath) return { canceled: true };

  try {
    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'default' }
    });
    fs.writeFileSync(filePath, pdfData);
    return { ok: true, filePath };
  } catch (error) {
    return { error: error.message };
  }
});

// Open a file dialog filtered by media type and return the chosen path.
ipcMain.handle('pick-media', async (event, mediaType) => {
  const filtersByType = {
    image: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    icon: [{ name: 'Icons', extensions: ['svg', 'ico', 'png'] }],
    video: [{ name: 'Videos', extensions: ['mp4', 'webm', 'ogg', 'mov'] }]
  };

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select media',
    filters: filtersByType[mediaType] || [],
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

// Show the native "About" information dialog.
ipcMain.handle('show-about', async () => {
  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About',
    message: 'Markdown Editor',
    detail: 'Version ' + app.getVersion() + '\nA minimal Markdown editor built with Electron.'
  });
});

// Open the download page for the available update in the system browser.
ipcMain.handle('open-download', async () => {
  await shell.openExternal(updateDownloadUrl || DOWNLOAD_PAGE_URL);
});

// Return the application version, shown in the status bar.
ipcMain.handle('get-version', () => app.getVersion());

// Return the file passed by the OS at launch (file association), if any.
ipcMain.handle('get-launch-file', async () => {
  if (!pendingOpenFilePath) return null;
  const filePath = pendingOpenFilePath;
  pendingOpenFilePath = null;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { filePath, content };
  } catch (error) {
    return null;
  }
});

// Ask the user whether to save changes before closing a modified file.
// Returns 'save', 'dont-save' or 'cancel'.
ipcMain.handle('confirm-save', async (event, fileName) => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Unsaved changes',
    message: 'Save changes to ' + fileName + '?',
    detail: 'Your changes will be lost if you do not save them.',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2
  });
  return ['save', 'dont-save', 'cancel'][response];
});

// The renderer has handled unsaved changes: allow the window to close.
ipcMain.handle('confirm-close', () => {
  allowClose = true;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});

// Load the previous session, dropping any file that no longer exists on disk.
ipcMain.handle('load-session', async () => {
  try {
    const rawSession = fs.readFileSync(sessionFilePath, 'utf-8');
    const session = JSON.parse(rawSession);
    const storedTabs = Array.isArray(session.tabs) ? session.tabs : [];

    const existingTabs = storedTabs.filter(
      (tab) => tab.filePath && fs.existsSync(tab.filePath)
    );

    let activeTabIndex =
      typeof session.activeTabIndex === 'number' ? session.activeTabIndex : 0;
    if (activeTabIndex >= existingTabs.length) {
      activeTabIndex = existingTabs.length - 1;
    }

    return { tabs: existingTabs, activeTabIndex };
  } catch (error) {
    // No session file yet, or it is unreadable: start with an empty session.
    return { tabs: [], activeTabIndex: -1 };
  }
});

// Persist the current session (list of open files and the active one).
ipcMain.handle('save-session', async (event, session) => {
  try {
    fs.writeFileSync(sessionFilePath, JSON.stringify(session, null, 2), 'utf-8');
    return { ok: true };
  } catch (error) {
    return { error: error.message };
  }
});
