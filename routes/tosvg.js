const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { vectorizeImage } = require('../services/vectorize');
const router = express.Router();
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: '請選擇要轉換的圖片' });
    const inputPath = req.file.path;
    const outputPath = path.join(uploadDir, `converted-${Date.now()}.svg`);
    // 支援多個參數
    const params = {
        bgSensitivity: req.body.bgSensitivity,
        denoise: req.body.denoise,
        contrast: req.body.contrast,
        sharpen: req.body.sharpen,
        posterize: req.body.posterize,
        threshold: req.body.threshold,
        svgColor: req.body.svgColor
    };
    try {
        await vectorizeImage(inputPath, outputPath, params);
        res.download(outputPath, 'output.svg', (err) => {
            fs.unlink(inputPath, () => {});
            fs.unlink(outputPath, () => {});
        });
    } catch (error) {
        fs.unlink(inputPath, () => {});
        fs.unlink(outputPath, () => {});
        res.status(500).json({ error: '圖片轉換失敗', detail: error.message });
    }
});

module.exports = router; 