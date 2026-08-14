const crypto = require('crypto');

class AnonymousIdGenerator {
  static generate() {
    const randomNumber = crypto.randomInt(10000, 99999);
    return `anony #${randomNumber}`;
  }

  static async generateUnique(checkFunction) {
    let anonymousId = this.generate();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const exists = await checkFunction(anonymousId);
      if (!exists) {
        return anonymousId;
      }
      anonymousId = this.generate();
      attempts++;
    }

    throw new Error('Failed to generate unique anonymous ID');
  }

  static isValid(anonymousId) {
    return /^anony #\d{5}$/.test(anonymousId);
  }
}

module.exports = AnonymousIdGenerator;
