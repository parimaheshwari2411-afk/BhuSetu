import dotenv from "dotenv";
import bcryptjs from "bcryptjs";
import { queryDatabase, closeDatabase } from "../utils/database";

dotenv.config();

async function seed() {
  const password = process.env.SEED_PASSWORD || "Test123456!";
  const hash = await bcryptjs.hash(password, 10);

  const users = [
    {
      name: "Citizen Sharma",
      email: "citizen@bhusetu.local",
      role: "CITIZEN",
      wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    },
    {
      name: "Buyer Patel",
      email: "buyer@bhusetu.local",
      role: "CITIZEN",
      wallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    },
    {
      name: "Surveyor Iyer",
      email: "surveyor@bhusetu.local",
      role: "SURVEYOR",
      wallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    },
    {
      name: "Registrar Rao",
      email: "registrar@bhusetu.local",
      role: "REGISTRAR",
      wallet: process.env.REGISTRAR_ADDRESS || "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    },
  ];

  for (const user of users) {
    await queryDatabase(
      `INSERT INTO users (full_name, email, phone_number, role, password_hash, e_kyc_verified, wallet_address)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       ON CONFLICT (email) DO UPDATE SET wallet_address = EXCLUDED.wallet_address`,
      [user.name, user.email, "9999999999", user.role, hash, user.wallet]
    );
    console.log(`Seeded ${user.role}: ${user.email} / ${password}`);
  }

  await closeDatabase();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
