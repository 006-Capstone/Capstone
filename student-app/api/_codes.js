// In-memory store for verification codes as fallback/local cache
const verificationCodes = new Map();

module.exports = {
  verificationCodes
};
module.exports.default = verificationCodes;
