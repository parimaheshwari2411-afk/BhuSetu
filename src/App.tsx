import { useEffect, useState } from "react";
import AuthProvider, { useAuth } from "./lib/AuthContext";
import AuthBar from "./components/AuthBar";
import RegistryPanel from "./components/RegistryPanel";
import TransferPanel from "./components/TransferPanel";
import RegistrarPanel from "./components/RegistrarPanel";
import BlockchainPanel from "./components/BlockchainPanel";
import { fetchAdminStats, fetchParcels, fetchTransfers } from "./lib/api";

function TricolorBar() {
  return (
    <div className="flex w-full h-1.5">
      <div className="flex-1 bg-[#FF9933]" />
      <div className="flex-1 bg-white" />
      <div className="flex-1 bg-[#138808]" />
    </div>
  );
}

type Tab = "home" | "registry" | "transfer" | "registrar" | "chain";

function Shell() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("home");
  const [stats, setStats] = useState({ parcels: 0, transfers: 0, completed: 0 });

  useEffect(() => {
    void (async () => {
      try {
        const [p, t] = await Promise.all([fetchParcels(), fetchTransfers()]);
        setStats({
          parcels: p.pagination?.total ?? p.data?.length ?? 0,
          transfers: t.pagination?.total ?? t.data?.length ?? 0,
          completed: (t.data || []).filter((row: { status: string }) => row.status === "COMPLETED").length,
        });
        if (user?.role === "REGISTRAR") {
          const admin = await fetchAdminStats();
          setStats((s) => ({
            ...s,
            parcels: admin.data?.parcels?.total ?? s.parcels,
            completed: admin.data?.transfers?.completed ?? s.completed,
          }));
        }
      } catch {
        /* API optional on first paint */
      }
    })();
  }, [user, tab]);

  const nav: Array<{ id: Tab; label: string }> = [
    { id: "home", label: "Home" },
    { id: "registry", label: "Land registry" },
    { id: "transfer", label: "Transfers" },
    { id: "chain", label: "Blockchain" },
    { id: "registrar", label: "Registrar" },
  ];

  return (
    <div className="min-h-full bg-[#f0f2f5]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="bg-[#2b2b2b] text-white text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex justify-between">
          <span className="text-white/60">Ministry of Rural Development · Digital India Land Records</span>
          <span className="text-white/50">BhuSetu registry API /api/v1</span>
        </div>
      </div>
      <TricolorBar />
      <header className="bg-[#154360]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-[#f5a623] text-xs font-semibold uppercase tracking-widest">
              Government of India
            </div>
            <div className="text-white text-xl font-black">BhuSetu | भूसेतु</div>
            <div className="text-white/55 text-xs">Hybrid GIS land title registry · PostGIS · IPFS · multi-sig escrow</div>
          </div>
          <AuthBar />
        </div>
      </header>
      <nav className="bg-[#1a5276] border-b-2 border-[#f5a623] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap">
          {nav.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                tab === item.id ? "border-[#f5a623] text-[#f5a623]" : "border-transparent text-white/75 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-5">
        {tab === "home" && (
          <>
            <div className="bg-[#154360] text-white p-7 mb-5 rounded-sm">
              <h1 className="text-3xl font-black mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Record land once. Transfer it only with three keys.
              </h1>
              <p className="text-white/70 text-sm max-w-2xl">
                Citizens register a ULPIN polygon. PostGIS rejects invalid or overlapping plots. Deeds pin to IPFS.
                Title moves only after seller, buyer, and registrar approve the LandTitleEscrow contract.
              </p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setTab("registry")} className="px-5 py-2 bg-[#f5a623] text-[#0d1b2e] font-semibold text-sm">
                  Open registry
                </button>
                <button onClick={() => setTab("chain")} className="px-5 py-2 border border-white/30 text-sm">
                  How blockchain works
                </button>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 mb-5">
              {[
                ["Parcels on map", stats.parcels],
                ["Open + historic transfers", stats.transfers],
                ["Completed titles", stats.completed],
              ].map(([label, value]) => (
                <div key={String(label)} className="bg-white border border-[#d0d5dd] p-4">
                  <div className="text-xs text-[#5a6680]">{label}</div>
                  <div className="text-2xl font-black text-[#154360]">{value}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#5a6680] mb-8">
              Demo logins after <code className="font-mono">npm run db:seed</code> in backend:
              citizen@bhusetu.local, buyer@bhusetu.local, registrar@bhusetu.local — password Test123456!
            </p>
          </>
        )}
        {tab === "registry" && <RegistryPanel />}
        {tab === "transfer" && <TransferPanel />}
        {tab === "registrar" && <RegistrarPanel />}
        {tab === "chain" && <BlockchainPanel />}
      </main>
      <footer>
        <TricolorBar />
        <div className="bg-[#0d2137] text-white/40 text-xs px-4 py-6 text-center">
          BhuSetu land title registry · sample cadastral data for SIH demonstration
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
