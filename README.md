PoC website that demonstrates what websites can legitimately detect about you (location with permission, OS, browser fingerprint-ish data, battery, devices, local IP attempts, number of same-site open tabs, headers & IP on the server-side, etc.).



## Features

Server-side info (/whoami): server sees your source IP (or proxy IP), User-Agent, Accept-Language, Referer, and other headers.

Navigator & screen: navigator.userAgent, platform, language, hardwareConcurrency, deviceMemory, screen.width/height — commonly used in fingerprinting.

Network information: navigator.connection exposes effective link type, RTT and downlink in some browsers.

Battery API: battery level & charging state (may be unavailable in some browsers).

Geolocation: exact coordinates — only after explicit permission.

Media devices: presence of camera/mic and device labels (labels require permission).

Local IP via WebRTC: some older browsers exposed local IP addresses via WebRTC ICE candidates — modern browsers often block this.

Same-origin tab detection: BroadcastChannel + localStorage allow a site to detect other tabs/windows of the same origin.

Visibility API: site can know when you switch tabs/windows (page visibility).

Fingerprint Scoring: Generate a hash from device/browser traits (user agent, timezone, screen, languages, etc.) and compare how rare it is based on a simple uniqueness algorithm (local DB count).

Privacy Checklist: Visual guide that reacts to user fingerprint



## Limitations

A site cannot enumerate open tabs for other origins, arbitrarily read other sites' content, or bypass permission prompts. 

Browsers have hardened many fingerprinting leaks — but enough surface remains for fingerprinting.


## Project structure

```ini
package.json (Node/Express server)

server.js (logs request headers + client IP, serves files, returns server-side info)

public/index.html (demo UI)

public/script.js (gathers client data)

public/styles.css (simple styling)

README instructions
```


## Run
```bash
npm install

node server.js
```

Open http://localhost:3000.

Click the buttons to grant geolocation / allow device enumeration if you want to see those fields populate.

Open the same URL in other tabs to see the demo of same-origin tab detection.

---

## Privacy checklist (example suggestions shown to users)

Use a privacy-focused browser (Brave, Tor Browser — for Tor, expect stricter blocking).

Use browser privacy mode and block 3rd-party cookies.

Limit or deny geolocation and media permissions unless necessary.

Use a WebRTC/IP leak blocker (browser flags, extensions) when needed.

Disable unnecessary plugins; avoid giving device labels/permissions.

---

## DISCLAIMER & ETHICS

> DISCLAIMER: This software is a demonstration / educational tool. The authors provide it as-is for learning and awareness. Use it responsibly. The authors are not responsible for misuse of this code. Always obtain explicit consent from people before collecting device or fingerprint data. If you plan to store or analyze collected data beyond transient demo use, consult legal counsel and follow applicable data protection laws (e.g., GDPR).


## Other similar projects

\- [Fingerprintjs by Fingerprintjs](https://github.com/fingerprintjs/fingerprintjs)

\- [Webkay by RobinLinus](https://webkay.robinlinus.com/)


## LICENSE

This project is released under the MIT License