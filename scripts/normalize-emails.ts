import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Normalizing all emails to lowercase...\n");

  // Get all users with emails
  const users = await prisma.user.findMany({
    where: {
      email: { not: null },
    },
    select: {
      id: true,
      email: true,
    },
  });

  let updated = 0;
  for (const user of users) {
    if (user.email) {
      const lowercaseEmail = user.email.toLowerCase();
      if (user.email !== lowercaseEmail) {
        await prisma.user.update({
          where: { id: user.id },
          data: { email: lowercaseEmail },
        });
        console.log(`Updated: ${user.email} -> ${lowercaseEmail}`);
        updated++;
      }
    }
  }

  console.log(`\nDone! Updated ${updated} email(s) out of ${users.length} total users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
