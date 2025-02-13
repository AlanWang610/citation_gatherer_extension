# HTML Page Saver Chrome Extension

This Chrome extension automatically saves HTML content from specified websites based on URL patterns.

## Features

- Automatically saves HTML content from websites matching your specified URL pattern
- Configurable delay before saving (default: 3 seconds)
- Customizable save folder and filename patterns
- Supports regex for URL matching

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Configuration

Click the extension icon to configure:

1. **URL Pattern**: Enter a regex pattern to match URLs (e.g., `.*\.example\.com/.*`)
2. **Save Folder**: Specify the folder name where files will be saved
3. **Filename Pattern**: Customize how files are named using these variables:
   - `{hostname}`: Website hostname
   - `{pathname}`: URL path
   - `{timestamp}`: Current timestamp
4. **Delay**: Number of seconds to wait before saving (default: 3)

## Usage

Once configured, the extension will automatically save the HTML content of any webpage that matches your URL pattern after the specified delay.

## Permissions

This extension requires the following permissions:
- Storage: To save your settings
- Tabs: To access tab information
- Scripting: To extract HTML content
- Downloads: To save HTML files
- Host permissions: To access webpage content
