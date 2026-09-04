import { FormEvent, useEffect, useMemo, useState } from "react";
import { createParcel, fetchParcels, fetchParcelsSpatial } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

type ParcelRow = {
  id: string;
  ulpin: string;
  ownerId: string;
  areaInSqMeters: number;
  location?: { village?: string; district?: string; state?: string };
};

function project(lon: number, lat: number) {
  const x = ((lon - 68) / (98 - 68)) * 320;
  const y = ((37 - lat) / (37 - 6)) * 320;
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}

export default function RegistryPanel() {
  const { user } = useAuth();
  const [parcels, setParcels] = useState<ParcelRow[]>([]);
  const [features, setFeatures] = useState<Array<{ id: string; coordinates: number[][][]; ulpin: string }>>([]);
  const [message, setMessage] = useState("");
  const [ulpin, setUlpin] = useState("UP-LKO-2026-001");
  const [coords, setCoords] = useState("80.90,26.84;80.92,26.84;80.92,26.86;80.90,26.86;80.90,26.84");

  async function refresh() {
    try {
      const list = await fetchParcels();
      setParcels(list.data || []);
      const spatial = await fetchParcelsSpatial();
      setFeatures(
        (spatial.features || []).map((f) => ({
          id: String(f.id),
          ulpin: String(f.properties?.ulpin || ""),
          coordinates: f.geometry.coordinates,
        }))
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load parcels. Is the API running?");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const paths = useMemo(
    () =>
      features.map((feature) => {
        const ring = feature.coordinates[0] || [];
        return {
          id: feature.id,
          ulpin: feature.ulpin,
          d: ring.map(([lon, lat]) => project(lon, lat)).join(" L "),
        };
      }),
    [features]
  );

  async function onRegister(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      setMessage("Sign in as CITIZEN or SURVEYOR to register a parcel.");
      return;
    }
    setMessage("");
    const ring = coords.split(";").map((pair) => pair.split(",").map((n) => Number(n.trim())));
    try {
      await createParcel({
        ulpin,
        location: { state: "Uttar Pradesh", district: "Lucknow", taluka: "Sadar", village: "Gomti Nagar" },
        geometry: { type: "Polygon", coordinates: [ring] },
        totalValue: "0",
      });
      setMessage("Parcel registered after PostGIS ST_IsValid + ST_Intersects checks.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed");
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-5 mb-5">
      <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-[#154360] text-white text-sm font-semibold">Live cadastral parcels (GeoJSON)</div>
        <div className="bg-[#e8f4e8] min-h-[360px] p-3">
          <svg viewBox="0 0 320 320" className="w-full h-[340px] bg-white/40 border border-[#d0d5dd]">
            {paths.map((p) => (
              <path
                key={p.id}
                d={p.d ? `M ${p.d} Z` : ""}
                fill="#2563eb55"
                stroke="#154360"
                strokeWidth="1.2"
              />
            ))}
          </svg>
        </div>
        <div className="px-3 py-2 text-xs text-[#5a6680] bg-[#f8f9fa] border-t">
          GET /api/v1/parcels/spatial · CRS EPSG:4326 · overlap blocked by ST_Intersects
        </div>
      </div>
      <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-[#154360] text-white text-sm font-semibold">Register ULPIN parcel</div>
        <form onSubmit={onRegister} className="p-4 space-y-3 text-xs">
          <label className="block text-[#5a6680]">ULPIN
            <input value={ulpin} onChange={(e) => setUlpin(e.target.value)} className="mt-1 w-full border px-2 py-1.5 font-mono" />
          </label>
          <label className="block text-[#5a6680]">Polygon lon,lat rings (closed)
            <textarea value={coords} onChange={(e) => setCoords(e.target.value)} rows={3} className="mt-1 w-full border px-2 py-1.5 font-mono" />
          </label>
          <button className="w-full py-2 bg-[#154360] text-white font-semibold">Validate & save</button>
          {message && <p className="text-[#78350f] bg-[#fffbeb] border border-[#f5a623]/40 p-2">{message}</p>}
        </form>
        <table className="w-full text-xs border-t">
          <thead>
            <tr className="bg-[#eef2f8] text-[#154360]">
              <th className="text-left px-3 py-2">ULPIN</th>
              <th className="text-left px-3 py-2">Area m²</th>
              <th className="text-left px-3 py-2">Village</th>
            </tr>
          </thead>
          <tbody>
            {parcels.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2 font-mono">{p.ulpin}</td>
                <td className="px-3 py-2 font-mono">{Number(p.areaInSqMeters).toFixed(1)}</td>
                <td className="px-3 py-2">{p.location?.village || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
