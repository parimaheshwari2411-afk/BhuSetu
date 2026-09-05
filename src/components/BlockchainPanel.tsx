import { useEffect, useState } from "react";
import { fetchBlockchainStatus, fetchTransfers } from "../lib/api";

export default function BlockchainPanel() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchBlockchainStatus>> | null>(null);
  const [transfers, setTransfers] = useState<Array<{ id: string; status: string; multiSigTxHash?: string; deedIpfsCid?: string }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setStatus(await fetchBlockchainStatus());
        const list = await fetchTransfers();
        setTransfers(list.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Blockchain API down");
      }
    })();
  }, []);

  return (
    <div className="space-y-5 mb-5">
      <div className="bg-white border border-[#d0d5dd] rounded-sm p-5">
        <h2 className="text-[#154360] font-semibold mb-2">How BhuSetu uses the chain</h2>
        <p className="text-sm text-[#374151] leading-relaxed mb-3">
          PostgreSQL + PostGIS remains the cadastral source of truth (polygons, ULPIN, owner). Ethereum (Anvil locally)
          is the settlement layer: a 3-of-3 escrow so a plot cannot be sold twice while a transfer is open. The deed PDF
          is not stored on-chain; only its IPFS CID is.
        </p>
        {status && (
          <div className="text-xs font-mono bg-[#f8f9fa] border p-3 mb-3">
            mode: {status.demoMode ? "demo (no live Anvil contract)" : "live contract"} · rpc: {status.rpcUrl} ·
            escrow: {status.contractAddress}
          </div>
        )}
        <ol className="space-y-2 text-sm text-[#374151]">
          {(status?.flow || []).map((step) => (
            <li key={step.step}>
              <span className="font-semibold text-[#154360]">
                {step.step}. {step.title}.
              </span>{" "}
              {step.detail}
            </li>
          ))}
        </ol>
        {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
      </div>
      <div className="bg-white border border-[#d0d5dd] rounded-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-[#154360] text-white text-sm font-semibold">On-chain / demo tx hashes</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#eef2f8] text-[#154360]">
              <th className="text-left px-3 py-2">Escrow</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Tx hash</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-3 py-2 font-mono">{t.id.slice(0, 8)}…</td>
                <td className="px-3 py-2">{t.status}</td>
                <td className="px-3 py-2 font-mono">{t.multiSigTxHash || "pending"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
