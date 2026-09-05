function ring(lon: number, lat: number, size = 0.006): number[][][] {
  return [[
    [lon, lat],
    [lon + size, lat],
    [lon + size, lat + size],
    [lon, lat + size],
    [lon, lat],
  ]];
}

export const SAMPLE_USERS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    fullName: "Ram Prasad Sharma",
    email: "citizen@bhusetu.local",
    role: "CITIZEN",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    fullName: "Anjali Patel",
    email: "buyer@bhusetu.local",
    role: "CITIZEN",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    fullName: "Meera Rao, Sub-Registrar",
    email: "registrar@bhusetu.local",
    role: "REGISTRAR",
  },
];

export const SAMPLE_PARCELS = [
  {
    id: "aaaaaaa1-0000-0000-0000-000000000001",
    ulpin: "UP-LKO-26-08467-001",
    ownerId: SAMPLE_USERS[0].id,
    ownerName: SAMPLE_USERS[0].fullName,
    geometry: { type: "Polygon" as const, coordinates: ring(80.9462, 26.8467) },
    areaInSqMeters: 312400,
    totalValue: "0",
    location: {
      state: "Uttar Pradesh",
      district: "Lucknow",
      taluka: "Sadar",
      village: "Gomti Nagar",
    },
    documentIpfsCid: null,
    blockchainHash: null,
    createdAt: new Date("2026-01-12"),
    updatedAt: new Date("2026-01-12"),
  },
  {
    id: "aaaaaaa1-0000-0000-0000-000000000002",
    ulpin: "RJ-JPR-26-09124-014",
    ownerId: SAMPLE_USERS[0].id,
    ownerName: SAMPLE_USERS[0].fullName,
    geometry: { type: "Polygon" as const, coordinates: ring(75.7873, 26.9124) },
    areaInSqMeters: 298100,
    totalValue: "0",
    location: {
      state: "Rajasthan",
      district: "Jaipur",
      taluka: "Sanganer",
      village: "Malviya Nagar",
    },
    documentIpfsCid: null,
    blockchainHash: null,
    createdAt: new Date("2026-02-03"),
    updatedAt: new Date("2026-02-03"),
  },
  {
    id: "aaaaaaa1-0000-0000-0000-000000000003",
    ulpin: "MH-PUN-18-05204-221",
    ownerId: SAMPLE_USERS[0].id,
    ownerName: SAMPLE_USERS[0].fullName,
    geometry: { type: "Polygon" as const, coordinates: ring(73.8567, 18.5204) },
    areaInSqMeters: 276800,
    totalValue: "0",
    location: {
      state: "Maharashtra",
      district: "Pune",
      taluka: "Haveli",
      village: "Kothrud",
    },
    documentIpfsCid: null,
    blockchainHash: null,
    createdAt: new Date("2026-03-18"),
    updatedAt: new Date("2026-03-18"),
  },
  {
    id: "aaaaaaa1-0000-0000-0000-000000000004",
    ulpin: "GJ-AMD-23-02250-088",
    ownerId: SAMPLE_USERS[0].id,
    ownerName: SAMPLE_USERS[0].fullName,
    geometry: { type: "Polygon" as const, coordinates: ring(72.5714, 23.0225, 0.005) },
    areaInSqMeters: 241000,
    totalValue: "0",
    location: {
      state: "Gujarat",
      district: "Ahmedabad",
      taluka: "City",
      village: "Navrangpura",
    },
    documentIpfsCid: null,
    blockchainHash: null,
    createdAt: new Date("2026-04-09"),
    updatedAt: new Date("2026-04-09"),
  },
  {
    id: "aaaaaaa1-0000-0000-0000-000000000005",
    ulpin: "KA-BLR-12-09716-440",
    ownerId: SAMPLE_USERS[0].id,
    ownerName: SAMPLE_USERS[0].fullName,
    geometry: { type: "Polygon" as const, coordinates: ring(77.5946, 12.9716, 0.004) },
    areaInSqMeters: 198400,
    totalValue: "0",
    location: {
      state: "Karnataka",
      district: "Bengaluru Urban",
      taluka: "Bengaluru North",
      village: "Malleshwaram",
    },
    documentIpfsCid: null,
    blockchainHash: null,
    createdAt: new Date("2026-05-21"),
    updatedAt: new Date("2026-05-21"),
  },
  {
    id: "aaaaaaa1-0000-0000-0000-000000000006",
    ulpin: "BR-PAT-25-05941-019",
    ownerId: SAMPLE_USERS[0].id,
    ownerName: SAMPLE_USERS[0].fullName,
    geometry: { type: "Polygon" as const, coordinates: ring(85.1376, 25.5941, 0.005) },
    areaInSqMeters: 219700,
    totalValue: "0",
    location: {
      state: "Bihar",
      district: "Patna",
      taluka: "Patna Sadar",
      village: "Boring Road",
    },
    documentIpfsCid: null,
    blockchainHash: null,
    createdAt: new Date("2026-06-02"),
    updatedAt: new Date("2026-06-02"),
  },
];

export const SAMPLE_TRANSFERS = [
  {
    id: "bbbbbbb1-0000-0000-0000-000000000001",
    parcelId: SAMPLE_PARCELS[0].id,
    buyerId: SAMPLE_USERS[1].id,
    sellerId: SAMPLE_USERS[0].id,
    status: "LOCKED_IN_ESCROW",
    deedIpfsCid: "bafybeihsampledeedcidlucknow2026",
    multiSigContractAddress: "0x0000000000000000000000000000000000000000",
    multiSigTxHash: "0xdemo_create_sample_escrow_lock",
    buyerApprovedAt: null,
    sellerApprovedAt: null,
    registrarApprovedAt: null,
    completedAt: null,
    createdAt: new Date("2026-08-20"),
    updatedAt: new Date("2026-08-20"),
  },
];

export function sampleParcelsGeoJSON(state?: string, city?: string) {
  const filtered = SAMPLE_PARCELS.filter((p) => {
    if (state && p.location.state !== state) return false;
    if (city && p.location.district !== city && p.location.village !== city) return false;
    return true;
  });

  return {
    type: "FeatureCollection",
    features: filtered.map((p) => ({
      type: "Feature",
      id: p.id,
      properties: {
        ulpin: p.ulpin,
        owner_id: p.ownerId,
        area_sq_meters: p.areaInSqMeters,
        location: p.location,
      },
      geometry: p.geometry,
    })),
  };
}

export function isDatabaseUnavailable(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  const text = `${err.code || ""} ${err.message || ""}`;
  return /28P01|ECONNREFUSED|ECONNRESET|ENOTFOUND|57P01|3D000|password authentication failed|connect ECONNREFUSED/i.test(
    text
  );
}
