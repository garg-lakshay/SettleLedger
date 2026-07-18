const prisma = require('../config/prisma');

async function record(tx, { userId, saleId = null, type, amountPaise }) {
  const user = await tx.user.update({
    where: { id: userId },
    data: {
      withdrawableBalancePaise: {
        increment: amountPaise,
      },
    },
  });

  const entry = await tx.ledgerEntry.create({
    data: {
      userId,
      saleId,
      type,
      amountPaise,
      balanceAfterPaise: user.withdrawableBalancePaise,
    },
  });

  return { entry, user };
}

module.exports = { record };
