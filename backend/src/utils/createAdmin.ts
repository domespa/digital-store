import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "../generated/prisma";

const prisma = new PrismaClient();

// Script per creare il primo utente ADMIN
// Uso: npm run create-admin

async function createFirstAdmin() {
  try {
    console.log("🔧 Creating first admin user...");

    // DATI ADMIN
    const adminData = {
      email: "admin@tuosito.com",
      password: "Admin123!",
      firstName: "Admin",
      lastName: "User",
    };

    // CONTROLLO SE ESISTE
    const existingAdmin = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
    });

    if (existingAdmin) {
      console.log("✅ Admin user already exists:", existingAdmin.email);
      return;
    }

    // CONTROLLO SE ESISTE COME USER
    const existingUser = await prisma.user.findUnique({
      where: { email: adminData.email.toLowerCase() },
    });

    if (existingUser) {
      console.log("🔄 Email exists as USER, promoting to ADMIN...");

      // SE ESISTE PROMUOVIAMOLO
      const promotedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: UserRole.ADMIN },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      console.log("✅ User promoted to ADMIN:", promotedUser);
      return promotedUser;
    }

    // CREAZIONE NUVO ADMIN
    const hashedPassword = await bcrypt.hash(adminData.password, 12);

    const newAdmin = await prisma.user.create({
      data: {
        email: adminData.email.toLowerCase(),
        password: hashedPassword,
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        role: UserRole.ADMIN,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    console.log("✅ First admin created successfully:");
    console.log(`📧 Email: ${newAdmin.email}`);
    console.log(`👤 Name: ${newAdmin.firstName} ${newAdmin.lastName}`);
    console.log(`🔑 Role: ${newAdmin.role}`);
    console.log(`📅 Created: ${newAdmin.createdAt}`);
    console.log("");
    console.log("🔐 Login credentials:");
    console.log(`Email: ${adminData.email}`);
    console.log(`Password: ${adminData.password}`);
    console.log("");
    console.log("⚠️  IMPORTANT: Change the password after first login!");

    return newAdmin;
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ESECUZIONE SCRIPT PER CREAZIONE
if (require.main === module) {
  createFirstAdmin()
    .then(() => {
      console.log("✅ Script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}

export { createFirstAdmin };
