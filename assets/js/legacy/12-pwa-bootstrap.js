
(() => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', {scope: './'})
        .catch(err => console.warn('PWA service worker registration failed:', err));
    }, {once:true});
  }
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    if (document.getElementById('nihongo-pwa-install')) return;
    const button = document.createElement('button');
    button.id = 'nihongo-pwa-install';
    button.type = 'button';
    button.textContent = 'Pasang aplikasi';
    button.setAttribute('aria-label', 'Pasang Nihongo Study Deck ke perangkat');
    Object.assign(button.style, {
      position:'fixed', right:'14px', bottom:'14px', zIndex:'99999',
      padding:'12px 16px', border:'0', borderRadius:'999px',
      background:'#2f5d50', color:'#fff', font:'600 14px system-ui,sans-serif',
      boxShadow:'0 4px 16px rgba(0,0,0,.22)', cursor:'pointer'
    });
    button.addEventListener('click', async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      try { await installPrompt.userChoice; } catch (_) {}
      installPrompt = null;
      button.remove();
    });
    document.body.appendChild(button);
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    document.getElementById('nihongo-pwa-install')?.remove();
  });
})();
