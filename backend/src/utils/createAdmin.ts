import bcrypt from "bcryptjs";
import { PrismaClient, UserRole } from "../generated/prisma";

const prisma = new PrismaClient();

// ===========================================
//            ADMIN CREATION SCRIPT
// ===========================================

// Script per creare il primo utente ADMIN
// Uso: npm run create-admin

async function createFirstAdmin() {
  try {
    console.log("🔧 Creating first admin user...");

    // ===========================================
    //              ADMIN DATA
    // ===========================================

    // DATI ADMIN
    const adminData = {
      email: "admin@tuosito.com",
      password: "Admin123!",
      firstName: "Admin",
      lastName: "User",
    };

    // ===========================================
    //          EXISTENCE CHECKS
    // ===========================================

    // CONTROLLO SE ESISTE GIÀ UN ADMIN
    const existingAdmin = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
    });

    if (existingAdmin) {
      console.log("✅ Admin user already exists:", existingAdmin.email);
      return;
    }

    // CONTROLLO SE ESISTE COME USER NORMALE
    const existingUser = await prisma.user.findUnique({
      where: { email: adminData.email.toLowerCase() },
    });

    if (existingUser) {
      console.log("🔄 Email exists as USER, promoting to ADMIN...");

      // SE ESISTE PROMUOVIAMOLO AD ADMIN
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

    // ===========================================
    //          CREATE NEW ADMIN
    // ===========================================

    // CREAZIONE NUOVO ADMIN
    const hashedPassword = await bcrypt.hash(adminData.password, 12);

    const newAdmin = await prisma.user.create({
      data: {
        email: adminData.email.toLowerCase(),
        password: hashedPassword,
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        role: UserRole.ADMIN,
        emailVerified: true, // Admin email pre-verificata
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

    // ===========================================
    //            SUCCESS OUTPUT
    // ===========================================

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

// ===========================================
//            SCRIPT EXECUTION
// ===========================================

// ESECUZIONE SCRIPT PER CREAZIONE ADMIN
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
