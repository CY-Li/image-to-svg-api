const libre = require('libreoffice-convert');
const util = require('util');
const libreConvert = util.promisify(libre.convert);

async function convertFile(inputBuf, outputExt) {
    return await libreConvert(inputBuf, outputExt, undefined);
}

module.exports = { convertFile }; 