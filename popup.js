document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.sync.get(
    {
      urlPattern: '.*\\.example\\.com/.*',
      saveFolder: 'saved_pages',
      filenamePattern: '{hostname}_{pathname}',
      delay: 3
    },
    (items) => {
      document.getElementById('urlPattern').value = items.urlPattern;
      document.getElementById('saveFolder').value = items.saveFolder;
      document.getElementById('filenamePattern').value = items.filenamePattern;
      document.getElementById('delay').value = items.delay;
    }
  );

  // Save settings
  document.getElementById('saveSettings').addEventListener('click', () => {
    const settings = {
      urlPattern: document.getElementById('urlPattern').value,
      saveFolder: document.getElementById('saveFolder').value,
      filenamePattern: document.getElementById('filenamePattern').value,
      delay: parseInt(document.getElementById('delay').value, 10)
    };

    chrome.storage.sync.set(settings, () => {
      const status = document.createElement('div');
      status.textContent = 'Settings saved!';
      status.style.color = 'green';
      status.style.marginTop = '10px';
      document.body.appendChild(status);
      setTimeout(() => status.remove(), 2000);
    });
  });
});
