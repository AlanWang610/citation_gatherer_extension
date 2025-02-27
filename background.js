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
        
        // Function to find references button
        function findReferencesButton() {
          // Try different selectors in order of specificity
          const selectors = [
            // Original specific selector
            'div[role="button"][aria-controls*="bibl"][aria-expanded="false"]',
            // More general selectors for different variations
            'div[role="button"][aria-controls*="idss"][aria-expanded="false"]',
            'div.accordion__control[role="button"][aria-expanded="false"]',
            // Most general selector - look for any button with references title
            'div[role="button"][aria-expanded="false"] .section__title[id*="references-section"]'
          ];

          for (const selector of selectors) {
            const button = document.querySelector(selector);
            if (button) {
              // If we found the button through the title, return the parent button element
              return selector.includes('section__title') ? button.closest('[role="button"]') : button;
            }
          }
          return null;
        }
        
        // Function to attempt expanding references
        function attemptExpandReferences() {
          // Find and click the references button
          const refsButton = findReferencesButton();
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

// Function to check if page is a verification page
async function isVerificationPage(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const pageText = document.body.innerText.toLowerCase();
        const verificationPhrases = [
          'verifying you are human',
          'please verify you are human',
          'human verification',
          'captcha',
          'are you a robot',
          'prove you are human',
          'verification successful',
          'verification complete',
          'you have been verified',
          'thank you for verifying'
        ];
        return verificationPhrases.some(phrase => pageText.includes(phrase.toLowerCase()));
      }
    });
    return result.result;
  } catch (error) {
    console.error('Error checking for verification page:', error);
    return false;
  }
}

// Function to save HTML content
async function saveHTML(tabId, settings) {
  try {
    // Check if it's a verification page
    const isVerifying = await isVerificationPage(tabId);
    if (isVerifying) {
      console.log('Verification page detected, waiting for user interaction...');
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Human Verification Required',
        message: 'Please complete the verification on the page. The download will start automatically afterward.'
      });

      // Set up a listener for page changes
      const waitForVerification = new Promise((resolve) => {
        const listener = async (changedTabId, changeInfo, tab) => {
          if (changedTabId === tabId && changeInfo.status === 'complete') {
            // Check again after page update
            const stillVerifying = await isVerificationPage(tabId);
            if (!stillVerifying) {
              chrome.tabs.onUpdated.removeListener(listener);
              // Wait an additional 5 seconds after verification is complete
              // to ensure we're past any verification success pages
              setTimeout(resolve, 5000);
            }
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });

      // Wait for verification to complete
      await waitForVerification;
      
      // Check one more time to make sure we're not on a verification success page
      const finalCheck = await isVerificationPage(tabId);
      if (finalCheck) {
        console.log('Still on verification page after delay, aborting save...');
        return;
      }
      
      console.log('Verification completed, proceeding with save...');
    }

    // First try to expand references if enabled
    if (!settings.disableReferenceExpansion) {
      const expanded = await expandReferences(tabId);
      if (!expanded) {
        console.log('References expansion failed or was not possible');
      }
    }

    // Get tab URL first
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url;

    // Get the HTML content
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.documentElement.outerHTML
    });

    const filename = createFilename(url, settings.filenamePattern);
    const fullPath = `${settings.saveFolder}/${filename}`;

    // Convert HTML content to data URL
    const htmlBlob = new Blob([result.result], { type: 'text/html' });
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async function() {
        try {
          await chrome.downloads.download({
            url: reader.result,
            filename: fullPath,
            saveAs: false
          });
          
          // Show success notification if references weren't expanded
          if (settings.disableReferenceExpansion) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon48.png',
              title: 'HTML Saved',
              message: 'Page saved successfully.'
            });
          }

          // Close the tab after successful download
          try {
            await chrome.tabs.remove(tabId);
          } catch (closeError) {
            console.error('Error closing tab:', closeError);
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(htmlBlob);
    });
  } catch (error) {
    console.error('Error saving HTML:', error);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Error Saving HTML',
      message: 'An error occurred while saving the page. Please try again.'
    });
    throw error;
  }
}

// Function to find and open matching links
async function openMatchingLinks(tabId, settings) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (downloadPattern) => {
        const regex = new RegExp(downloadPattern);
        const links = Array.from(document.querySelectorAll('a[href]'));
        const matchingLinks = links
          .map(link => link.href)
          .filter(href => 
            regex.test(href) && 
            !href.includes('supplementary-data') // Exclude supplementary data links
          );
        return [...new Set(matchingLinks)]; // Remove duplicates
      },
      args: [settings.downloadUrlPattern]
    });

    const uniqueLinks = result.result;
    console.log('Found matching links:', uniqueLinks);

    if (uniqueLinks.length > 0) {
      // Show notification about number of links found
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Opening Links',
        message: `Found ${uniqueLinks.length} matching links. Opening them now...`
      });

      // Open each link in a new tab with a longer delay
      for (const url of uniqueLinks) {
        await chrome.tabs.create({ url, active: false });
        // Wait 1 second between opening tabs
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error('Error opening links:', error);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Error Opening Links',
      message: 'An error occurred while opening links. Please try again.'
    });
  }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log('Tab updated:', tab.url);
    chrome.storage.sync.get(
      {
        downloadUrlPattern: '.*\\.example\\.com/.*',
        openUrlPattern: '',
        saveFolder: 'saved_pages',
        filenamePattern: '{hostname}_{pathname}',
        delay: 3,
        disableReferenceExpansion: false
      },
      (settings) => {
        try {
          console.log('Current settings:', settings);
          
          // Check if we're on a page that matches the open pattern
          if (settings.openUrlPattern) {
            const openRegex = new RegExp(settings.openUrlPattern.replace(/\//g, '\\/'));
            console.log('Testing open pattern:', openRegex);
            if (openRegex.test(tab.url)) {
              console.log('URL matches open pattern, searching for links...');
              openMatchingLinks(tabId, settings);
            }
          }

          // Check if we're on a page that matches the download pattern
          const downloadRegex = new RegExp(settings.downloadUrlPattern.replace(/\//g, '\\/'));
          console.log('Testing download pattern:', downloadRegex);
          if (downloadRegex.test(tab.url)) {
            console.log('URL matches download pattern, scheduling save...');
            setTimeout(() => {
              console.log('Initiating save for tab:', tabId);
              saveHTML(tabId, settings).catch(error => {
                console.error('Error in saveHTML:', error);
              });
            }, settings.delay * 1000);
          }
        } catch (error) {
          console.error('Error in tab update handler:', error);
        }
      }
    );
  }
});
