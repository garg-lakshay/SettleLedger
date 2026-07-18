const prisma = require('../config/prisma');
const { AppError } = require('../utils/errors');
const { floorPercent } = require('../utils/money');
const ledgerService = require('./ledgerService');

async function runAdvanceBatch() {
  const eligibleSales = await prisma.sale.findMany({
    where: {
      status: 'pending',
      advancePaid: false,
    },
    select: { id: true },
  });

  const results = {
    processed: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  for (const { id: saleId } of eligibleSales) {
    try {
      const outcome = await prisma.$transaction(async (tx) => {
        const saleRows = await tx.$queryRaw`
          SELECT id, user_id, earning_paise, advance_paid
          FROM sales
          WHERE id = ${saleId}::uuid
          FOR UPDATE
        `;

        const sale = saleRows[0];
        if (!sale || sale.advance_paid) {
          return { status: 'skipped' };
        }

        const advance = floorPercent(sale.earning_paise, 10);

        await ledgerService.record(tx, {
          userId: sale.user_id,
          saleId: sale.id,
          type: 'ADVANCE_PAYOUT',
          amountPaise: advance,
        });

        await tx.sale.update({
          where: { id: sale.id },
          data: {
            advancePaid: true,
            advanceAmountPaise: advance,
          },
        });

        return { status: 'processed', advancePaise: advance };
      });

      if (outcome.status === 'processed') {
        results.processed += 1;
        results.details.push({ saleId, status: 'processed', advancePaise: outcome.advancePaise.toString() });
      } else {
        results.skipped += 1;
        results.details.push({ saleId, status: 'skipped' });
      }
    } catch (error) {
      results.failed += 1;
      results.details.push({ saleId, status: 'failed', error: error.message });
    }
  }

  return results;
}

async function reconcileSale(saleId, status) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new AppError("status must be 'approved' or 'rejected'", 400);
  }

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id: saleId } });

    if (!sale) {
      throw new AppError('Sale not found', 404);
    }

    if (sale.status !== 'pending') {
      throw new AppError('Sale has already been reconciled', 409);
    }

    let adjustment;
    let ledgerType;

    if (status === 'approved') {
      adjustment = sale.earningPaise - sale.advanceAmountPaise;
      ledgerType = 'ADJUSTMENT_APPROVED';
    } else {
      adjustment = -sale.advanceAmountPaise;
      ledgerType = 'ADJUSTMENT_REJECTED';
    }

    await ledgerService.record(tx, {
      userId: sale.userId,
      saleId: sale.id,
      type: ledgerType,
      amountPaise: adjustment,
    });

    const updatedSale = await tx.sale.update({
      where: { id: saleId },
      data: {
        status,
        reconciledAt: new Date(),
      },
      include: { brand: true },
    });

    const updatedUser = await tx.user.findUnique({
      where: { id: sale.userId },
      select: { withdrawableBalancePaise: true },
    });

    return {
      sale: updatedSale,
      finalPayoutPaise: adjustment,
      newWithdrawableBalancePaise: updatedUser.withdrawableBalancePaise,
    };
  });
}

module.exports = {
  runAdvanceBatch,
  reconcileSale,
};
