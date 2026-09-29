const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  startGoogleOAuth: (authUrl) => ipcRenderer.invoke('google-oauth:start', authUrl),
});
