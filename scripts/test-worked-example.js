#!/usr/bin/env node
/**
 * Runs the assignment worked example end-to-end against the service layer.
 * Usage: node scripts/test-worked-example.js
 * Requires DATABASE_URL and a migrated database (npm run db:seed first).
 */
require('dotenv').config();

const prisma = require('../src/config/prisma');
const payoutService = require('../src/services/payoutService');
const withdrawalService = require('../src/services/withdrawalService');
const { toRupees } = require('../src/utils/money');

async function assertBalance(userId, expectedRupees, label) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const actual = toRupees(user.withdrawableBalancePaise);
  if (actual !== expectedRupees) {
    throw new Error(`${label}: expected ₹${expectedRupees}, got ₹${actual}`);
  }
  console.log(`✓ ${label}: ₹${actual}`);
}

async function main() {
  const john = await prisma.user.findUnique({ where: { email: 'john_doe@example.com' } });
  if (!john) {
    throw new Error('Run npm run db:seed first');
  }

  const sales = await prisma.sale.findMany({
    where: { userId: john.id },
    orderBy: { createdAt: 'asc' },
  });

  if (sales.length !== 3) {
    throw new Error(`Expected 3 sales for john_doe, found ${sales.length}`);
  }

  await assertBalance(john.id, 0, 'Initial balance');

  const batch = await payoutService.runAdvanceBatch();
  console.log('Advance batch:', batch);
  await assertBalance(john.id, 12, 'After advance payout (3 × ₹4)');

  await payoutService.reconcileSale(sales[0].id, 'approved');
  await payoutService.reconcileSale(sales[1].id, 'approved');
  await assertBalance(john.id, 84, 'After approving 2 sales (+₹72)');

  await payoutService.reconcileSale(sales[2].id, 'rejected');
  await assertBalance(john.id, 80, 'After rejecting 1 sale (−₹4 clawback)');

  const withdrawal = await withdrawalService.initiate(john.id, 1200n);
  await assertBalance(john.id, 68, 'After ₹12 withdrawal debit');

  await withdrawalService.settle(withdrawal.id, 'SUCCESS');
  await assertBalance(john.id, 68, 'After successful settlement (balance unchanged)');

  console.log('\nWorked example passed. Final balance: ₹68');
}

main()
  .catch((error) => {
    console.error('FAILED:', error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
