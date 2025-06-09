const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.join(__dirname, '.')));

app.post('/convert', upload.single('image'), (req, res) => {
  const imagePath = req.file.path;
  const originalName = req.file.originalname;
  const fileName = originalName.split('.')[0] + '.svg';
  const outputSvg = `uploads/${Date.now()}_output.svg`;

  // 取得 threshold 參數
  const threshold = req.query.threshold;
  const args = ['python/vectorize.py', imagePath, outputSvg];
  if (threshold) args.push(threshold);

  // 呼叫 Python 腳本進行二值化向量化
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
