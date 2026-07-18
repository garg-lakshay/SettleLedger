const prisma = require('../config/prisma');
const { AppError } = require('../utils/errors');
const { toPaise, toRupees } = require('../utils/money');
const { serializeUser, serializeSale, serializeLedgerEntry, serializeWithdrawal } = require('../utils/serialize');
const payoutService = require('../services/payoutService');
const withdrawalService = require('../services/withdrawalService');

async function createBrand(req, res) {
  const { name } = req.body;
  if (!name) {
    throw new AppError('name is required', 400);
  }

  const brand = await prisma.brand.create({ data: { name } });
  res.status(201).json(brand);
}

async function createUser(req, res) {
  const { name, email } = req.body;
  if (!name || !email) {
    throw new AppError('name and email are required', 400);
  }

  const user = await prisma.user.create({ data: { name, email } });
  res.status(201).json(serializeUser(user));
}

async function createSale(req, res) {
  const { userId, brandId, earningRupees } = req.body;
  if (!userId || !brandId || earningRupees === undefined) {
    throw new AppError('userId, brandId, and earningRupees are required', 400);
  }

  const earningPaise = toPaise(earningRupees);
  if (earningPaise <= 0n) {
    throw new AppError('earningRupees must be positive', 400);
  }

  const sale = await prisma.sale.create({
    data: {
      userId,
      brandId,
      earningPaise,
    },
    include: { brand: true },
  });

  res.status(201).json(serializeSale(sale));
}

async function listSales(req, res) {
  const { userId } = req.query;
  if (!userId) {
    throw new AppError('userId query parameter is required', 400);
  }

  const sales = await prisma.sale.findMany({
    where: { userId },
    include: { brand: true },
    orderBy: { createdAt: 'asc' },
  });

  res.json(sales.map(serializeSale));
}

async function runAdvancePayout(req, res) {
  const result = await payoutService.runAdvanceBatch();
  res.json(result);
}

async function reconcileSale(req, res) {
  const { saleId } = req.params;
  const { status } = req.body;

  const { sale, finalPayoutPaise, newWithdrawableBalancePaise } = await payoutService.reconcileSale(saleId, status);
  res.json({
    sale: serializeSale(sale),
    finalPayoutRupees: toRupees(finalPayoutPaise),
    newWithdrawableBalanceRupees: toRupees(newWithdrawableBalancePaise),
  });
}

async function getBalance(req, res) {
  const { userId } = req.params;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    userId: user.id,
    withdrawableBalanceRupees: toRupees(user.withdrawableBalancePaise),
  });
}

async function getLedger(req, res) {
  const { userId } = req.params;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  res.json(entries.map(serializeLedgerEntry));
}

async function createWithdrawal(req, res) {
  const { userId, amountRupees } = req.body;
  if (!userId || amountRupees === undefined) {
    throw new AppError('userId and amountRupees are required', 400);
  }

  const amountPaise = toPaise(amountRupees);
  const withdrawal = await withdrawalService.initiate(userId, amountPaise);
  res.status(201).json(serializeWithdrawal(withdrawal));
}

async function settleWithdrawal(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const { withdrawal, idempotent } = await withdrawalService.settle(id, status);
  res.status(200).json({
    ...serializeWithdrawal(withdrawal),
    idempotent: Boolean(idempotent),
  });
}

module.exports = {
  createBrand,
  createUser,
  createSale,
  listSales,
  runAdvancePayout,
  reconcileSale,
  getBalance,
  getLedger,
  createWithdrawal,
  settleWithdrawal,
};
