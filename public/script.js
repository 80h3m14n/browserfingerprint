// Expose / demo PoC - client-side collector + fingerprint poster// Exposr / demo PoC - client-side collector + fingerprint poster
// - Computes fingerprint hash
// - Posts anonymous hash to /fingerprint
// - Renders score + checklist
// - Minimal, non-PII payload (no raw GPS sent to server)
// Note: run only in demos with consent.

(async () => {
  // ---------- DOM refs ----------
  const clientPre = document.getElementById("client-json");
  const serverPre = document.getElementById("server-json");
  const toggleViewBtn = document.getElementById("toggle-view");
  const simpleView = document.getElementById("simple-view");
  const svBrowser = document.getElementById("sv-browser");
  const svDevice = document.getElementById("sv-device");
  const svNetwork = document.getElementById("sv-network");
  const svPrivacy = document.getElementById("sv-privacy");
  const svFingerprint = document.getElementById("sv-fingerprint");
  const svScreen = document.getElementById("sv-screen");
  const svTz = document.getElementById("sv-tz");
  const svLang = document.getElementById("sv-lang");
  const svServer = document.getElementById("sv-server");
  const svLocalips = document.getElementById("sv-localips");
  const svPublicip = document.getElementById("sv-publicip");
  const refreshServerBtn = document.getElementById("refresh-server");
  const getLocationBtn = document.getElementById("get-location");
  const tryLocalIpBtn = document.getElementById("try-local-ip");
  const listDevicesBtn = document.getElementById("list-devices");
  const tabsStatus = document.getElementById("tabs-status");

  // fingerprint UI
  const fpJsonEl = document.getElementById("fingerprint-json");
  const fpScoreEl = document.getElementById("fingerprint-score");
  const checklistEl = document.getElementById("privacy-checklist");

  // ---------- helpers ----------
  function safeJSON(obj) {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }

  // simple 32-bit-ish rolling hash -> hex (stable across runs for same payload)
  function hashFingerprint(data) {
    const json = JSON.stringify(data);
    let h = 0;
    for (let i = 0; i < json.length; i++) {
      h = (Math.imul(31, h) + json.charCodeAt(i)) | 0;
    }
    return ("00000000" + (h >>> 0).toString(16)).slice(-8);
  }

  function uniquenessFromSeenCount(seenCount) {
    if (!seenCount || seenCount <= 1) return 95;
    if (seenCount <= 5) return 80;
    if (seenCount <= 10) return 60;
    if (seenCount <= 50) return 30;
    return 10;
  }

  // Lightweight UA parser to extract common browser name + version and a key
  // We intentionally keep this small and local to avoid pulling external libs.
  function parseUserAgent(uaString) {
    const ua = (uaString || "").toString();
    // Order matters: Edge/Opera identify as Chrome too.
    const rules = [
      { key: "edge", re: /Edg\/([\d\.]+)/i, name: "Edge" },
      { key: "edge", re: /Edge\/([\d\.]+)/i, name: "Edge" },
      { key: "opera", re: /OPR\/([\d\.]+)/i, name: "Opera" },
      { key: "opera", re: /Opera\/([\d\.]+)/i, name: "Opera" },
      { key: "brave", re: /Brave\/([\d\.]+)/i, name: "Brave" },
      { key: "chrome", re: /Chrome\/([\d\.]+)/i, name: "Chrome" },
      { key: "firefox", re: /Firefox\/([\d\.]+)/i, name: "Firefox" },
      { key: "safari", re: /Version\/([\d\.]+).*Safari/i, name: "Safari" },
      { key: "tor", re: /TorBrowser\/([\d\.]+)/i, name: "Tor Browser" },
      // fallback: try to find any Version/X or rv: for IE/others
      { key: "generic", re: /Version\/([\d\.]+)/i, name: "Browser" },
    ];

    for (const r of rules) {
      const m = ua.match(r.re);
      if (m) return { key: r.key, name: r.name, version: m[1] || "" };
    }

    // Special-case checks and best-effort parsing
    if (
      /brave/i.test(ua) ||
      (navigator.brave && typeof navigator.brave.isBrave === "function")
    )
      return { key: "brave", name: "Brave", version: "" };
    if (/duckduckgo/i.test(ua))
      return { key: "duckduckgo", name: "DuckDuckGo", version: "" };
    if (/chrome/i.test(ua) && !/edg/i.test(ua) && !/opr/i.test(ua)) {
      const m = ua.match(/Chrome\/([\d\.]+)/i);
      return { key: "chrome", name: "Chrome", version: m ? m[1] : "" };
    }
    if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
      const m = ua.match(/Version\/([\d\.]+)/i);
      return { key: "safari", name: "Safari", version: m ? m[1] : "" };
    }
    if (/firefox/i.test(ua)) {
      const m = ua.match(/Firefox\/([\d\.]+)/i);
      return { key: "firefox", name: "Firefox", version: m ? m[1] : "" };
    }

    return { key: "unknown", name: uaString || "Unknown", version: "" };
  }

  // Inline SVG icon generator for browsers (simple, generic shapes to avoid external assets)
  function svgForBrowser(key) {
    const base = (w, h, inner) =>
      `<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' aria-hidden='true'>${inner}</svg>`;
    switch (key) {
      case "chrome":
        return base(
          20,
          20,
          "<circle cx='10' cy='10' r='9' stroke='#0ea5b7' stroke-width='2' fill='none'/><circle cx='10' cy='10' r='3' fill='#0ea5b7' />"
        );
      case "firefox":
        return base(
          20,
          20,
          "<path d='M4 14c2-4 8-6 11-6-1 3-4 6-8 6-2 0-3-1-3-0z' fill='#f97316'/>"
        );
      case "safari":
        return base(
          20,
          20,
          "<circle cx='10' cy='10' r='9' stroke='#38bdf8' stroke-width='2' fill='none'/><path d='M10 4 L11 9 L15 10 L11 11 L10 16 L9 11 L5 10 L9 9 Z' fill='#38bdf8' />"
        );
      case "edge":
        return base(
          20,
          20,
          "<path d='M3 12c3-6 10-8 14-6-2 3-5 7-10 8-2 0-5-1-4-2z' fill='#60a5fa' />"
        );
      case "opera":
        return base(
          20,
          20,
          "<circle cx='10' cy='10' r='7' stroke='#ef4444' stroke-width='2' fill='none'/>"
        );
      case "brave":
        return base(
          20,
          20,
          "<rect x='3' y='3' width='14' height='14' rx='3' fill='#f59e0b' />"
        );
      case "tor":
        return base(
          20,
          20,
          "<circle cx='10' cy='10' r='8' fill='#a78bfa' /><circle cx='10' cy='10' r='4' fill='#7c3aed' />"
        );
      case "duckduckgo":
        return base(
          20,
          20,
          "<path d='M4 12c2-4 10-6 12-6-1 3-4 6-8 6-2 0-3-1-4 0z' fill='#10b981' />"
        );
      default:
        return base(
          20,
          20,
          "<rect x='2' y='2' width='16' height='16' rx='3' fill='#64748b' />"
        );
    }
  }

  // Inline SVG icon generator for OS
  function svgForOS(key) {
    const base = (w, h, inner) =>
      `<?xml version="1.0" encoding="UTF-8"?><svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' aria-hidden='true'>${inner}</svg>`;
    switch (key) {
      case "android":
        return base(
          20,
          20,
          "<rect x='4' y='6' width='12' height='10' rx='2' fill='#10b981' />"
        );
      case "ios":
        return base(
          20,
          20,
          "<rect x='6' y='3' width='8' height='14' rx='2' fill='#f97316' />"
        );
      case "macos":
        return base(20, 20, "<circle cx='10' cy='10' r='7' fill='#f43f5e' />");
      case "windows":
        return base(
          20,
          20,
          "<rect x='2' y='3' width='7' height='6' fill='#60a5fa' /><rect x='11' y='3' width='7' height='6' fill='#60a5fa' /><rect x='2' y='11' width='7' height='6' fill='#2563eb' /><rect x='11' y='11' width='7' height='6' fill='#2563eb' />"
        );
      case "linux":
        return base(20, 20, "<circle cx='10' cy='10' r='8' fill='#0ea5b7' />");
      default:
        return base(
          20,
          20,
          "<rect x='3' y='3' width='14' height='14' rx='3' fill='#94a3b8' />"
        );
    }
  }

  function getBrowserIconAndName(ua) {
    const parsed = parseUserAgent(ua);
    return {
      svg: svgForBrowser(parsed.key),
      name: parsed.name,
      version: parsed.version,
    };
  }

  function getOSIconAndName(platform, ua) {
    const p = (platform || "").toLowerCase();
    const u = (ua || "").toLowerCase();
    if (/android/i.test(u) || /android/.test(p))
      return { svg: svgForOS("android"), name: "Android" };
    if (/iphone|ipad|ipod|ios/i.test(u) || /iphone|ipad/.test(p))
      return { svg: svgForOS("ios"), name: "iOS" };
    if (/mac/i.test(p) || /mac os x/i.test(u))
      return { svg: svgForOS("macos"), name: "macOS" };
    if (/win/i.test(p) || /windows/i.test(u))
      return { svg: svgForOS("windows"), name: "Windows" };
    if (/linux/i.test(p) || /linux/i.test(u))
      return { svg: svgForOS("linux"), name: "Linux" };
    return { svg: svgForOS("generic"), name: platform || "Unknown OS" };
  }

  function renderPrivacyChecklist(info) {
    if (!checklistEl) return;
    checklistEl.innerHTML = "";
    const checks = [
      {
        label: "Cookies enabled",
        ok: !info.cookieEnabled ? true : false,
        note: info.cookieEnabled ? "Cookies ENABLED" : "Cookies disabled",
      },
      {
        label: "Geolocation allowed",
        ok: !(info.geolocation && info.geolocation.latitude),
        note:
          info.geolocation && info.geolocation.latitude
            ? "Location shared"
            : "Location not shared",
      },
      {
        label: "WebRTC local IPs exposed",
        ok: !(
          info.localIps &&
          Array.isArray(info.localIps) &&
          info.localIps.length
        ),
        note:
          info.localIps && Array.isArray(info.localIps) && info.localIps.length
            ? `IPs: ${info.localIps.join(", ")}`
            : "No local IPs detected",
      },
      {
        label: "Using privacy browser (UA hint)",
        ok: /brave|tor|duckduckgo|firefox-focus|firefox.*privacy/i.test(
          info.userAgent
        )
          ? true
          : false,
        note: info.userAgent,
      },
      {
        label: "Media devices visible (labels)",
        ok: !(
          info.mediaDevices &&
          info.mediaDevices.length &&
          info.mediaDevices.some(
            (d) => d.label && d.label !== "(label hidden until permission)"
          )
        ),
        note: info.mediaDevices
          ? `${info.mediaDevices.length} devices`
          : "unknown",
      },
    ];

    checks.forEach((c) => {
      const li = document.createElement("li");
      li.textContent = `${c.ok ? "✅" : "⚠️"} ${c.label} — ${c.note}`;
      checklistEl.appendChild(li);
    });
  }

  function updateSimpleView(info, serverInfo, hash, seenCount) {
    try {
      if (svBrowser) {
        const b = getBrowserIconAndName(info.userAgent);
        // show icon + name + version (if available)
        const nameWithVer = b.version ? `${b.name} ${b.version}` : b.name;
        svBrowser.innerHTML = `<span class="sv-icon" aria-hidden="true">${b.svg}</span> <span class="sv-text">${nameWithVer}</span>`;
      }
      if (svDevice) {
        const os = getOSIconAndName(info.platform, info.userAgent);
        svDevice.innerHTML = `<span class="sv-icon" aria-hidden="true">${
          os.svg
        }</span> <span class="sv-text">${os.name} — ${
          info.hardwareConcurrency || "?"
        } cores</span>`;
      }
      if (svScreen)
        svScreen.textContent = `${info.screen?.width}×${info.screen?.height} (${info.screen?.colorDepth}-bit)`;
      if (svNetwork)
        svNetwork.textContent = `${
          info.connection?.effectiveType || "unknown"
        } — ${info.online ? "online" : "offline"}`;
      if (svTz) svTz.textContent = info.timeZone || "—";
      if (svLang)
        svLang.textContent = Array.isArray(info.languages)
          ? info.languages.join(", ")
          : info.language || "—";
      const priv = [];
      if (info.cookieEnabled) priv.push("Cookies allowed");
      else priv.push("Cookies blocked");
      if (info.geolocation && info.geolocation.latitude)
        priv.push("Location shared");
      else priv.push("Location not shared");
      if (info.mediaDevices && info.mediaDevices.length)
        priv.push(`${info.mediaDevices.length} media devices`);
      if (svPrivacy) svPrivacy.textContent = priv.join(" · ");
      if (svFingerprint)
        svFingerprint.textContent = `id: ${hash || "—"} — seen ${
          seenCount || 0
        } times`;
      if (serverInfo && svServer)
        svServer.textContent = `${serverInfo.ip || "—"}`;
      if (svLocalips)
        svLocalips.textContent = clientInfo.localIps
          ? Array.isArray(clientInfo.localIps)
            ? clientInfo.localIps.join(", ")
            : clientInfo.localIps
          : "—";
      if (svPublicip) svPublicip.textContent = clientInfo.publicIp || "—";
    } catch {}
  }

  // ---------- New features: accounts, autofill, device position, uptime ----------

  // 1) Accounts: best-effort check using Credential Management API (federated)
  async function checkLoggedInAccounts() {
    const out = { supported: false, credentials: [] };
    if (!("credentials" in navigator)) return out;
    out.supported = true;
    try {
      // request federated credentials (no silent discovery guaranteed)
      // we use mediation: 'optional' so it won't prompt in many browsers
      const cred = await navigator.credentials.get({
        federated: { providers: [] },
        mediation: "optional",
      });
      if (cred) {
        // Credential type can be FederatedCredential or PasswordCredential
        if (cred.type === "federated" || cred.provider) {
          out.credentials.push({ type: "federated", provider: cred.provider });
        } else if (cred.type === "password" || cred.id) {
          out.credentials.push({ type: "password", id: cred.id });
        } else {
          out.credentials.push({ type: cred.type || "unknown" });
        }
      }
    } catch (e) {
      // Some browsers will throw or reject; return best-effort info
      out.error = String(e);
    }
    return out;
  }

  // 2) Autofill probe: create (not appended) form inputs, focus+blur to let browser autofill, read values
  async function probeAutofill() {
    // We'll create fields with common autocomplete tokens and observe if they get filled
    const fields = [
      { name: "name", ac: "name" },
      { name: "email", ac: "email" },
      { name: "tel", ac: "tel" },
      { name: "address", ac: "street-address" },
      { name: "postal", ac: "postal-code" },
      { name: "cc", ac: "cc-number" },
    ];
    const form = document.createElement("form");
    form.style.position = "fixed";
    form.style.left = "-9999px";
    form.style.top = "-9999px";
    fields.forEach((f) => {
      const input = document.createElement("input");
      input.name = f.name;
      input.autocomplete = f.ac;
      input.type = "text";
      form.appendChild(input);
    });
    document.body.appendChild(form);
    // Give browser a tick to possibly autofill
    await new Promise((r) => setTimeout(r, 250));
    // Focus and blur each field to trigger autofill in some browsers
    for (const el of form.elements) {
      try {
        el.focus();
        // some browsers need multiple focus/blur cycles
        el.blur();
        await new Promise((r) => setTimeout(r, 50));
      } catch {}
    }
    const result = {};
    Array.from(form.elements).forEach((el) => {
      result[el.name] = el.value || null;
    });
    document.body.removeChild(form);
    return result;
  }

  // 3) Device position: use DeviceOrientation / DeviceMotion to guess if device is flat
  let devicePositionState = { mode: "unknown", last: null };
  function startDevicePositionListeners() {
    if ("ondeviceorientation" in window) {
      const handle = (ev) => {
        // gamma: left-right tilt, beta: front-back tilt, alpha: compass
        const beta = ev.beta; // -180..180 (front-back)
        const gamma = ev.gamma; // -90..90 (left-right)
        devicePositionState.last = { beta, gamma, timestamp: Date.now() };
        // heuristics: if beta around 0 and gamma around 0 -> flat (lying)
        if (Math.abs(beta) < 15 && Math.abs(gamma) < 15)
          devicePositionState.mode = "flat";
        else if (Math.abs(beta) > 50) devicePositionState.mode = "upright";
        else devicePositionState.mode = "tilted";
        updateDevicePositionUI();
      };
      window.addEventListener("deviceorientation", handle, { passive: true });
    } else if ("ondevicemotion" in window) {
      const handle = (ev) => {
        const a = ev.accelerationIncludingGravity;
        if (!a) return;
        // When flat, gravity pulls mostly on z; when upright, x/y larger
        const x = a.x || 0;
        const y = a.y || 0;
        const z = a.z || 0;
        devicePositionState.last = { x, y, z, timestamp: Date.now() };
        const absZ = Math.abs(z);
        const absXY = Math.abs(x) + Math.abs(y);
        if (absZ > absXY * 1.5) devicePositionState.mode = "flat";
        else if (absXY > absZ * 1.5) devicePositionState.mode = "upright";
        else devicePositionState.mode = "tilted";
        updateDevicePositionUI();
      };
      window.addEventListener("devicemotion", handle, { passive: true });
    } else {
      // no sensors
      devicePositionState.mode = "unavailable";
      updateDevicePositionUI();
    }
  }

  function updateDevicePositionUI() {
    const el = document.getElementById("device-position");
    if (!el) return;
    el.textContent = devicePositionState.mode || "unknown";
  }

  // 4) Uptime: page uptime + heuristic browser/process uptime (best-effort via performance.timing)
  const pageStart = Date.now();
  function updateUptimeUI() {
    const pageEl = document.getElementById("page-uptime");
    const browserEl = document.getElementById("browser-uptime");
    if (pageEl) {
      const s = Math.floor((Date.now() - pageStart) / 1000);
      pageEl.textContent = `${s}s`;
    }
    if (browserEl && performance && performance.timing) {
      // navigationStart is when the browser started navigation for this document
      const navStart = performance.timing.navigationStart || null;
      if (navStart) {
        const s = Math.floor((Date.now() - navStart) / 1000);
        browserEl.textContent = `${s}s`;
      } else {
        browserEl.textContent = "unknown";
      }
    }
  }

  // Wire new UI controls
  const checkAccountsBtn = document.getElementById("check-accounts");
  const accountsListEl = document.getElementById("accounts-list");
  const probeAutofillBtn = document.getElementById("probe-autofill");
  const autofillJson = document.getElementById("autofill-json");

  if (checkAccountsBtn) {
    checkAccountsBtn.addEventListener("click", async () => {
      checkAccountsBtn.disabled = true;
      accountsListEl.textContent = "Checking...";
      const res = await checkLoggedInAccounts();
      accountsListEl.textContent = JSON.stringify(res, null, 2);
      checkAccountsBtn.disabled = false;
    });
  }

  if (probeAutofillBtn) {
    probeAutofillBtn.addEventListener("click", async () => {
      probeAutofillBtn.disabled = true;
      autofillJson.textContent = "Probing...";
      try {
        const r = await probeAutofill();
        autofillJson.textContent = JSON.stringify(r, null, 2);
      } catch (e) {
        autofillJson.textContent = String(e);
      }
      probeAutofillBtn.disabled = false;
    });
  }

  // start device position listeners and uptime interval
  try {
    startDevicePositionListeners();
  } catch {}
  updateUptimeUI();
  setInterval(updateUptimeUI, 1000);

  // ---------- gather navigator basic info ----------
  function gatherNavigatorInfo() {
    const nav = navigator;
    return {
      userAgent: nav.userAgent,
      platform: nav.platform,
      product: nav.product,
      appVersion: nav.appVersion,
      vendor: nav.vendor,
      languages: nav.languages,
      language: nav.language,
      hardwareConcurrency: nav.hardwareConcurrency,
      deviceMemory: nav.deviceMemory || null,
      maxTouchPoints: nav.maxTouchPoints,
      doNotTrack: nav.doNotTrack,
      cookieEnabled: nav.cookieEnabled,
      online: nav.onLine,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
      },
      connection: nav.connection
        ? {
            effectiveType: nav.connection.effectiveType,
            downlink: nav.connection.downlink,
            rtt: nav.connection.rtt,
          }
        : null,
      permissions: {
        geolocation: null,
        camera: null,
        microphone: null,
        notifications: null,
      },
    };
  }

  const clientInfo = gatherNavigatorInfo();
  if (clientPre) clientPre.textContent = safeJSON(clientInfo);

  // ---------- server info ----------
  async function fetchServerInfo() {
    try {
      const res = await fetch("/whoami");
      if (!res.ok) throw new Error("no whoami");
      const json = await res.json();
      if (serverPre) serverPre.textContent = safeJSON(json);
      // update simple view with server info
      updateSimpleView(clientInfo, json);
    } catch (e) {
      // likely running on static host (GitHub Pages) — fall back to a public IP service
      try {
        const r2 = await fetch("https://api.ipify.org?format=json");
        const j2 = await r2.json();
        const fallback = { ip: j2.ip, note: "public-ip via ipify (no server)" };
        if (serverPre) serverPre.textContent = safeJSON(fallback);
        updateSimpleView(clientInfo, fallback);
      } catch (e2) {
        if (serverPre)
          serverPre.textContent = "Error fetching server info: " + e;
      }
    }
  }
  refreshServerBtn && (refreshServerBtn.onclick = fetchServerInfo);
  fetchServerInfo();

  // ---------- permissions observer ----------
  async function updatePermissions() {
    if (!navigator.permissions) return;
    const toCheck = ["geolocation", "camera", "microphone", "notifications"];
    for (const name of toCheck) {
      try {
        const p = await navigator.permissions.query({ name });
        clientInfo.permissions[name] = p.state;
        p.onchange = () => {
          clientInfo.permissions[name] = p.state;
          if (clientPre) clientPre.textContent = safeJSON(clientInfo);
          scheduleFingerprintPost();
        };
      } catch {
        clientInfo.permissions[name] = "unknown";
      }
    }
    if (clientPre) clientPre.textContent = safeJSON(clientInfo);
  }
  updatePermissions();

  // ---------- geolocation ----------
  getLocationBtn &&
    (getLocationBtn.onclick = () => {
      if (!navigator.geolocation) {
        alert("Geolocation API not supported.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clientInfo.geolocation = {
            // keep it local only; do NOT POST raw coords to server
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            timestamp: pos.timestamp,
          };
          if (clientPre) clientPre.textContent = safeJSON(clientInfo);
          // NOTE: we intentionally do not send raw coords to server fingerprint payload.
          scheduleFingerprintPost();
        },
        (err) => {
          clientInfo.geolocation = { error: err.message, code: err.code };
          if (clientPre) clientPre.textContent = safeJSON(clientInfo);
          scheduleFingerprintPost();
        },
        { enableHighAccuracy: false, maximumAge: 60_000 }
      );
    });

  // ---------- WebRTC local IP attempt ----------
  // Try to extract local and public IPs via WebRTC candidates. Public IP can sometimes
  // be learned from STUN server candidates. Fallback to ipify.org for public IP.
  async function getPublicIpFallback() {
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const j = await res.json();
      return j.ip;
    } catch {
      return null;
    }
  }

  async function tryLocalIp() {
    try {
      const ips = new Set();
      const RTCPeerConnection =
        window.RTCPeerConnection ||
        window.mozRTCPeerConnection ||
        window.webkitRTCPeerConnection;
      if (!RTCPeerConnection) {
        clientInfo.localIps = "RTCPeerConnection not supported";
        if (clientPre) clientPre.textContent = safeJSON(clientInfo);
        scheduleFingerprintPost();
        return;
      }

      // Try with a STUN server — this may produce a srflx (public) candidate.
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pc.createDataChannel("");
      const gatherPromise = new Promise((resolve) => {
        pc.onicecandidate = (evt) => {
          if (!evt || !evt.candidate) return;
          const cand = evt.candidate.candidate || "";
          // grab IP-like tokens
          const matches = cand.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/g);
          if (matches) matches.forEach((m) => ips.add(m));
          // some candidates include typ srflx with public IP
          if (/typ\s+srflx/.test(cand)) {
            // keep gathering but mark we got one
          }
        };
      });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // wait briefly to gather candidates
      await new Promise((r) => setTimeout(r, 1400));
      pc.close();

      // ips now contains local/private and possibly public addresses
      clientInfo.localIps = Array.from(ips);

      // If we didn't see an obvious public IP, try external service fallback
      const maybePublic = clientInfo.localIps.find(
        (ip) => !/^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^192\.168\./.test(ip)
      );
      if (!maybePublic) {
        const pub = await getPublicIpFallback();
        if (pub) clientInfo.publicIp = pub;
      } else {
        clientInfo.publicIp = maybePublic;
      }
    } catch (e) {
      clientInfo.localIps = `error: ${e.message}`;
    }
    if (clientPre) clientPre.textContent = safeJSON(clientInfo);
    scheduleFingerprintPost();
  }
  tryLocalIpBtn && (tryLocalIpBtn.onclick = tryLocalIp);

  // ---------- media devices enumeration ----------
  listDevicesBtn &&
    (listDevicesBtn.onclick = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        alert("Media Devices API not supported.");
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        clientInfo.mediaDevices = devices.map((d) => ({
          kind: d.kind,
          label: d.label || "(label hidden until permission)",
          deviceId: d.deviceId,
          groupId: d.groupId,
        }));
      } catch (e) {
        clientInfo.mediaDevices = { error: e.message };
      }
      if (clientPre) clientPre.textContent = safeJSON(clientInfo);
      scheduleFingerprintPost();
    });

  // ---------- same-origin tab detection ----------
  const originChannel = (() => {
    try {
      return new BroadcastChannel("what-sites-know-channel");
    } catch (e) {
      return null;
    }
  })();

  const TAB_ID = Math.random().toString(36).slice(2, 9);
  const activeTabs = new Set([TAB_ID]);
  function updateTabsUI() {
    if (tabsStatus)
      tabsStatus.textContent = `Tabs of this origin open (detected): ${
        Array.from(activeTabs).length
      }`;
  }
  updateTabsUI();

  if (originChannel) {
    originChannel.onmessage = (e) => {
      const d = e?.data;
      if (!d) return;
      if (d.type === "announce") {
        activeTabs.add(d.tabId);
        originChannel.postMessage({ type: "ack", tabId: TAB_ID });
        updateTabsUI();
      } else if (d.type === "ack") {
        activeTabs.add(d.tabId);
        updateTabsUI();
      } else if (d.type === "leave") {
        activeTabs.delete(d.tabId);
        updateTabsUI();
      }
      scheduleFingerprintPost(); // number of tabs changed -> affects fingerprint-ish metric
    };
    originChannel.postMessage({ type: "announce", tabId: TAB_ID });
    window.addEventListener("beforeunload", () => {
      originChannel.postMessage({ type: "leave", tabId: TAB_ID });
    });
  } else {
    // localStorage fallback
    const LS_KEY = "what-sites-know-tabs";
    function announceLS() {
      const payload = { tabId: TAB_ID, t: Date.now() };
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    }
    window.addEventListener("storage", (ev) => {
      if (ev.key !== LS_KEY || !ev.newValue) return;
      try {
        const p = JSON.parse(ev.newValue);
        activeTabs.add(p.tabId);
        updateTabsUI();
      } catch {}
      scheduleFingerprintPost();
    });
    announceLS();
    const pingInterval = setInterval(announceLS, 1000);
    window.addEventListener("beforeunload", () => clearInterval(pingInterval));
  }

  // ---------- visibility ----------
  document.addEventListener("visibilitychange", () => {
    clientInfo.visibility = document.visibilityState;
    if (clientPre) clientPre.textContent = safeJSON(clientInfo);
    scheduleFingerprintPost();
  });

  // ---------- periodic local updates ----------
  setInterval(() => {
    clientInfo.online = navigator.onLine;
    clientInfo.time = new Date().toISOString();
    if (clientPre) clientPre.textContent = safeJSON(clientInfo);
  }, 4000);

  // ---------- fingerprint post logic (debounced) ----------
  let fpTimeout = null;
  function scheduleFingerprintPost(delay = 700) {
    if (fpTimeout) clearTimeout(fpTimeout);
    fpTimeout = setTimeout(() => {
      postFingerprintAndUpdateUI(clientInfo);
      fpTimeout = null;
    }, delay);
  }

  // Build the compact fingerprint payload we will hash & post.
  // IMPORTANT: do NOT include raw GPS coords, IPs, or other high-sensitivity data.
  function buildFingerprintPayload(info) {
    return {
      ua: info.userAgent,
      platform: info.platform,
      tz: info.timeZone,
      screen: {
        w: info.screen?.width,
        h: info.screen?.height,
        colorDepth: info.screen?.colorDepth,
      },
      langs: info.languages,
      hw: {
        cores: info.hardwareConcurrency,
        mem: info.deviceMemory,
      },
      conn: info.connection ? info.connection.effectiveType : null,
      mediaCount: info.mediaDevices ? info.mediaDevices.length : 0,
      localIpsIndicator: Array.isArray(info.localIps)
        ? info.localIps.length
          ? "leak"
          : "none"
        : typeof info.localIps === "string"
        ? info.localIps
        : null,
      sameOriginTabs: Array.from(activeTabs).length,
      visibility: info.visibility || document.visibilityState,
    };
  }

  // POST to server and update UI
  async function postFingerprintAndUpdateUI(info) {
    try {
      const payload = buildFingerprintPayload(info);
      // compute a stronger hash if possible (SHA-256), fallback to rolling hash
      let hash = null;
      try {
        const enc = new TextEncoder();
        const buf = enc.encode(JSON.stringify(payload));
        const dig = await crypto.subtle.digest("SHA-256", buf);
        const arr = Array.from(new Uint8Array(dig)).map((b) =>
          b.toString(16).padStart(2, "0")
        );
        hash = arr.join("").slice(0, 12); // short prefix
      } catch (e) {
        hash = hashFingerprint(payload);
      }

      // update local fingerprint UI
      if (fpJsonEl)
        fpJsonEl.textContent = `hash: ${hash}\n` + safeJSON(payload);
      // update separate hash element (for UI features)
      const fpHashEl = document.getElementById("fingerprint-hash");
      if (fpHashEl) fpHashEl.textContent = `Hash: ${hash}`;

      // send minimal / anonymous payload
      let seenCount = 0;
      try {
        const res = await fetch("/fingerprint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hash }),
        });
        let body = {};
        try {
          body = await res.json();
        } catch {}
        seenCount = body.seenCount || 0;
      } catch (e) {
        // no server available (static host). Use localStorage as a demo fallback to track seen counts per-browser only.
        try {
          const key = "demo-fp-count-" + hash;
          const n = parseInt(localStorage.getItem(key) || "0", 10) + 1;
          localStorage.setItem(key, String(n));
          seenCount = n;
        } catch {
          seenCount = 1;
        }
      }
      const score = uniquenessFromSeenCount(seenCount);

      if (fpScoreEl)
        fpScoreEl.textContent = `Uniqueness: ${score}% — seen ${seenCount} times`;
      // visual bar (if desired) - basic inline
      if (fpScoreEl) {
        fpScoreEl.style.width = "100%";
        fpScoreEl.style.display = "block";
      }

      // render checklist based on latest clientInfo
      renderPrivacyChecklist(info);
      // update simple view
      updateSimpleView(info, null, hash, seenCount);
    } catch (e) {
      console.error("postFingerprint error", e);
    }
  }

  // initial post (after small delay to let any async bits settle)
  scheduleFingerprintPost(1200);

  // expose a manual re-run if needed
  window.__exposr = {
    gather: () => {
      if (clientPre) clientPre.textContent = safeJSON(clientInfo);
      scheduleFingerprintPost(100);
    },
    tryLocalIp,
  };

  // ---------- UI controls: copy, export, theme ----------
  const copyBtn = document.getElementById("copy-fp");
  const exportBtn = document.getElementById("export-fp");
  const themeBtn = document.getElementById("toggle-theme");
  const copyStatus = document.getElementById("copy-status");

  function getCurrentFingerprintText() {
    const h =
      document.getElementById("fingerprint-hash")?.textContent || "Hash: —";
    const body = fpJsonEl ? fpJsonEl.textContent : "";
    return `${h}\n\n${body}`;
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      document.body.removeChild(ta);
      return Promise.resolve();
    } catch (e) {
      document.body.removeChild(ta);
      return Promise.reject(e);
    }
  }

  copyBtn &&
    (copyBtn.onclick = async () => {
      const text = getCurrentFingerprintText();
      try {
        await copyToClipboard(text);
        if (copyStatus) {
          copyStatus.textContent = "Copied!";
          setTimeout(() => (copyStatus.textContent = ""), 1400);
        }
      } catch (e) {
        if (copyStatus) copyStatus.textContent = "Copy failed";
      }
    });

  exportBtn &&
    (exportBtn.onclick = () => {
      const payloadTxt = getCurrentFingerprintText();
      try {
        const blob = new Blob([payloadTxt], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const now = new Date().toISOString().replace(/[:.]/g, "-");
        a.download = `fingerprint-${now}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        alert("Export failed: " + e.message);
      }
    });

  // Theme toggle (persist in localStorage)
  const THEME_KEY = "site-theme";
  function applyTheme(theme) {
    if (theme === "light")
      document.documentElement.setAttribute("data-theme", "light");
    else document.documentElement.removeAttribute("data-theme");
  }
  (function initTheme() {
    try {
      const t = localStorage.getItem(THEME_KEY) || "dark";
      applyTheme(t);
    } catch {}
  })();

  themeBtn &&
    (themeBtn.onclick = () => {
      try {
        const cur = localStorage.getItem(THEME_KEY) || "dark";
        const next = cur === "dark" ? "light" : "dark";
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
      } catch (e) {
        // ignore
      }
    });

  // simple view toggle
  if (toggleViewBtn) {
    toggleViewBtn.onclick = () => {
      if (!simpleView) return;
      const show =
        simpleView.style.display === "none" || simpleView.style.display === "";
      simpleView.style.display = show ? "block" : "none";
      toggleViewBtn.textContent = show ? "Hide simple view" : "Simple view";
      // set a class on body so CSS can hide detailed cards
      try {
        document.body.classList.toggle("simple-mode", show);
      } catch {}
      // refresh contents (include server info if we have it visible)
      updateSimpleView(clientInfo, null);
    };
  }
})();
