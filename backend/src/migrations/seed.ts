import dotenv from "dotenv";
import bcryptjs from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { queryDatabase, closeDatabase } from "../utils/database";

dotenv.config();

function square(lon: number, lat: number, size = 0.006): number[][][] {
  const ring = [
    [lon, lat],
    [lon + size, lat],
    [lon + size, lat + size],
    [lon, lat + size],
    [lon, lat],
  ];
  return [ring];
}

async function seed() {
  const password = process.env.SEED_PASSWORD || "Test123456!";
  const hash = await bcryptjs.hash(password, 10);

  const users = [
    {
      name: "Ram Prasad Sharma",
      email: "citizen@bhusetu.local",
      role: "CITIZEN",
      wallet: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    },
    {
      name: "Anjali Patel",
      email: "buyer@bhusetu.local",
      role: "CITIZEN",
      wallet: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    },
    {
      name: "Suresh Iyer",
      email: "surveyor@bhusetu.local",
      role: "SURVEYOR",
      wallet: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    },
    {
      name: "Meera Rao, Sub-Registrar",
      email: "registrar@bhusetu.local",
      role: "REGISTRAR",
      wallet:
        process.env.REGISTRAR_ADDRESS ||
        "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    },
  ];

  for (const user of users) {
    await queryDatabase(
      `INSERT INTO users (full_name, email, phone_number, role, password_hash, e_kyc_verified, wallet_address)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         wallet_address = EXCLUDED.wallet_address,
         e_kyc_verified = true`,
      [user.name, user.email, "9999999999", user.role, hash, user.wallet]
    );
    console.log(`Seeded ${user.role}: ${user.email} / ${password}`);
  }

  const ownerRes = await queryDatabase(
    "SELECT id FROM users WHERE email = $1",
    ["citizen@bhusetu.local"]
  );
  const buyerRes = await queryDatabase(
    "SELECT id FROM users WHERE email = $1",
    ["buyer@bhusetu.local"]
  );
  const ownerId = ownerRes.rows[0].id as string;
  const buyerId = buyerRes.rows[0].id as string;

  const parcels = [
    {
      ulpin: "UP-LKO-26-08467-001",
      location: {
        state: "Uttar Pradesh",
        district: "Lucknow",
        taluka: "Sadar",
        village: "Gomti Nagar",
      },
      geometry: square(80.9462, 26.8467),
    },
    {
      ulpin: "RJ-JPR-26-09124-014",
      location: {
        state: "Rajasthan",
        district: "Jaipur",
        taluka: "Sanganer",
        village: "Malviya Nagar",
      },
      geometry: square(75.7873, 26.9124),
    },
    {
      ulpin: "MH-PUN-18-05204-221",
      location: {
        state: "Maharashtra",
        district: "Pune",
        taluka: "Haveli",
        village: "Kothrud",
      },
      geometry: square(73.8567, 18.5204),
    },
    {
      ulpin: "GJ-AMD-23-02250-088",
      location: {
        state: "Gujarat",
        district: "Ahmedabad",
        taluka: "City",
        village: "Navrangpura",
      },
      geometry: square(72.5714, 23.0225, 0.005),
    },
    {
      ulpin: "KA-BLR-12-09716-440",
      location: {
        state: "Karnataka",
        district: "Bengaluru Urban",
        taluka: "Bengaluru North",
        village: "Malleshwaram",
      },
      geometry: square(77.5946, 12.9716, 0.004),
    },
    {
      ulpin: "BR-PAT-25-05941-019",
      location: {
        state: "Bihar",
        district: "Patna",
        taluka: "Patna Sadar",
        village: "Boring Road",
      },
      geometry: square(85.1376, 25.5941, 0.005),
    },
  ];

  for (const parcel of parcels) {
    const existing = await queryDatabase(
      "SELECT id FROM land_parcels WHERE ulpin = $1",
      [parcel.ulpin]
    );
    if (existing.rows.length > 0) {
      console.log(`Parcel exists: ${parcel.ulpin}`);
      continue;
    }

    const geojson = JSON.stringify({
      type: "Polygon",
      coordinates: parcel.geometry,
    });

    await queryDatabase(
      `INSERT INTO land_parcels
       (id, ulpin, owner_id, geometry, area_in_sq_meters, total_value, location)
       VALUES (
         $1, $2, $3,
         ST_SetSRID(ST_GeomFromGeoJSON($4), 4326),
         ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)::geography),
         $5,
         $6::jsonb
       )`,
      [uuidv4(), parcel.ulpin, ownerId, geojson, "0", JSON.stringify(parcel.location)]
    );
    console.log(`Seeded parcel ${parcel.ulpin}`);
  }

  const lucknow = await queryDatabase(
    "SELECT id FROM land_parcels WHERE ulpin = $1",
    ["UP-LKO-26-08467-001"]
  );

  if (lucknow.rows.length > 0) {
    const parcelId = lucknow.rows[0].id as string;
    const open = await queryDatabase(
      `SELECT id FROM transactions
       WHERE parcel_id = $1 AND status NOT IN ('COMPLETED', 'REJECTED', 'CANCELLED')`,
      [parcelId]
    );
    if (open.rows.length === 0) {
      const txId = uuidv4();
      await queryDatabase(
        `INSERT INTO transactions
         (id, parcel_id, buyer_id, seller_id, status, deed_ipfs_cid, multi_sig_tx_hash)
         VALUES ($1, $2, $3, $4, 'LOCKED_IN_ESCROW', $5, $6)`,
        [
          txId,
          parcelId,
          buyerId,
          ownerId,
          "bafybeihsampledeedcidlucknow2026",
          "0xdemo_create_sample_escrow_lock",
        ]
      );
      await queryDatabase(
        `INSERT INTO audit_log (transaction_id, action, actor_id, details)
         VALUES ($1, $2, $3, $4)`,
        [
          txId,
          "TRANSFER_INITIATED",
          ownerId,
          JSON.stringify({ sample: true, city: "Lucknow" }),
        ]
      );
      console.log("Seeded sample escrow transfer for Lucknow parcel");
    }
  }

  await closeDatabase();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
