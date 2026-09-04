import { useEffect, useState } from "react";
import { approveAdminTransfer, fetchAdminStats, fetchPendingTransfers } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

type Pending = {
  id: string;
  ulpin: string;
  status: string;
  deedIpfsCid: string;
  seller: { name: string };
  buyer: { name: string };
};

export default function RegistrarPanel() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Pending[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      const [pending, statistics] = await Promise.all([
        fetchPendingTransfers(),
        fetchAdminStats(),
      ]);
      setRows(pending.data || []);
      setStats(statistics.data || null);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registrar API requires REGISTRAR role");
    }
  }

  useEffect(() => {
    void refresh();
  }, [user]);

  async function approve(id: string) {
    try {
      await approveAdminTransfer(id);
      setMessage("Registrar multi-sig completed. Ownership updated.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approval failed");
    }
  }

  return (
    <div className="space-y-5 mb-5">
      <div className="bg-white border border-[#d0d5dd] rounded-sm p-4 text-xs text-[#5a6680]">
        Sign in as <span className="font-mono">registrar@bhusetu.local</span> / Test123456! to load GET /api/v1/admin/pending-transfers.
      </div>
      {stats && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-white border p-4">
            <div className="text-xs text-[#5a6680]">Parcels</div>
            <div className="text-2xl font-black text-[#154360]">{(stats.parcels as { total?: number })?.total ?? 0}</div>
          </div>
          <div className="bg-white border p-4">
            <div className="text-xs text-[#5a6680]">Completed transfers</div>
            <div className="text-2xl font-black text-[#154360]">{(stats.transfers as { completed?: number })?.completed ?? 0}</div>
          </div>
          <div className="bg-white border p-4">
            <div className="text-xs text-[#5a6680]">In escrow</div>
            <div className="text-2xl font-black text-[#154360]">{(stats.transfers as { inEscrow?: number })?.inEscrow ?? 0}</div>
          </div>
        </div>
      )}
      {message && <p className="text-xs text-[#78350f] bg-[#fffbeb] border border-[#f5a623]/40 p-2">{message}</p>}
      <div className="bg-white border border-[#d0d5dd] rounded-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-[#154360] text-white text-sm font-semibold">Pending title transfers</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#eef2f8] text-[#154360]">
              <th className="text-left px-3 py-2">ULPIN</th>
              <th className="text-left px-3 py-2">Parties</th>
              <th className="text-left px-3 py-2">Deed CID</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2 font-mono">{row.ulpin}</td>
                <td className="px-3 py-2">{row.seller?.name} → {row.buyer?.name}</td>
                <td className="px-3 py-2 font-mono truncate max-w-[160px]">{row.deedIpfsCid}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">
                  <button onClick={() => approve(row.id)} className="px-2 py-1 bg-[#138808] text-white rounded-sm">
                    Approve on-chain
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
