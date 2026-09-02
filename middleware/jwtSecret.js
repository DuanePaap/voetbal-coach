'use strict';

// Lazy — thrown only when a token is actually signed/verified, not at require time,
// so a missing env var doesn't crash server.js before routes are registered.
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is niet ingesteld. Zet JWT_SECRET in je .env bestand.');
  }
  return secret;
}

module.exports = { getJwtSecret };
