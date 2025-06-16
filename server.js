const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const libre = require('libreoffice-convert');
const libreConvert = util.promisify(libre.convert);

const app = express();
const port = process.env.PORT || 3000;

// 安全設定
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.tailwindcss.com", "fonts.googleapis.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
            fontSrc: ["'self'", "fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "https://generativelanguage.googleapis.com", "https://translate.googleapis.com"]
        }
    }
}));

// 基本中間件
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 設定上傳目錄
const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 設定 Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, Date.now() + '-' + safeName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支援的檔案格式'));
        }
    }
});

// 設定速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分鐘
    max: 100, // 每個 IP 限制 100 次請求
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// 路由設定
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

// 健康檢查端點
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// 檔案轉換 API
app.post('/api/convert', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '請選擇要轉換的檔案' });
    }

    const targetFormat = req.body.targetFormat;
    if (!targetFormat) {
        return res.status(400).json({ error: '請指定目標格式' });
    }

    const inputPath = req.file.path;
    // 新增格式對應表
    const formatMap = {
        pdf: '.pdf',
        docx: '.docx',
        doc: '.doc',
        xlsx: '.xlsx',
        xls: '.xls',
        txt: '.txt',
        svg: '.svg'
    };
    const outputExt = formatMap[targetFormat];
    if (!outputExt) {
        cleanupFiles([inputPath]);
        return res.status(400).json({ error: '不支援的轉換格式' });
    }
    const outputPath = path.join(uploadDir, `converted-${Date.now()}${outputExt}`);

    try {
        if (targetFormat === 'svg') {
            // 使用 Python 腳本轉換為 SVG
            await execAsync(`python3 vectorize.py "${inputPath}" "${outputPath}"`);
        } else {
            // 使用 LibreOffice 轉換其他格式
            const inputBuf = await fs.promises.readFile(inputPath);
            const outputBuf = await libreConvert(inputBuf, outputExt, undefined);
            await fs.promises.writeFile(outputPath, outputBuf);
        }

        res.download(outputPath, `converted${outputExt}`, (err) => {
            if (err) {
                console.error('下載錯誤:', err);
            }
            // 清理檔案
            cleanupFiles([inputPath, outputPath]);
        });
    } catch (error) {
        console.error('轉換錯誤:', error);
        cleanupFiles([inputPath, outputPath]);
        res.status(500).json({ error: '檔案轉換失敗' });
    }
});

// 清理檔案的輔助函數
function cleanupFiles(files) {
    files.forEach(file => {
        if (fs.existsSync(file)) {
            fs.unlink(file, err => {
                if (err) console.error('清理檔案錯誤:', err);
            });
        }
    });
}

// 錯誤處理中間件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: '伺服器錯誤',
        message: err.message
    });
});

// 啟動伺服器
app.listen(port, () => {
    console.log(`伺服器運行在 http://localhost:${port}`);
});
