// The browser for the UI checks: the one installed for them where it is there, else the one Playwright finds itself.
const fs = require('fs');
const OLD = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
module.exports = fs.existsSync(OLD) ? OLD : undefined;
