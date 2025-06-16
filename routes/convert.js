const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { convertFile } = require('../services/libreoffice');
const router = express.Router();
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

const formatMap = {
    pdf: '.pdf',
    docx: '.docx',
    doc: '.doc',
    xlsx: '.xlsx',
    xls: '.xls',
    txt: '.txt'
};

router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: '請選擇要轉換的檔案' });
    const targetFormat = req.body.targetFormat;
    const outputExt = formatMap[targetFormat];
    if (!outputExt) return res.status(400).json({ error: '不支援的轉換格式' });
    const inputPath = req.file.path;
    const outputPath = path.join(uploadDir, `converted-${Date.now()}${outputExt}`);
    try {
        const inputBuf = await fs.promises.readFile(inputPath);
        const outputBuf = await convertFile(inputBuf, outputExt);
        await fs.promises.writeFile(outputPath, outputBuf);
        res.download(outputPath, `converted${outputExt}`, (err) => {
            fs.unlink(inputPath, () => {});
            fs.unlink(outputPath, () => {});
        });
    } catch (error) {
        fs.unlink(inputPath, () => {});
        fs.unlink(outputPath, () => {});
        res.status(500).json({ error: '檔案轉換失敗' });
    }
});

module.exports = router; 