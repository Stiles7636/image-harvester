# Image Harvester

Chrome extension to find, select and bulk-download images from **any** web page.

Generalized version of an internal tool I built at Amazon Prime Video that cut the time to download 30 images from **15 minutes to 10 seconds** (used by 15 people).

## Features
- Detects `<img>`, `srcset`, `<picture>`, CSS background images and links to image files
- Auto-scroll to load lazy images
- Filter by minimum size and file type
- Select individually or all at once
- Downloads into a named folder

## Install
1. Open `chrome://extensions` and turn on **Developer mode**
2. Click **Load unpacked** and select this folder

**Tech:** JavaScript · Chrome Extensions (Manifest V3) · HTML/CSS
