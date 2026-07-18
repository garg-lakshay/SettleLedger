const { PrismaClient } = require('@prisma/client');
const { toPaise } = require('../src/utils/money');

const prisma = new PrismaClient();

async function main() {
  await prisma.ledgerEntry.deleteMany();
  await prisma.withdrawal.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.user.deleteMany();
  await prisma.brand.deleteMany();

  const brands = await Promise.all([
    prisma.brand.create({ data: { name: 'Nike' } }),
    prisma.brand.create({ data: { name: 'Adidas' } }),
    prisma.brand.create({ data: { name: 'Puma' } }),
  ]);

  const johnDoe = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'john_doe@example.com',
    },
  });

  const janeSmith = await prisma.user.create({
    data: {
      name: 'Jane Smith',
      email: 'jane_smith@example.com',
    },
  });

  const earningPaise = toPaise(40);

  await prisma.sale.createMany({
    data: [
      { userId: johnDoe.id, brandId: brands[0].id, earningPaise },
      { userId: johnDoe.id, brandId: brands[1].id, earningPaise },
      { userId: johnDoe.id, brandId: brands[2].id, earningPaise },
      { userId: janeSmith.id, brandId: brands[0].id, earningPaise: toPaise(100) },
    ],
  });

  console.log('Seed complete.');
  console.log('Brands:', brands.map((b) => ({ id: b.id, name: b.name })));
  console.log('Users:', [
    { id: johnDoe.id, email: johnDoe.email },
    { id: janeSmith.id, email: janeSmith.email },
  ]);
  console.log('\nWorked example (john_doe):');
  console.log('1. POST /api/payouts/advance/run');
  console.log('2. Approve 2 sales, reject 1 sale via reconcile');
  console.log('3. POST /api/withdrawals { amountRupees: 12 }');
  console.log('4. POST /api/withdrawals/:id/settle { status: "SUCCESS" }');
  console.log('Expected final balance: ₹68');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
