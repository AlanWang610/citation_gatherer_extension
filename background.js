// Function to create a filename from the URL based on the pattern
function createFilename(url, pattern) {
  const urlObj = new URL(url);
  const replacements = {
    '{hostname}': urlObj.hostname.replace(/[^a-z0-9]/gi, '_'),
    '{pathname}': urlObj.pathname.replace(/[^a-z0-9]/gi, '_'),
    '{timestamp}': new Date().toISOString().replace(/[:.]/g, '-')
  };
  
  let filename = pattern;
  for (const [key, value] of Object.entries(replacements)) {
    filename = filename.replace(key, value);
  }
  
  return filename + '.html';
}

// Keep track of the original tab and switching state
let originalTabId = null;
let isSwitchingBack = false;

// Function to handle new tab creation and switching back
chrome.tabs.onCreated.addListener(async (tab) => {
  if (originalTabId && !isSwitchingBack) {
    // Wait a brief moment to ensure the new tab has started loading
    setTimeout(async () => {
      try {
        isSwitchingBack = true;
        // Switch back to the original tab
        await chrome.tabs.update(originalTabId, { active: true });
      } catch (error) {
        console.error('Error switching back to original tab:', error);
      } finally {
        isSwitchingBack = false;
      }
    }, 100);
  }
});

// Listen for tab activation changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!isSwitchingBack) {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab.openerTabId) {
        originalTabId = tab.openerTabId;
      } else {
        // If this is a regular tab activation (not from opening), store this as potential original
        originalTabId = activeInfo.tabId;
      }
    } catch (error) {
      console.error('Error in tab activation handler:', error);
    }
  }
});

// Function to expand references section
async function expandReferences(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      return new Promise((resolve) => {
        let totalAttempts = 0;
        const maxTotalAttempts = 10; // Total number of major attempts
        
        // Function to attempt expanding references
        function attemptExpandReferences() {
          // Find and click the references button
          const refsButton = document.querySelector('div[role="button"][aria-controls*="bibl"][aria-expanded="false"]');
          if (!refsButton) {
            console.log('No references button found');
            if (totalAttempts >= maxTotalAttempts) {
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'References Section Issue',
                message: 'Unable to open references section after multiple attempts. HTML saved without references.'
              });
              resolve(false);
              return;
            }
            
            totalAttempts++;
            console.log(`References button not found, attempt ${totalAttempts}/${maxTotalAttempts}. Retrying in 5 seconds...`);
            setTimeout(attemptExpandReferences, 5000);
            return;
          }

          console.log('Clicking references button');
          refsButton.click();

          // Wait for expanded state
          let checkAttempts = 0;
          const maxCheckAttempts = 10; // Number of checks per attempt
          
          const checkExpanded = setInterval(() => {
            checkAttempts++;
            console.log(`Checking expanded state (check ${checkAttempts}/${maxCheckAttempts} in attempt ${totalAttempts + 1}/${maxTotalAttempts})`);
            
            if (refsButton.getAttribute('aria-expanded') === 'true') {
              console.log('References expanded successfully');
              clearInterval(checkExpanded);
              // Add extra delay to ensure content is loaded
              setTimeout(() => resolve(true), 2000);
            } else if (checkAttempts >= maxCheckAttempts) {
              console.log('Max check attempts reached for this try');
              clearInterval(checkExpanded);
              
              if (totalAttempts >= maxTotalAttempts) {
                console.log('All attempts exhausted');
                chrome.notifications.create({
                  type: 'basic',
                  iconUrl: 'icons/icon48.png',
                  title: 'References Section Issue',
                  message: 'Unable to open references section after multiple attempts. HTML saved without references.'
                });
                resolve(false);
              } else {
                totalAttempts++;
                console.log(`Retrying in 5 seconds... (attempt ${totalAttempts}/${maxTotalAttempts})`);
                setTimeout(attemptExpandReferences, 5000);
              }
            }
          }, 500);
        }

        // Start the first attempt
        attemptExpandReferences();
      });
    }
  });
}

// Function to save HTML content
async function saveHTML(tabId, settings) {
  try {
    // First try to expand references
    const refsExpanded = await expandReferences(tabId);
    
    // Add a small delay if references were expanded
    if (refsExpanded) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Execute script to get HTML content
    const [{result}] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.documentElement.outerHTML
    });

    const url = (await chrome.tabs.get(tabId)).url;
    const filename = createFilename(url, settings.filenamePattern);
    const fullPath = `${settings.saveFolder}/${filename}`;

    // Convert HTML content to data URL
    const htmlBlob = new Blob([result], { type: 'text/html' });
    const reader = new FileReader();
    
    reader.onload = async function() {
      await chrome.downloads.download({
        url: reader.result,
        filename: fullPath,
        saveAs: false
      });
      
      // Show success notification
      if (!refsExpanded) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'HTML Saved',
          message: 'Page saved without references section. You may want to try again.'
        });
      }
    };
    
    reader.readAsDataURL(htmlBlob);
  } catch (error) {
    console.error('Error saving HTML:', error);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Error Saving HTML',
      message: 'An error occurred while saving the page. Please try again.'
    });
  }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.sync.get(
      {
        urlPattern: '.*\\.example\\.com/.*',
        saveFolder: 'saved_pages',
        filenamePattern: '{hostname}_{pathname}',
        delay: 3
      },
      (settings) => {
        const regex = new RegExp(settings.urlPattern);
        if (regex.test(tab.url)) {
          // Wait for specified delay before saving
          setTimeout(() => {
            saveHTML(tabId, settings);
          }, settings.delay * 1000);
        }
      }
    );
  }
});
