const express = require("express");
const morgan = require("morgan");
const requestIp = require("request-ip");
const path = require("path");

const app = express();
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));
app.use(requestIp.mw());

app.get("/whoami", (req, res) => {
  // What server sees: headers, ip, user-agent, accept-language, etc.
  const info = {
    ip: req.clientIp || req.ip,
    headers: {
      "user-agent": req.get("User-Agent"),
      "accept-language": req.get("Accept-Language"),
      accept: req.get("Accept"),
      referer: req.get("Referer"),
      "x-forwarded-for": req.get("X-Forwarded-For"),
    },
    time: new Date().toISOString(),
  };
  console.log("[whoami] served info for", info.ip);
  res.json(info);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PoC server listening on http://localhost:${PORT}`);
});

// POST /fingerprint
app.post('/fingerprint', express.json(), (req, res) => {
  const hash = req.body.hash;
  if (!hash) return res.status(400).send('No hash');
  db[hash] = (db[hash] || 0) + 1;
  res.json({ seenCount: db[hash] });
});
const db = {}; // In-memory store for fingerprint counts

module.exports = { app, db };