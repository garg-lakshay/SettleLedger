const PAISE_PER_RUPEE = 100n;

function toPaise(rupees) {
  if (typeof rupees === 'number') {
    if (!Number.isFinite(rupees)) {
      throw new Error('Invalid rupee amount');
    }
    return BigInt(Math.round(rupees * Number(PAISE_PER_RUPEE)));
  }

  if (typeof rupees === 'string') {
    const trimmed = rupees.trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
      throw new Error('Invalid rupee amount format');
    }
    const [whole, fraction = ''] = trimmed.split('.');
    const paddedFraction = `${fraction}00`.slice(0, 2);
    const sign = whole.startsWith('-') ? -1n : 1n;
    const absoluteWhole = whole.replace('-', '');
    return sign * (BigInt(absoluteWhole) * PAISE_PER_RUPEE + BigInt(paddedFraction));
  }

  throw new Error('Rupees must be a number or string');
}

function toRupees(paise) {
  const value = typeof paise === 'bigint' ? paise : BigInt(paise);
  const sign = value < 0n ? -1 : 1;
  const absolute = value < 0n ? -value : value;
  const rupees = Number(absolute / PAISE_PER_RUPEE);
  const remainder = Number(absolute % PAISE_PER_RUPEE);
  const result = rupees + remainder / Number(PAISE_PER_RUPEE);
  return sign * result;
}

function percentOf(amountPaise, percent) {
  const basisPoints = BigInt(Math.round(percent * 100));
  return (amountPaise * basisPoints) / 10000n;
}

function floorPercent(amountPaise, percent) {
  const basisPoints = BigInt(Math.floor(percent * 100));
  return (amountPaise * basisPoints) / 10000n;
}

module.exports = {
  PAISE_PER_RUPEE,
  toPaise,
  toRupees,
  percentOf,
  floorPercent,
};
