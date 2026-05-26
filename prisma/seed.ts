import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: "org_merchflow_demo" },
    update: {},
    create: {
      id: "org_merchflow_demo",
      name: "Merlion Retail Group",
      country: "SG",
      currency: "SGD",
    },
  });

  const orchard = await prisma.store.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "ORCHARD",
      },
    },
    update: {},
    create: {
      id: "store_orchard",
      organizationId: organization.id,
      name: "Orchard Central",
      code: "ORCHARD",
      address: "181 Orchard Road, Singapore",
    },
  });

  const klcc = await prisma.store.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "KLCC",
      },
    },
    update: {},
    create: {
      id: "store_klcc",
      organizationId: organization.id,
      name: "KLCC Pop-up",
      code: "KLCC",
      address: "Kuala Lumpur City Centre, Malaysia",
    },
  });

  const ownerUser = await prisma.user.upsert({
    where: { email: "owner@merlion.example" },
    update: {},
    create: {
      id: "user_owner",
      email: "owner@merlion.example",
      name: "Alicia Owner",
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: "manager@merlion.example" },
    update: {},
    create: {
      id: "user_manager",
      email: "manager@merlion.example",
      name: "Marcus Manager",
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { email: "staff@merlion.example" },
    update: {},
    create: {
      id: "user_staff",
      email: "staff@merlion.example",
      name: "Siti Staff",
    },
  });

  const ownerMembership = await prisma.organizationMembership.upsert({
    where: { userId: ownerUser.id },
    update: {},
    create: {
      id: "membership_owner",
      organizationId: organization.id,
      userId: ownerUser.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const managerMembership = await prisma.organizationMembership.upsert({
    where: { userId: managerUser.id },
    update: {},
    create: {
      id: "membership_manager",
      organizationId: organization.id,
      userId: managerUser.id,
      role: "MANAGER",
      status: "ACTIVE",
    },
  });

  const staffMembership = await prisma.organizationMembership.upsert({
    where: { userId: staffUser.id },
    update: {},
    create: {
      id: "membership_staff",
      organizationId: organization.id,
      userId: staffUser.id,
      role: "STAFF",
      status: "ACTIVE",
    },
  });

  await prisma.storeAssignment.upsert({
    where: {
      membershipId_storeId: {
        membershipId: managerMembership.id,
        storeId: orchard.id,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      membershipId: managerMembership.id,
      storeId: orchard.id,
    },
  });

  await prisma.storeAssignment.upsert({
    where: {
      membershipId_storeId: {
        membershipId: staffMembership.id,
        storeId: orchard.id,
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      membershipId: staffMembership.id,
      storeId: orchard.id,
    },
  });

  const product = await prisma.product.upsert({
    where: { id: "product_tshirt" },
    update: {},
    create: {
      id: "product_tshirt",
      organizationId: organization.id,
      name: "Classic T-Shirt",
      description: "Core cotton tee for demo sales",
    },
  });

  const blackMedium = await prisma.sku.upsert({
    where: {
      organizationId_barcode: {
        organizationId: organization.id,
        barcode: "9555000000012",
      },
    },
    update: {},
    create: {
      id: "sku_tshirt_black_m",
      organizationId: organization.id,
      productId: product.id,
      name: "Classic T-Shirt / Black / M",
      barcode: "9555000000012",
      priceAmount: 1299,
      costAmount: 600,
    },
  });

  await prisma.inventoryBalance.upsert({
    where: {
      organizationId_storeId_skuId: {
        organizationId: organization.id,
        storeId: orchard.id,
        skuId: blackMedium.id,
      },
    },
    update: {
      quantityOnHand: 24,
      lowStockThreshold: 5,
    },
    create: {
      organizationId: organization.id,
      storeId: orchard.id,
      skuId: blackMedium.id,
      quantityOnHand: 24,
      lowStockThreshold: 5,
    },
  });

  await prisma.inventoryBalance.upsert({
    where: {
      organizationId_storeId_skuId: {
        organizationId: organization.id,
        storeId: klcc.id,
        skuId: blackMedium.id,
      },
    },
    update: {
      quantityOnHand: 8,
      lowStockThreshold: 5,
    },
    create: {
      organizationId: organization.id,
      storeId: klcc.id,
      skuId: blackMedium.id,
      quantityOnHand: 8,
      lowStockThreshold: 5,
    },
  });

  console.log(
    `Seeded ${organization.name} with owner membership ${ownerMembership.id}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
