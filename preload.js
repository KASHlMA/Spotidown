const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getMusicDir:      ()        => ipcRenderer.invoke('get-music-dir'),
  loadCache:        ()        => ipcRenderer.invoke('load-cache'),
  saveCache:        (cache)   => ipcRenderer.invoke('save-cache', cache),
  scanMusic:        ()        => ipcRenderer.invoke('scan-music'),
  readMeta:         (path)    => ipcRenderer.invoke('read-meta', path),
  winClose:         ()        => ipcRenderer.send('win-close'),
  winMinimize:      ()        => ipcRenderer.send('win-minimize'),
  winMaximize:      ()        => ipcRenderer.send('win-maximize'),
  onLibraryChanged: (cb)      => ipcRenderer.on('library-changed', cb),
})
