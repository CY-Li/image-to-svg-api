const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, '.')));
app.use(cors());
app.use(rateLimit({ windowMs: 60 * 1000, max: 5, message: 'Too many requests, please try again later.' }));

app.post('/convert', upload.single('image'), (req, res) => {
  // API Key 驗證
  const clientKey = req.headers['x-api-key'];
  const serverKey = process.env.API_KEY;
  if (!serverKey || clientKey !== serverKey) {
    return res.status(403).json({ error: 'Invalid or missing API Key.' });
  }

  const imagePath = req.file.path;
  const originalName = req.file.originalname;
  const fileName = originalName.split('.')[0] + '.svg';
  const outputSvg = `uploads/${Date.now()}_output.svg`;

  // 取得所有參數（form-data）
  const threshold = req.body.threshold || '';
  const bgSensitivity = req.body.bgSensitivity || '';
  const denoise = req.body.denoise || '';
  const contrast = req.body.contrast || '';
  const sharpen = req.body.sharpen || '';
  const posterize = req.body.posterize || '';
  const svgColor = req.body.svgColor || '';

  // 傳遞所有參數給 vectorize.py
  const args = [
    'python/vectorize.py',
    imagePath,
    outputSvg,
    threshold,
    bgSensitivity,
    denoise,
    contrast,
    sharpen,
    posterize,
    svgColor
  ];

  execFile('python3', args, (error, stdout, stderr) => {
    fs.unlinkSync(imagePath); // 刪除暫存檔案

    if (error) {
      console.error(stderr);
      return res.status(500).send('轉換失敗: ' + stderr);
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(outputSvg)
      .on('end', () => fs.unlinkSync(outputSvg))
      .pipe(res);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
