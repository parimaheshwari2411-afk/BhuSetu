import { FormEvent, useEffect, useState } from "react";
import { approveTransfer, createTransfer, fetchParcels, fetchTransfers } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

type Transfer = {
  id: string;
  parcelId: string;
  buyerId: string;
  sellerId: string;
  status: string;
  deedIpfsCid: string;
};

type Parcel = { id: string; ulpin: string };

export default function TransferPanel() {
  const { user } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [parcelId, setParcelId] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    try {
      const [p, t] = await Promise.all([fetchParcels(), fetchTransfers()]);
      setParcels(p.data || []);
      setTransfers(t.data || []);
      if (!parcelId && p.data?.[0]) setParcelId(p.data[0].id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "API unavailable");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setMessage("Sign in as the seller (parcel owner) first.");
      return;
    }
    const file = (event.currentTarget.elements.namedItem("deed") as HTMLInputElement).files?.[0];
    if (!file) {
      setMessage("Attach a deed PDF.");
      return;
    }
    const form = new FormData();
    form.append("parcelId", parcelId);
    form.append("buyerId", buyerId);
    form.append("deed", file);
    try {
      await createTransfer(form);
      setMessage("Transfer locked in escrow. Deed CID stored via Pinata or local IPFS fallback.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Transfer failed");
    }
  }

  async function onApprove(id: string) {
    try {
      await approveTransfer(id);
      setMessage("On-chain / demo approval recorded for your role.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approval failed");
    }
  }

  return (
    <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm mb-5 overflow-hidden">
      <div className="px-4 py-2.5 bg-[#154360] text-white text-sm font-semibold">Multi-sig land transfer</div>
      <form onSubmit={onCreate} className="p-4 grid md:grid-cols-2 gap-3 text-xs">
        <label className="block text-[#5a6680]">Parcel
          <select value={parcelId} onChange={(e) => setParcelId(e.target.value)} className="mt-1 w-full border px-2 py-1.5 bg-white">
            {parcels.map((p) => (
              <option key={p.id} value={p.id}>{p.ulpin}</option>
            ))}
          </select>
        </label>
        <label className="block text-[#5a6680]">Buyer user UUID
          <input value={buyerId} onChange={(e) => setBuyerId(e.target.value)} placeholder="Login as buyer@bhusetu.local then paste id from profile later" className="mt-1 w-full border px-2 py-1.5 font-mono" />
        </label>
        <label className="block text-[#5a6680] md:col-span-2">Deed PDF
          <input name="deed" type="file" accept="application/pdf,image/png,image/jpeg" className="mt-1 w-full" />
        </label>
        <button className="md:col-span-2 py-2 bg-[#154360] text-white font-semibold">Lock in escrow</button>
      </form>
      {message && <p className="mx-4 mb-3 text-xs text-[#78350f] bg-[#fffbeb] border border-[#f5a623]/40 p-2">{message}</p>}
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#eef2f8] text-[#154360]">
            <th className="text-left px-3 py-2">Transfer</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="text-left px-3 py-2">IPFS CID</th>
            <th className="text-left px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="px-3 py-2 font-mono">{t.id.slice(0, 8)}…</td>
              <td className="px-3 py-2">{t.status}</td>
              <td className="px-3 py-2 font-mono truncate max-w-[180px]">{t.deedIpfsCid}</td>
              <td className="px-3 py-2">
                <button onClick={() => onApprove(t.id)} className="text-[#154360] font-semibold hover:underline">
                  Approve as me
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
