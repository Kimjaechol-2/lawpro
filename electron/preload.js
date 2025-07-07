const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),

  // Menu events
  onMenuNewNotebook: (callback) => ipcRenderer.on('menu-new-notebook', callback),
  onMenuOpenFiles: (callback) => ipcRenderer.on('menu-open-files', callback),
  onMenuExport: (callback) => ipcRenderer.on('menu-export', callback),
  onFileDropped: (callback) => ipcRenderer.on('file-dropped', callback),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // Platform info
  platform: process.platform,
  isElectron: true,

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // File system operations (for desktop app specific features)
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),

  // Notification support
  showNotification: (title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  },

  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),

  // Theme
  setTheme: (theme) => ipcRenderer.send('set-theme', theme),
  getTheme: () => ipcRenderer.invoke('get-theme'),
});

// Add runtime flag for Electron
window.isElectron = true;

// Handle theme changes
ipcRenderer.on('theme-changed', (event, theme) => {
  document.body.setAttribute('data-theme', theme);
});

// Initialize theme on load
window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.invoke('get-theme').then(theme => {
    if (theme) {
      document.body.setAttribute('data-theme', theme);
    }
  });
});
