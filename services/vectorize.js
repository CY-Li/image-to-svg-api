const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function vectorizeImage(inputPath, outputPath, params) {
    // 組合參數
    let args = '';
    if (params.bgSensitivity) args += ` --bg-sensitivity ${params.bgSensitivity}`;
    if (params.denoise) args += ` --denoise ${params.denoise}`;
    if (params.contrast) args += ` --contrast ${params.contrast}`;
    if (params.sharpen) args += ` --sharpen ${params.sharpen}`;
    if (params.posterize) args += ` --posterize ${params.posterize}`;
    if (params.threshold) args += ` --threshold ${params.threshold}`;
    if (params.svgColor) args += ` --svg-color ${params.svgColor}`;
    const cmd = `python3 vectorize.py "${inputPath}" "${outputPath}"${args}`;
    await execAsync(cmd);
}

module.exports = { vectorizeImage }; 