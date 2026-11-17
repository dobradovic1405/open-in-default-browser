const path = require('path');
const crypto = require('crypto');

// Pure helpers for file paths. No dependency on VS Code, so they can be unit tested.

function isInside(child, parent) {
  return child === parent || child.startsWith(parent + path.sep);
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Short, stable id for a folder, used in the URL. */
function folderId(dir) {
  return crypto.createHash('sha1').update(dir).digest('hex').slice(0, 12);
}

module.exports = { isInside, safeDecode, folderId };
