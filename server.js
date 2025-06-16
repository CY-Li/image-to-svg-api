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
const libre = require('libreoffice-convert');
const convertAsync = promisify(libre.convert);

const app = express();

// 安全性設定
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

// 基本中間件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 速率限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分鐘
    max: 100 // 限制每個 IP 100 個請求
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
        cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
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
            'text/plain'
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
    }
};

// 檔案轉換路由
app.post('/api/convert', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '請上傳檔案' });
        }

        const { targetFormat } = req.body;
        if (!targetFormat || !conversionFormats[targetFormat]) {
            return res.status(400).json({ error: '不支援的轉換格式' });
        }

        const inputPath = req.file.path;
        const outputPath = path.join('/tmp', `${uuidv4()}${conversionFormats[targetFormat].ext}`);

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
            } else {
                // 使用 LibreOffice 進行其他格式轉換
                const inputBuffer = fs.readFileSync(inputPath);
                const outputBuffer = await convertAsync(inputBuffer, outputExt, undefined);
                fs.writeFileSync(outputPath, outputBuffer);
            }

            // 發送轉換後的檔案
            res.download(outputPath, `${path.parse(req.file.originalname).name}${outputExt}`, (err) => {
                // 清理臨時檔案
                try {
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                } catch (cleanupError) {
                    console.error('清理臨時檔案錯誤:', cleanupError);
                }
                if (err) {
                    console.error('檔案下載錯誤:', err);
                }
            });
        } catch (error) {
            console.error('檔案轉換錯誤:', error);
            res.status(500).json({ error: '檔案轉換失敗' });
            // 清理臨時檔案
            try {
                fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
            } catch (cleanupError) {
                console.error('清理臨時檔案錯誤:', cleanupError);
            }
        }
    } catch (error) {
        console.error('檔案處理錯誤:', error);
        res.status(500).json({ error: '檔案處理失敗' });
    }
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || '伺服器錯誤' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
