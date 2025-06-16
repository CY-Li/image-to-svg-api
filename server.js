const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const libreoffice = require('libreoffice-convert');
const convertAsync = promisify(libreoffice.convert);

const app = express();
const port = process.env.PORT || 3000;

// 設置 trust proxy
app.set('trust proxy', 1);

// 安全設置
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.tailwindcss.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
            fontSrc: ["'self'", "fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"]
        }
    }
}));

// CORS 設置
app.use(cors());

// 解析 JSON
app.use(express.json());

// 靜態文件
app.use(express.static('public'));

// 速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分鐘
    max: 100, // 每個 IP 限制 100 個請求
    message: '請求過於頻繁，請稍後再試',
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// 設定檔案上傳
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = '/tmp/uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${uuidv4()}-${safeName}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 限制 10MB
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'image/jpeg',
            'image/png',
            'image/gif'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支援的檔案類型'));
        }
    }
});

// 檔案轉換相關的設定
const conversionFormats = {
    'pdf': {
        mime: 'application/pdf',
        ext: '.pdf'
    },
    'docx': {
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ext: '.docx'
    },
    'doc': {
        mime: 'application/msword',
        ext: '.doc'
    },
    'xlsx': {
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ext: '.xlsx'
    },
    'xls': {
        mime: 'application/vnd.ms-excel',
        ext: '.xls'
    },
    'txt': {
        mime: 'text/plain',
        ext: '.txt'
    },
    'svg': {
        mime: 'image/svg+xml',
        ext: '.svg'
    }
};

// 檔案轉換路由
app.post('/api/convert', upload.single('file'), async (req, res) => {
    let inputPath = null;
    let outputPath = null;

    try {
        if (!req.file) {
            return res.status(400).json({ error: '請上傳檔案' });
        }

        const { targetFormat } = req.body;
        if (!targetFormat || !conversionFormats[targetFormat]) {
            return res.status(400).json({ error: '不支援的轉換格式' });
        }

        inputPath = req.file.path;
        outputPath = path.join('/tmp', `${uuidv4()}${conversionFormats[targetFormat].ext}`);

        // 根據檔案類型和目標格式進行轉換
        const inputExt = path.extname(req.file.originalname).toLowerCase();
        const outputExt = conversionFormats[targetFormat].ext;

        try {
            if (inputExt === '.pdf' && outputExt === '.txt') {
                // PDF 轉 TXT
                await execAsync(`pdftotext "${inputPath}" "${outputPath}"`);
            } else if (inputExt === '.txt' && outputExt === '.pdf') {
                // TXT 轉 PDF
                await execAsync(`enscript -p "${outputPath}" "${inputPath}"`);
            } else if (outputExt === '.svg') {
                // 使用 Python 腳本進行圖片轉 SVG
                const pythonScript = path.join(__dirname, 'python', 'vectorize.py');
                await execAsync(`python3 "${pythonScript}" "${inputPath}" "${outputPath}"`);
            } else {
                // 使用 LibreOffice 進行其他格式轉換
                const inputBuffer = fs.readFileSync(inputPath);
                const outputBuffer = await convertAsync(inputBuffer, outputExt, undefined);
                fs.writeFileSync(outputPath, outputBuffer);
            }

            // 發送轉換後的檔案
            res.download(outputPath, `${path.parse(req.file.originalname).name}${outputExt}`, (err) => {
                // 清理臨時檔案
                cleanupFiles(inputPath, outputPath);
                if (err) {
                    console.error('檔案下載錯誤:', err);
                }
            });
        } catch (error) {
            console.error('檔案轉換錯誤:', error);
            res.status(500).json({ error: '檔案轉換失敗' });
            cleanupFiles(inputPath, outputPath);
        }
    } catch (error) {
        console.error('檔案處理錯誤:', error);
        res.status(500).json({ error: '檔案處理失敗' });
        cleanupFiles(inputPath, outputPath);
    }
});

// 清理臨時檔案的輔助函數
function cleanupFiles(inputPath, outputPath) {
    try {
        if (inputPath && fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }
        if (outputPath && fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
    } catch (error) {
        console.error('清理臨時檔案錯誤:', error);
    }
}

// 錯誤處理中間件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || '伺服器錯誤' });
});

// 健康檢查端點
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
