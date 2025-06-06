const express = require('express');
const multer = require('multer');
const potrace = require('potrace');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/convert', upload.single('image'), (req, res) => {
  const imagePath = req.file.path;

  potrace.trace(imagePath, { threshold: 128 }, (err, svg) => {
    fs.unlinkSync(imagePath); // 刪除暫存檔案

    if (err) {
      console.error(err);
      return res.status(500).send('轉換失敗');
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
