const { toRupees } = require('../utils/money');

function serializeLedgerEntry(entry) {
  return {
    id: entry.id,
    userId: entry.userId,
    saleId: entry.saleId,
    type: entry.type,
    amountRupees: toRupees(entry.amountPaise),
    balanceAfterRupees: toRupees(entry.balanceAfterPaise),
    createdAt: entry.createdAt,
  };
}

function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    withdrawableBalanceRupees: toRupees(user.withdrawableBalancePaise),
    lastWithdrawalCompletedAt: user.lastWithdrawalCompletedAt,
    createdAt: user.createdAt,
  };
}

function serializeSale(sale) {
  return {
    id: sale.id,
    userId: sale.userId,
    brandId: sale.brandId,
    earningRupees: toRupees(sale.earningPaise),
    status: sale.status,
    advancePaid: sale.advancePaid,
    advanceAmountRupees: toRupees(sale.advanceAmountPaise),
    createdAt: sale.createdAt,
    reconciledAt: sale.reconciledAt,
    brand: sale.brand ? { id: sale.brand.id, name: sale.brand.name } : undefined,
  };
}

function serializeWithdrawal(withdrawal) {
  return {
    id: withdrawal.id,
    userId: withdrawal.userId,
    amountRupees: toRupees(withdrawal.amountPaise),
    status: withdrawal.status,
    requestedAt: withdrawal.requestedAt,
    completedAt: withdrawal.completedAt,
    externalRef: withdrawal.externalRef,
  };
}

module.exports = {
  serializeLedgerEntry,
  serializeUser,
  serializeSale,
  serializeWithdrawal,
};
