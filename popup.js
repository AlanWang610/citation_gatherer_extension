document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.sync.get(
    {
      downloadUrlPattern: '.*\\.example\\.com/.*',
      openUrlPattern: '',
      saveFolder: 'saved_pages',
      filenamePattern: '{hostname}_{pathname}',
      delay: 3,
      disableReferenceExpansion: false
    },
    (items) => {
      console.log('Loaded settings:', items);
      document.getElementById('downloadUrlPattern').value = items.downloadUrlPattern;
      document.getElementById('openUrlPattern').value = items.openUrlPattern;
      document.getElementById('saveFolder').value = items.saveFolder;
      document.getElementById('filenamePattern').value = items.filenamePattern;
      document.getElementById('delay').value = items.delay;
      document.getElementById('disableReferenceExpansion').checked = items.disableReferenceExpansion;
    }
  );

  // Save settings
  document.getElementById('saveSettings').addEventListener('click', () => {
    const settings = {
      downloadUrlPattern: document.getElementById('downloadUrlPattern').value,
      openUrlPattern: document.getElementById('openUrlPattern').value,
      saveFolder: document.getElementById('saveFolder').value,
      filenamePattern: document.getElementById('filenamePattern').value,
      delay: parseInt(document.getElementById('delay').value, 10),
      disableReferenceExpansion: document.getElementById('disableReferenceExpansion').checked
    };

    // Test if the patterns are valid regex
    try {
      new RegExp(settings.downloadUrlPattern);
      if (settings.openUrlPattern) {
        new RegExp(settings.openUrlPattern);
      }
      console.log('Saving settings:', settings);
      
      chrome.storage.sync.set(settings, () => {
        const status = document.createElement('div');
        status.textContent = 'Settings saved!';
        status.style.color = 'green';
        status.style.marginTop = '10px';
        document.body.appendChild(status);
        setTimeout(() => status.remove(), 2000);
      });
    } catch (e) {
      const status = document.createElement('div');
      status.textContent = 'Invalid URL pattern! Please check your regex syntax.';
      status.style.color = 'red';
      status.style.marginTop = '10px';
      document.body.appendChild(status);
      setTimeout(() => status.remove(), 3000);
      console.error('Invalid regex pattern:', e);
    }
  });
});
