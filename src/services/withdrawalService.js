const prisma = require('../config/prisma');
const { AppError } = require('../utils/errors');
const ledgerService = require('./ledgerService');

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const TERMINAL_WITHDRAWAL_STATUSES = new Set(['SUCCESS', 'FAILED', 'CANCELLED', 'REJECTED']);

async function initiate(userId, amountPaise) {
  if (amountPaise <= 0n) {
    throw new AppError('Withdrawal amount must be positive', 400);
  }

  return prisma.$transaction(async (tx) => {
    const userRows = await tx.$queryRaw`
      SELECT id, withdrawable_balance_paise, last_withdrawal_completed_at
      FROM users
      WHERE id = ${userId}::uuid
      FOR UPDATE
    `;

    const user = userRows[0];
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (amountPaise > user.withdrawable_balance_paise) {
      throw new AppError('Insufficient withdrawable balance', 400);
    }

    if (user.last_withdrawal_completed_at) {
      const elapsed = Date.now() - new Date(user.last_withdrawal_completed_at).getTime();
      if (elapsed < TWENTY_FOUR_HOURS_MS) {
        throw new AppError('Withdrawals are limited to once every 24 hours after a successful payout', 429);
      }
    }

    const withdrawal = await tx.withdrawal.create({
      data: {
        userId,
        amountPaise,
        status: 'PENDING',
      },
    });

    await ledgerService.record(tx, {
      userId,
      saleId: null,
      type: 'WITHDRAWAL_DEBIT',
      amountPaise: -amountPaise,
    });

    return withdrawal;
  });
}

async function settle(withdrawalId, status) {
  if (!['SUCCESS', 'FAILED', 'CANCELLED', 'REJECTED'].includes(status)) {
    throw new AppError("status must be 'SUCCESS', 'FAILED', 'CANCELLED', or 'REJECTED'", 400);
  }

  return prisma.$transaction(async (tx) => {
    const withdrawalRows = await tx.$queryRaw`
      SELECT id, user_id, amount_paise, status
      FROM withdrawals
      WHERE id = ${withdrawalId}::uuid
      FOR UPDATE
    `;

    const withdrawal = withdrawalRows[0];
    if (!withdrawal) {
      throw new AppError('Withdrawal not found', 404);
    }

    if (TERMINAL_WITHDRAWAL_STATUSES.has(withdrawal.status)) {
      const existing = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
      return { withdrawal: existing, idempotent: true };
    }

    if (withdrawal.status !== 'PENDING') {
      throw new AppError('Withdrawal is not in a settleable state', 409);
    }

    if (status === 'SUCCESS') {
      const updated = await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'SUCCESS',
          completedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: withdrawal.user_id },
        data: { lastWithdrawalCompletedAt: new Date() },
      });

      return { withdrawal: updated, idempotent: false };
    }

    await ledgerService.record(tx, {
      userId: withdrawal.user_id,
      saleId: null,
      type: 'WITHDRAWAL_REVERSAL',
      amountPaise: withdrawal.amount_paise,
    });

    const updated = await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status,
        completedAt: new Date(),
      },
    });

    return { withdrawal: updated, idempotent: false };
  });
}

module.exports = {
  initiate,
  settle,
};
