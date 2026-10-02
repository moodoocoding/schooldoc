const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', Object.freeze({
  isElectron: true,
  getInfo: () => ipcRenderer.invoke('desktop:info'),
  prepareGoogleOAuth: () => ipcRenderer.invoke('google-oauth:prepare'),
  completeGoogleOAuth: (id, url) => ipcRenderer.invoke('google-oauth:complete', id, url),
  cancelGoogleOAuth: id => ipcRenderer.invoke('google-oauth:cancel', id),
}));
