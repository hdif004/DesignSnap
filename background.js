// background.js — Service worker MV3
// Seul contexte autorisé à appeler chrome.downloads

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== 'download') return false;

  chrome.downloads.download(
    {
      url:            message.url,
      filename:       message.filename || undefined,
      saveAs:         message.saveAs  || false,
      conflictAction: 'uniquify',   // évite d'écraser les fichiers existants
    },
    downloadId => {
      const err = chrome.runtime.lastError;
      sendResponse({ success: !err, downloadId, error: err?.message });
    }
  );

  return true; // canal ouvert pour la réponse asynchrone
});
