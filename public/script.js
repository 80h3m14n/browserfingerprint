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
      if (svBrowser) svBrowser.textContent = `${info.userAgent.split("(")[0]}`;
      if (svDevice)
        svDevice.textContent = `${info.platform} — ${
          info.hardwareConcurrency || "?"
        } cores`;
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
