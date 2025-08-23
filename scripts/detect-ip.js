#!/usr/bin/env node
/**
 * Detects the primary LAN IPv4 address and prints it. Optionally writes env files.
 * Usage:
 *   node scripts/detect-ip.js            -> prints IP only
 *   node scripts/detect-ip.js printVar   -> prints export/SET syntax for shell
 */
const os = require('os');

function getLanIPv4() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (!net || net.internal) continue;
      if (net.family === 'IPv4') {
        // Ignore Docker and bridge addresses heuristically
        if (/^docker|^vboxnet|^utun|^lo/.test(name)) continue;
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

const ip = getLanIPv4();
const mode = process.argv[2] || 'plain';

if (mode === 'printVar') {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    // For Windows cmd
    console.log(`set LAN_IP=${ip}`);
  } else {
    // For POSIX shells
    console.log(`export LAN_IP=${ip}`);
  }
} else if (mode === 'json') {
  console.log(JSON.stringify({ ip }));
} else {
  console.log(ip);
}


