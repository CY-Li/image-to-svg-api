const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const convertRouter = require('./routes/convert');
const tosvgRouter = require('./routes/tosvg');

const app = express();
const port = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", "'unsafe-inline'",
        "*.googletagmanager.com",
        "*.google-analytics.com",
        "*.google.com",
        "*.googlesyndication.com",
        "*.doubleclick.net",
        "*.facebook.net",
        "*.onead.com.tw",
        "*.onevision.com.tw",
        "*.guoshipartners.com",
        "*.crwdcntrl.net",
        "*.adsrvr.org",
        "*.eyeota.net",
        "*.taboola.com",
        "cdn.tailwindcss.com", "unpkg.com", "cdn.jsdelivr.net", "fonts.googleapis.com"
      ],
      styleSrc: [
        "'self'", "'unsafe-inline'",
        "fonts.googleapis.com", "cdn.jsdelivr.net", "unpkg.com"
      ],
      fontSrc: [
        "'self'", "fonts.gstatic.com", "cdn.jsdelivr.net", "unpkg.com"
      ],
      imgSrc: [
        "'self'", "data:", "blob:",
        "*.google.com",
        "*.googlesyndication.com",
        "*.doubleclick.net",
        "*.onead.com.tw",
        "*.onevision.com.tw",
        "*.crwdcntrl.net",
        "*.adsrvr.org",
        "*.eyeota.net",
        "*.taboola.com"
      ],
      connectSrc: [
        "'self'",
        "*.google.com",
        "*.google-analytics.com",
        "*.googlesyndication.com",
        "*.doubleclick.net",
        "*.onead.com.tw",
        "*.onevision.com.tw",
        "*.guoshipartners.com",
        "*.crwdcntrl.net",
        "*.adsrvr.org",
        "*.eyeota.net",
        "*.taboola.com",
        "*.facebook.net",
        "https://generativelanguage.googleapis.com",
        "https://translate.googleapis.com"
      ],
      frameSrc: [
        "'self'",
        "*.google.com",
        "*.googlesyndication.com",
        "*.doubleclick.net",
        "*.onead.com.tw",
        "*.onevision.com.tw",
        "*.guoshipartners.com",
        "*.crwdcntrl.net",
        "*.adsrvr.org",
        "*.eyeota.net",
        "*.taboola.com"
      ],
      'fenced-frame-src': [
        "'self'",
        "*.google.com",
        "*.googlesyndication.com",
        "*.doubleclick.net",
        "*.onead.com.tw",
        "*.onevision.com.tw",
        "*.guoshipartners.com",
        "*.crwdcntrl.net",
        "*.adsrvr.org",
        "*.eyeota.net",
        "*.taboola.com"
      ]
    }
  }
}));
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.use('/api/convert', convertRouter);
app.use('/api/tosvg', tosvgRouter);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/tosvg', (req, res) => {
    res.sendFile(path.join(__dirname, 'tosvg.html'));
});
app.get('/fileconverter', (req, res) => {
    res.sendFile(path.join(__dirname, 'fileconverter.html'));
});
app.get('/logogenerator', (req, res) => {
    res.sendFile(path.join(__dirname, 'logogenerator.html'));
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: '伺服器錯誤', message: err.message });
});

app.listen(port, () => {
    console.log(`伺服器運行在 http://localhost:${port}`);
});
