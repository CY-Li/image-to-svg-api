const express = require('express');
const multer = require('multer');
const potrace = require('potrace');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/convert', upload.single('image'), (req, res) => {
  const imagePath = req.file.path;
  const originalName = req.file.originalname;
  const fileName = originalName.split('.')[0] + '.svg';

  // 從請求中獲取參數，如果沒有則使用預設值
  const options = {
    threshold: parseInt(req.query.threshold) || 32,
    turdsize: parseInt(req.query.turdsize) || 2,
    alphamax: parseFloat(req.query.alphamax) || 1,
    optcurve: req.query.optcurve !== 'true',
    opttolerance: parseFloat(req.query.opttolerance) || 0.2,
    blacklevel: parseFloat(req.query.blacklevel) || 0.5,
    fillStrategy: req.query.fillStrategy || 'nonzero',
    color: req.query.color || '#000000',
    background: req.query.background || 'transparent'
  };

  potrace.trace(imagePath, options, (err, svg) => {
    fs.unlinkSync(imagePath); // 刪除暫存檔案

    if (err) {
      console.error(err);
      return res.status(500).send('轉換失敗');
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(svg);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
