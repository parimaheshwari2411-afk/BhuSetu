import { useState } from "react";

/* ─── DATA ─────────────────────────────────────────────────────── */

const NOTICES = [
  { date: "28 Aug 2024", text: "Circular: Mandatory adoption of BhuSetu for all district digitization drives — MoLR/DO/2024/81." },
  { date: "22 Aug 2024", text: "Release Notes: BhuSetu v2.4 — Enhanced Devanagari handwriting recognition and Bhu-Naksha GIS linkage." },
  { date: "15 Aug 2024", text: "Training Programme: District-level officers training on BhuSetu verification module — Batch 7 registration open." },
  { date: "10 Aug 2024", text: "Integration Update: NGDRS (National Generic Document Registration System) API now live in production." },
  { date: "01 Aug 2024", text: "Launch: BhuSetu District Dashboard now available for Rajasthan, Gujarat, and Madhya Pradesh." },
];

const STATS = [
  { value: "24,18,432", label: "Documents Digitized" },
  { value: "97.3%", label: "Extraction Accuracy" },
  { value: "22", label: "Languages Supported" },
  { value: "18 Sec", label: "Avg. Processing Time" },
  { value: "12", label: "States Onboarded" },
  { value: "1,204", label: "Pending Verification" },
];

const STATE_DATA: Record<string, { docs: number; pct: number; district: string; officer: string; status: string }> = {
  "Uttar Pradesh":    { docs: 428000, pct: 74, district: "32 of 75", officer: "Sh. R. K. Sharma", status: "Active" },
  "Madhya Pradesh":   { docs: 312000, pct: 62, district: "28 of 52", officer: "Sh. P. K. Tiwari", status: "Active" },
  "Rajasthan":        { docs: 289000, pct: 58, district: "19 of 33", officer: "Sh. A. S. Rathore", status: "Active" },
  "Maharashtra":      { docs: 265000, pct: 81, district: "30 of 36", officer: "Sh. V. D. Patil", status: "Active" },
  "Bihar":            { docs: 198000, pct: 43, district: "21 of 38", officer: "Sh. S. K. Singh", status: "In Progress" },
  "Gujarat":          { docs: 187000, pct: 67, district: "22 of 33", officer: "Sh. N. H. Patel", status: "Active" },
  "Karnataka":        { docs: 154000, pct: 55, district: "18 of 31", officer: "Sh. M. R. Gowda", status: "In Progress" },
  "Haryana":          { docs: 132000, pct: 70, district: "15 of 22", officer: "Sh. B. L. Yadav", status: "Active" },
  "Odisha":           { docs: 98000,  pct: 38, district: "11 of 30", officer: "Sh. D. K. Behera", status: "Onboarding" },
  "Punjab":           { docs: 87000,  pct: 61, district: "13 of 22", officer: "Sh. G. S. Brar", status: "Active" },
};

const QUEUE_ITEMS = [
  { id: "BHU-2024-041928", state: "UP", district: "Lucknow", type: "Jamabandi", lang: "Hindi", pages: 12, status: "Processing", confidence: null, submitted: "28 Aug 09:14" },
  { id: "BHU-2024-041919", state: "MH", district: "Pune", type: "Mutation Register", lang: "Marathi", pages: 8, status: "Pending Verification", confidence: 78, submitted: "28 Aug 08:52" },
  { id: "BHU-2024-041905", state: "RJ", district: "Jaipur", type: "Khatauni", lang: "Hindi", pages: 5, status: "Approved", confidence: 96, submitted: "28 Aug 08:30" },
  { id: "BHU-2024-041897", state: "GJ", district: "Surat", type: "Patta", lang: "Gujarati", pages: 3, status: "Rejected", confidence: 42, submitted: "27 Aug 17:41" },
  { id: "BHU-2024-041880", state: "KA", district: "Bengaluru", type: "Survey Map", lang: "Kannada", pages: 1, status: "Approved", confidence: 94, submitted: "27 Aug 16:15" },
  { id: "BHU-2024-041865", state: "MP", district: "Bhopal", type: "RoR", lang: "Hindi", pages: 7, status: "Processing", confidence: null, submitted: "27 Aug 15:00" },
];

const CADASTRAL_PARCELS = [
  { survey: "123/A", khasra: "45", khata: "12", owner: "Ram Prasad Singh", area: "2.34 Ha", type: "Agricultural", tehsil: "Sadar", status: "Verified" },
  { survey: "124/B", khasra: "46", khata: "13", owner: "Sita Devi", area: "0.87 Ha", type: "Residential", tehsil: "Sadar", status: "Pending" },
  { survey: "125", khasra: "47", khata: "14", owner: "Gram Panchayat", area: "5.10 Ha", type: "Common Land", tehsil: "Sadar", status: "Verified" },
  { survey: "126/A", khasra: "48", khata: "15", owner: "Mohan Lal Gupta", area: "1.20 Ha", type: "Agricultural", tehsil: "Sadar", status: "Disputed" },
  { survey: "127", khasra: "49", khata: "16", owner: "Priya Sharma", area: "0.45 Ha", type: "Residential", tehsil: "Sadar", status: "Verified" },
];

const WORKFLOW_STAGES = [
  { id: "ingest",    label: "Document Ingestion",      desc: "Upload & queue",                 role: "Scanning Officer" },
  { id: "preproc",   label: "Pre-Processing",           desc: "Deskew, denoise, enhance",       role: "System (Auto)" },
  { id: "ocr",       label: "OCR & Extraction",         desc: "Multilingual text recognition",  role: "System (Auto)" },
  { id: "classify",  label: "Field Classification",     desc: "Structured data mapping",        role: "System (Auto)" },
  { id: "validate",  label: "Automated Validation",     desc: "Rules & cross-DB checks",        role: "System (Auto)" },
  { id: "review",    label: "Human Verification",       desc: "Officer review & correction",    role: "Revenue Officer" },
  { id: "approve",   label: "Approval",                 desc: "Senior officer sign-off",        role: "Senior Officer" },
  { id: "publish",   label: "Publish to LRMS/DILRMP",   desc: "Integration & GIS linkage",      role: "System (Auto)" },
];

const GIS_LAYERS = [
  { id: "cadastral",   label: "Cadastral Parcels",      active: true,  color: "#2563eb" },
  { id: "survey",      label: "Survey Numbers",          active: true,  color: "#16a34a" },
  { id: "roads",       label: "Roads & Paths",           active: false, color: "#9ca3af" },
  { id: "water",       label: "Water Bodies",            active: false, color: "#0ea5e9" },
  { id: "forest",      label: "Forest Boundaries",       active: false, color: "#15803d" },
  { id: "revenue",     label: "Revenue Circles",         active: true,  color: "#d97706" },
  { id: "disputed",    label: "Disputed Parcels",        active: false, color: "#dc2626" },
  { id: "mutations",   label: "Pending Mutations",       active: false, color: "#7c3aed" },
];

/* ─── HELPERS ────────────────────────────────────────────────────── */

function TricolorBar() {
  return (
    <div className="flex w-full h-1.5">
      <div className="flex-1 bg-[#FF9933]" />
      <div className="flex-1 bg-white" />
      <div className="flex-1 bg-[#138808]" />
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="px-4 py-2.5 bg-[#154360] text-white text-sm font-semibold flex items-center justify-between border-b border-[#1a5276]">
      <div className="flex items-center gap-2">
        <span className="w-0.5 h-4 bg-[#f5a623] rounded-full" />
        {title}
      </div>
      {action && (
        <a href="#" className="text-[#f5a623] text-xs hover:underline font-normal">{action}</a>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    "Processing":          "bg-blue-100 text-blue-800 border border-blue-200",
    "Pending Verification":"bg-yellow-100 text-yellow-800 border border-yellow-200",
    "Approved":            "bg-green-100 text-green-800 border border-green-200",
    "Rejected":            "bg-red-100 text-red-800 border border-red-200",
    "Active":              "bg-green-100 text-green-800 border border-green-200",
    "In Progress":         "bg-blue-100 text-blue-800 border border-blue-200",
    "Onboarding":          "bg-yellow-100 text-yellow-800 border border-yellow-200",
    "Verified":            "bg-green-100 text-green-800 border border-green-200",
    "Pending":             "bg-yellow-100 text-yellow-800 border border-yellow-200",
    "Disputed":            "bg-red-100 text-red-800 border border-red-200",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-sm font-medium ${map[status] || "bg-gray-100 text-gray-700 border border-gray-200"}`}>
      {status}
    </span>
  );
}

/* ─── GIS MAP (SVG India schematic) ─────────────────────────────── */

function IndiaMapSVG({ selected, onSelect }: { selected: string | null; onSelect: (s: string) => void }) {
  const states: Array<{ name: string; path: string; cx: number; cy: number }> = [
    { name: "Jammu & Kashmir",  path: "M 95,18 L 130,12 L 148,28 L 135,42 L 110,45 L 90,35 Z", cx: 118, cy: 30 },
    { name: "Himachal Pradesh", path: "M 130,42 L 155,38 L 162,52 L 145,60 L 128,55 Z", cx: 145, cy: 50 },
    { name: "Punjab",           path: "M 105,48 L 130,42 L 128,55 L 115,62 L 100,58 Z", cx: 115, cy: 53 },
    { name: "Haryana",          path: "M 115,62 L 138,58 L 142,72 L 125,80 L 110,74 Z", cx: 126, cy: 70 },
    { name: "Uttarakhand",      path: "M 145,58 L 175,52 L 180,68 L 162,72 L 145,68 Z", cx: 163, cy: 63 },
    { name: "Uttar Pradesh",    path: "M 125,80 L 180,68 L 200,85 L 195,108 L 158,115 L 130,110 L 118,95 Z", cx: 162, cy: 95 },
    { name: "Rajasthan",        path: "M 88,75 L 125,80 L 118,95 L 115,125 L 90,130 L 68,118 L 60,95 L 70,80 Z", cx: 95, cy: 105 },
    { name: "Gujarat",          path: "M 55,120 L 88,120 L 90,145 L 80,162 L 58,165 L 45,148 L 48,132 Z", cx: 70, cy: 142 },
    { name: "Madhya Pradesh",   path: "M 115,125 L 195,108 L 205,130 L 185,155 L 152,158 L 120,155 L 112,140 Z", cx: 160, cy: 140 },
    { name: "Bihar",            path: "M 195,95 L 235,90 L 242,108 L 225,118 L 200,115 Z", cx: 220, cy: 105 },
    { name: "Jharkhand",        path: "M 200,115 L 225,118 L 240,132 L 225,148 L 205,150 L 195,135 Z", cx: 218, cy: 133 },
    { name: "West Bengal",      path: "M 235,90 L 262,85 L 268,108 L 258,132 L 242,130 L 242,108 Z", cx: 253, cy: 110 },
    { name: "Odisha",           path: "M 205,150 L 240,145 L 252,162 L 240,178 L 218,182 L 205,168 Z", cx: 228, cy: 165 },
    { name: "Maharashtra",      path: "M 90,162 L 148,158 L 165,175 L 162,198 L 135,208 L 105,205 L 85,185 Z", cx: 128, cy: 185 },
    { name: "Chhattisgarh",     path: "M 185,150 L 210,148 L 218,168 L 205,185 L 185,188 L 172,172 Z", cx: 195, cy: 168 },
    { name: "Telangana",        path: "M 148,195 L 175,185 L 185,200 L 178,218 L 155,220 L 142,210 Z", cx: 163, cy: 207 },
    { name: "Andhra Pradesh",   path: "M 165,215 L 195,205 L 210,220 L 205,242 L 180,250 L 158,242 L 150,228 Z", cx: 183, cy: 230 },
    { name: "Karnataka",        path: "M 108,208 L 148,205 L 155,225 L 145,248 L 118,252 L 95,240 L 92,220 Z", cx: 125, cy: 230 },
    { name: "Tamil Nadu",       path: "M 128,255 L 158,248 L 165,272 L 152,295 L 132,295 L 112,272 Z", cx: 140, cy: 272 },
    { name: "Kerala",           path: "M 95,242 L 115,248 L 112,272 L 100,290 L 85,278 L 82,258 Z", cx: 98, cy: 267 },
    { name: "Goa",              path: "M 88,218 L 100,215 L 102,228 L 90,230 Z", cx: 93, cy: 222 },
  ];

  const pctMap: Record<string, number> = {};
  Object.entries(STATE_DATA).forEach(([k, v]) => { pctMap[k] = v.pct; });

  function stateColor(name: string) {
    const pct = pctMap[name];
    if (!pct) return "#d1d5db";
    if (pct >= 70) return "#bbf7d0";
    if (pct >= 50) return "#fef08a";
    return "#fecaca";
  }

  function stateStroke(name: string) {
    return selected === name ? "#154360" : "#9ca3af";
  }

  return (
    <svg viewBox="0 0 320 320" className="w-full h-full" style={{ maxHeight: 420 }}>
      {/* Grid */}
      {Array.from({ length: 9 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 40} x2="320" y2={i * 40} stroke="#e5e7eb" strokeWidth="0.5" />
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="320" stroke="#e5e7eb" strokeWidth="0.5" />
      ))}

      {states.map((s) => (
        <g key={s.name} onClick={() => onSelect(s.name)} style={{ cursor: "pointer" }}>
          <path
            d={s.path}
            fill={stateColor(s.name)}
            stroke={stateStroke(s.name)}
            strokeWidth={selected === s.name ? "2" : "0.8"}
            className="transition-all"
          />
        </g>
      ))}

      {/* State labels for key states */}
      {states.filter(s => ["Rajasthan","Madhya Pradesh","Uttar Pradesh","Maharashtra","Bihar","Gujarat","Karnataka","Haryana"].includes(s.name)).map((s) => (
        <text
          key={`lbl-${s.name}`}
          x={s.cx}
          y={s.cy}
          textAnchor="middle"
          fontSize="5"
          fill="#374151"
          fontFamily="Inter, sans-serif"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {s.name.split(" ").map((word, i) => (
            <tspan key={i} x={s.cx} dy={i === 0 ? "0" : "6"}>{word}</tspan>
          ))}
        </text>
      ))}

      {/* Selected highlight ring */}
      {selected && (() => {
        const s = states.find(st => st.name === selected);
        if (!s) return null;
        return (
          <circle cx={s.cx} cy={s.cy} r="6" fill="none" stroke="#154360" strokeWidth="1.5" strokeDasharray="2 2" />
        );
      })()}

      {/* Legend */}
      <g transform="translate(8, 285)">
        <rect x="0" y="0" width="90" height="32" fill="white" stroke="#d1d5db" strokeWidth="0.5" rx="1" />
        <rect x="4" y="5" width="8" height="6" fill="#bbf7d0" stroke="#9ca3af" strokeWidth="0.5" />
        <text x="14" y="10" fontSize="4.5" fill="#374151" fontFamily="Inter">≥70% Complete</text>
        <rect x="4" y="14" width="8" height="6" fill="#fef08a" stroke="#9ca3af" strokeWidth="0.5" />
        <text x="14" y="19" fontSize="4.5" fill="#374151" fontFamily="Inter">50–69%</text>
        <rect x="50" y="14" width="8" height="6" fill="#fecaca" stroke="#9ca3af" strokeWidth="0.5" />
        <text x="60" y="19" fontSize="4.5" fill="#374151" fontFamily="Inter">&lt;50%</text>
        <rect x="50" y="5" width="8" height="6" fill="#d1d5db" stroke="#9ca3af" strokeWidth="0.5" />
        <text x="60" y="10" fontSize="4.5" fill="#374151" fontFamily="Inter">Not started</text>
      </g>

      {/* Compass */}
      <g transform="translate(290, 18)">
        <circle cx="0" cy="0" r="10" fill="white" stroke="#d1d5db" strokeWidth="0.8" />
        <text x="0" y="-5" textAnchor="middle" fontSize="6" fill="#154360" fontWeight="bold" fontFamily="Inter">N</text>
        <line x1="0" y1="-3" x2="0" y2="3" stroke="#154360" strokeWidth="1" />
        <line x1="-3" y1="0" x2="3" y2="0" stroke="#9ca3af" strokeWidth="0.6" />
      </g>
    </svg>
  );
}

/* ─── GIS PANEL ──────────────────────────────────────────────────── */

function GISPanel() {
  const [layers, setLayers] = useState(GIS_LAYERS);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedParcel, setSelectedParcel] = useState<typeof CADASTRAL_PARCELS[0] | null>(null);
  const [searchVal, setSearchVal] = useState("");
  const [activeGisTab, setActiveGisTab] = useState<"map"|"table">("map");

  function toggleLayer(id: string) {
    setLayers(ls => ls.map(l => l.id === id ? { ...l, active: !l.active } : l));
  }

  const stateInfo = selectedState ? STATE_DATA[selectedState] : null;

  return (
    <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm overflow-hidden">
      <SectionHeader title="GIS Cadastral Map Viewer — BhuSetu Spatial Module" />

      {/* Toolbar */}
      <div className="border-b border-[#e5e7eb] bg-[#f8f9fa] px-3 py-2 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {["map","table"].map(t => (
            <button
              key={t}
              onClick={() => setActiveGisTab(t as "map"|"table")}
              className={`px-3 py-1 text-xs font-medium rounded-sm border transition-colors ${
                activeGisTab === t ? "bg-[#154360] text-white border-[#154360]" : "bg-white text-[#374151] border-[#d0d5dd] hover:bg-[#f0f0f0]"
              }`}
            >
              {t === "map" ? "🗺 Map View" : "📋 Attribute Table"}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[160px] max-w-xs">
          <input
            type="text"
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            placeholder="Survey No. / Khasra / Owner name..."
            className="w-full border border-[#c8d0e4] rounded-sm px-2.5 py-1 text-xs text-[#0d1b2e] placeholder-[#aab0c0] focus:outline-none focus:border-[#154360]"
          />
        </div>
        <select className="border border-[#c8d0e4] rounded-sm px-2 py-1 text-xs text-[#374151] bg-white focus:outline-none focus:border-[#154360]">
          <option>Select State</option>
          {Object.keys(STATE_DATA).map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="border border-[#c8d0e4] rounded-sm px-2 py-1 text-xs text-[#374151] bg-white focus:outline-none focus:border-[#154360]">
          <option>Select District</option>
          <option>Lucknow</option>
          <option>Kanpur</option>
          <option>Agra</option>
        </select>
        <button className="px-3 py-1 bg-[#154360] text-white text-xs rounded-sm hover:bg-[#1a5276] transition-colors">Search</button>
        <div className="ml-auto flex gap-1 text-xs text-[#5a6680] items-center">
          <span className="font-mono">Lat: 26.8467°N</span>
          <span>|</span>
          <span className="font-mono">Lng: 80.9462°E</span>
          <span>|</span>
          <span className="font-mono">Zoom: 12</span>
        </div>
      </div>

      {activeGisTab === "map" ? (
        <div className="flex flex-col lg:flex-row">
          {/* Layer Panel */}
          <div className="w-full lg:w-52 border-b lg:border-b-0 lg:border-r border-[#e5e7eb] bg-[#f8f9fa]">
            <div className="px-3 py-2 text-xs font-semibold text-[#374151] border-b border-[#e5e7eb] bg-[#eef2f8]">
              Layer Control
            </div>
            <div className="divide-y divide-[#e5e7eb]">
              {layers.map(layer => (
                <label key={layer.id} className="flex items-center gap-2 px-3 py-2 hover:bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layer.active}
                    onChange={() => toggleLayer(layer.id)}
                    className="accent-[#154360]"
                  />
                  <span className="w-3 h-3 rounded-sm border border-[#c8d0e4] shrink-0" style={{ background: layer.active ? layer.color : "#e5e7eb" }} />
                  <span className="text-xs text-[#374151]">{layer.label}</span>
                </label>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-[#e5e7eb] text-xs font-semibold text-[#374151] bg-[#eef2f8]">
              Base Map
            </div>
            {["Survey of India", "OpenStreetMap", "ISRO Bhuvan", "Satellite"].map(bm => (
              <label key={bm} className="flex items-center gap-2 px-3 py-2 hover:bg-white cursor-pointer">
                <input type="radio" name="basemap" defaultChecked={bm === "Survey of India"} className="accent-[#154360]" />
                <span className="text-xs text-[#374151]">{bm}</span>
              </label>
            ))}
          </div>

          {/* Map Area */}
          <div className="flex-1 relative bg-[#e8f4e8] min-h-[420px] flex items-stretch">
            {/* Map zoom controls */}
            <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
              {["+","−","⊕"].map(c => (
                <button key={c} className="w-7 h-7 bg-white border border-[#c8d0e4] rounded-sm text-sm font-bold text-[#374151] hover:bg-[#f0f0f0] flex items-center justify-center shadow-sm transition-colors">
                  {c}
                </button>
              ))}
            </div>
            <div className="flex-1 p-3 flex flex-col">
              {/* Click to select state instruction */}
              {!selectedState && (
                <div className="absolute top-3 left-3 z-10 bg-white border border-[#d0d5dd] rounded-sm px-3 py-1.5 text-xs text-[#5a6680] shadow-sm">
                  Click on a state to view details
                </div>
              )}
              <IndiaMapSVG selected={selectedState} onSelect={setSelectedState} />
            </div>
          </div>

          {/* Info Panel */}
          <div className="w-full lg:w-60 border-t lg:border-t-0 lg:border-l border-[#e5e7eb] bg-[#f8f9fa] flex flex-col">
            <div className="px-3 py-2 text-xs font-semibold text-[#374151] border-b border-[#e5e7eb] bg-[#eef2f8]">
              Feature Information
            </div>
            {selectedState && stateInfo ? (
              <div className="p-3 space-y-2 text-xs">
                <div className="font-bold text-[#154360] text-sm">{selectedState}</div>
                <table className="w-full">
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {[
                      ["Digitized Docs", stateInfo.docs.toLocaleString("en-IN")],
                      ["Coverage", `${stateInfo.pct}%`],
                      ["Districts", stateInfo.district],
                      ["Nodal Officer", stateInfo.officer],
                      ["Status", stateInfo.status],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td className="py-1 text-[#5a6680] pr-2 w-28">{k}</td>
                        <td className="py-1 font-medium text-[#0d1b2e]">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="pt-2">
                  <div className="text-[#5a6680] mb-1">Progress</div>
                  <div className="h-2.5 bg-[#e5e7eb] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${stateInfo.pct}%`,
                        background: stateInfo.pct >= 70 ? "#138808" : stateInfo.pct >= 50 ? "#f5a623" : "#dc2626",
                      }}
                    />
                  </div>
                  <div className="text-right text-[#374151] font-mono mt-0.5">{stateInfo.pct}%</div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button className="flex-1 py-1.5 bg-[#154360] text-white text-xs rounded-sm hover:bg-[#1a5276] transition-colors">View Records</button>
                  <button className="flex-1 py-1.5 border border-[#154360] text-[#154360] text-xs rounded-sm hover:bg-[#eef2f8] transition-colors">GIS Report</button>
                </div>
              </div>
            ) : (
              <div className="p-4 text-xs text-[#5a6680]">
                <div className="font-medium text-[#374151] mb-2">How to use:</div>
                <ul className="space-y-1.5 list-disc list-inside text-[#5a6680]">
                  <li>Click a state on the map</li>
                  <li>Toggle layers in the layer panel</li>
                  <li>Search by survey/khasra number</li>
                  <li>Switch to Attribute Table for parcel data</li>
                </ul>
                <div className="mt-4 font-medium text-[#374151] mb-1">Coordinate System</div>
                <div className="font-mono text-[#5a6680]">WGS 84 / EPSG:4326</div>
                <div className="mt-2 font-medium text-[#374151] mb-1">Data Source</div>
                <div className="text-[#5a6680]">Survey of India, Bhu-Naksha, State GIS Portals</div>
              </div>
            )}

            {/* Parcel info if selected */}
            {selectedParcel && (
              <div className="border-t border-[#e5e7eb] p-3">
                <div className="text-xs font-semibold text-[#154360] mb-2">Selected Parcel</div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {[
                      ["Survey No.", selectedParcel.survey],
                      ["Khasra No.", selectedParcel.khasra],
                      ["Owner", selectedParcel.owner],
                      ["Area", selectedParcel.area],
                      ["Land Type", selectedParcel.type],
                    ].map(([k, v]) => (
                      <tr key={k}>
                        <td className="py-1 text-[#5a6680] pr-1">{k}</td>
                        <td className="py-1 font-medium text-[#0d1b2e]">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ATTRIBUTE TABLE */
        <div className="overflow-x-auto">
          <div className="px-4 py-2 bg-[#f8f9fa] border-b border-[#e5e7eb] flex items-center gap-3 text-xs text-[#5a6680]">
            <span>Showing 5 of 4,28,931 records — Lucknow Tehsil, Sadar Circle</span>
            <div className="ml-auto flex gap-2">
              <button className="px-2.5 py-1 border border-[#c8d0e4] rounded-sm bg-white hover:bg-[#f0f0f0] transition-colors">Export CSV</button>
              <button className="px-2.5 py-1 border border-[#c8d0e4] rounded-sm bg-white hover:bg-[#f0f0f0] transition-colors">Print</button>
            </div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#eef2f8] text-[#154360] border-b border-[#d0d5dd]">
                {["Survey No.", "Khasra No.", "Khata No.", "Owner Name", "Area", "Land Type", "Tehsil", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CADASTRAL_PARCELS.map((p, i) => (
                <tr
                  key={p.survey}
                  onClick={() => setSelectedParcel(p)}
                  className={`border-b border-[#e5e7eb] hover:bg-[#f0f5ff] cursor-pointer transition-colors ${i % 2 === 0 ? "" : "bg-[#fafbfc]"}`}
                >
                  <td className="px-4 py-2.5 font-mono font-medium text-[#154360]">{p.survey}</td>
                  <td className="px-4 py-2.5 font-mono">{p.khasra}</td>
                  <td className="px-4 py-2.5 font-mono">{p.khata}</td>
                  <td className="px-4 py-2.5 font-medium text-[#0d1b2e]">{p.owner}</td>
                  <td className="px-4 py-2.5 font-mono">{p.area}</td>
                  <td className="px-4 py-2.5">{p.type}</td>
                  <td className="px-4 py-2.5">{p.tehsil}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1.5">
                      <button className="text-[#154360] hover:underline font-medium">View</button>
                      <span className="text-[#d0d5dd]">|</span>
                      <button className="text-[#154360] hover:underline font-medium">Edit</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-[#f8f9fa] border-t border-[#e5e7eb] flex items-center justify-between text-xs text-[#5a6680]">
            <span>Page 1 of 85,786</span>
            <div className="flex gap-1">
              {["‹ Prev", "1", "2", "3", "...", "Next ›"].map(p => (
                <button key={p} className={`px-2 py-1 border rounded-sm transition-colors ${p === "1" ? "bg-[#154360] text-white border-[#154360]" : "bg-white border-[#c8d0e4] hover:bg-[#f0f0f0]"}`}>{p}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="px-3 py-1.5 bg-[#2b2b2b] text-white/60 text-xs flex gap-4 font-mono">
        <span>CRS: WGS 84</span>
        <span>|</span>
        <span>Scale: 1:50,000</span>
        <span>|</span>
        <span>Active Layers: {layers.filter(l => l.active).length}</span>
        <span>|</span>
        <span>Data: Bhu-Naksha v3 + State GIS</span>
        <span className="ml-auto">Ready</span>
      </div>
    </div>
  );
}

/* ─── WORKFLOW PANEL ─────────────────────────────────────────────── */

function WorkflowPanel() {
  const [activeStage, setActiveStage] = useState("review");

  const stageStatus: Record<string, "done"|"active"|"pending"> = {
    ingest: "done", preproc: "done", ocr: "done",
    classify: "done", validate: "done",
    review: "active", approve: "pending", publish: "pending",
  };

  return (
    <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm overflow-hidden mb-6">
      <SectionHeader title="Document Processing Workflow" />
      <div className="p-5">
        {/* Stage bar */}
        <div className="flex items-start gap-0 mb-6 overflow-x-auto pb-2">
          {WORKFLOW_STAGES.map((stage, i) => {
            const st = stageStatus[stage.id];
            return (
              <div key={stage.id} className="flex items-center shrink-0">
                <button
                  onClick={() => setActiveStage(stage.id)}
                  className={`flex flex-col items-center gap-1.5 px-3 group`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                    st === "done"    ? "bg-[#138808] border-[#138808] text-white" :
                    st === "active"  ? "bg-[#f5a623] border-[#f5a623] text-white" :
                                       "bg-white border-[#d0d5dd] text-[#9ca3af]"
                  } ${activeStage === stage.id ? "ring-2 ring-offset-1 ring-[#154360]" : ""}`}>
                    {st === "done" ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs text-center leading-tight max-w-[72px] ${
                    activeStage === stage.id ? "text-[#154360] font-semibold" : "text-[#5a6680]"
                  }`}>
                    {stage.label}
                  </span>
                </button>
                {i < WORKFLOW_STAGES.length - 1 && (
                  <div className={`h-0.5 w-6 shrink-0 mb-6 ${st === "done" ? "bg-[#138808]" : "bg-[#e5e7eb]"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Stage detail */}
        {(() => {
          const stage = WORKFLOW_STAGES.find(s => s.id === activeStage)!;
          const st = stageStatus[activeStage];
          return (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border border-[#e5e7eb] rounded-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    st === "done" ? "bg-[#138808] text-white" : st === "active" ? "bg-[#f5a623] text-white" : "bg-[#e5e7eb] text-[#9ca3af]"
                  }`}>
                    {st === "done" ? "✓" : WORKFLOW_STAGES.findIndex(s => s.id === activeStage) + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-[#154360] text-sm">{stage.label}</div>
                    <div className="text-xs text-[#5a6680]">{stage.desc}</div>
                  </div>
                  <StatusBadge status={st === "done" ? "Approved" : st === "active" ? "Processing" : "Pending"} />
                </div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {[
                      ["Responsible Role", stage.role],
                      ["Stage Type", stage.role.includes("Auto") ? "Automated" : "Manual"],
                      ["SLA Target", stage.role.includes("Auto") ? "< 30 seconds" : "≤ 2 working days"],
                      ["Current Status", st === "done" ? "Completed" : st === "active" ? "In Progress" : "Not Started"],
                    ].map(([k, v]) => (
                      <tr key={k}><td className="py-1.5 text-[#5a6680] pr-3 w-36">{k}</td><td className="py-1.5 font-medium text-[#0d1b2e]">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border border-[#e5e7eb] rounded-sm p-4">
                <div className="text-xs font-semibold text-[#374151] mb-3">Active Job: BHU-2024-041919</div>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-[#e5e7eb]">
                    {[
                      ["Document Type", "Mutation Register"],
                      ["State / District", "Maharashtra / Pune"],
                      ["Language", "Marathi"],
                      ["Pages", "8"],
                      ["OCR Confidence", "78% (flagged for review)"],
                      ["Fields Extracted", "11 of 14"],
                      ["Submitted", "28 Aug 2024, 08:52 IST"],
                    ].map(([k, v]) => (
                      <tr key={k}><td className="py-1.5 text-[#5a6680] pr-3 w-36">{k}</td><td className="py-1.5 font-medium text-[#0d1b2e]">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
                {activeStage === "review" && (
                  <div className="mt-3 flex gap-2">
                    <button className="flex-1 py-1.5 bg-[#138808] text-white text-xs rounded-sm hover:bg-[#0f6b06] transition-colors font-semibold">Approve Record</button>
                    <button className="flex-1 py-1.5 bg-[#dc2626] text-white text-xs rounded-sm hover:bg-[#b91c1c] transition-colors font-semibold">Reject</button>
                    <button className="flex-1 py-1.5 border border-[#154360] text-[#154360] text-xs rounded-sm hover:bg-[#eef2f8] transition-colors">Edit Fields</button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ─── MAIN APP ───────────────────────────────────────────────────── */

export default function App() {
  const [noticeIdx, setNoticeIdx] = useState(0);
  const [lang, setLang] = useState("English");
  const [trackId, setTrackId] = useState("");
  const [activeTab, setActiveTab] = useState<"home"|"gis"|"workflow"|"queue"|"upload"|"dashboard">("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NAV = [
    { id: "home",      label: "Home" },
    { id: "upload",    label: "Upload Document" },
    { id: "queue",     label: "Processing Queue" },
    { id: "workflow",  label: "Workflow" },
    { id: "gis",       label: "GIS Map" },
    { id: "dashboard", label: "Dashboard" },
  ] as const;

  return (
    <div className="min-h-full bg-[#f0f2f5]" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* TOP UTILITY BAR */}
      <div className="bg-[#2b2b2b] text-white text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-white/55 flex-wrap">
            <a href="#" className="hover:text-white">Screen Reader Access</a>
            <span className="text-white/20">|</span>
            <a href="#" className="hover:text-white">Skip to Main Content</a>
            <span className="text-white/20">|</span>
            <span>Last Updated: 28 Aug 2024</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-white/55">
              <button className="hover:text-white">A-</button>
              <button className="text-white font-bold">A</button>
              <button className="hover:text-white">A+</button>
            </div>
            <span className="text-white/20">|</span>
            <select value={lang} onChange={e => setLang(e.target.value)} className="bg-transparent text-white/70 text-xs outline-none cursor-pointer hover:text-white">
              <option>English</option>
              <option>हिंदी</option>
              <option>தமிழ்</option>
              <option>తెలుగు</option>
              <option>বাংলা</option>
            </select>
          </div>
        </div>
      </div>

      <TricolorBar />

      {/* HEADER */}
      <header className="bg-[#154360]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shrink-0">🏛</div>
            <div>
              <div className="text-[#f5a623] text-xs font-semibold uppercase tracking-widest">
                Ministry of Panchayati Raj, Government of India
              </div>
              <div className="text-white text-xl font-black leading-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
                BhuSetu | भूसेतु
              </div>
              <div className="text-white/55 text-xs">
                Intelligent Land Record Digitization & Validation System &nbsp;·&nbsp; DILRMP Phase III
              </div>
            </div>
          </div>
          <div className="hidden md:flex flex-col items-end gap-1 text-right">
            <div className="text-white/40 text-xs">Powered by</div>
            <div className="text-white font-bold text-sm">Digital India · NIC</div>
            <div className="text-white/30 text-xs font-mono">v2.4.1 · MeghRaj Cloud</div>
          </div>
        </div>
      </header>

      {/* MAIN NAV */}
      <nav className="bg-[#1a5276] border-b-2 border-[#f5a623] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="hidden md:flex items-center">
            {NAV.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === item.id
                    ? "border-[#f5a623] text-[#f5a623] bg-white/5"
                    : "border-transparent text-white/75 hover:text-white hover:bg-white/10"
                }`}
              >
                {item.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 py-2">
              <button className="px-3 py-1.5 border border-white/25 text-white/70 text-xs rounded-sm hover:border-white/50 hover:text-white transition-colors">Sign In</button>
              <button className="px-3 py-1.5 bg-[#f5a623] text-[#0d1b2e] text-xs font-semibold rounded-sm hover:bg-[#e8961a] transition-colors">Register</button>
            </div>
          </div>
          <div className="md:hidden flex items-center justify-between py-2">
            <span className="text-white/70 text-sm">BhuSetu</span>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white/80 p-1">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                {mobileMenuOpen ? <path d="M6 18L18 6M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden pb-2 flex flex-col">
              {NAV.map(item => (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  className="text-left px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors">
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* NOTICE BAR */}
      <div className="bg-[#fffbeb] border-b border-[#f5a623]/30">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
          <span className="shrink-0 bg-[#f5a623] text-[#0d1b2e] text-xs font-bold px-2 py-0.5 rounded-sm">NOTICE</span>
          <div className="flex-1 text-sm text-[#78350f] truncate">
            <span className="text-[#a16207] mr-2 text-xs">{NOTICES[noticeIdx].date}</span>
            {NOTICES[noticeIdx].text}
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setNoticeIdx((noticeIdx - 1 + NOTICES.length) % NOTICES.length)} className="w-6 h-6 bg-[#f5a623]/20 hover:bg-[#f5a623]/40 rounded-sm text-[#78350f] flex items-center justify-center transition-colors">‹</button>
            <button onClick={() => setNoticeIdx((noticeIdx + 1) % NOTICES.length)} className="w-6 h-6 bg-[#f5a623]/20 hover:bg-[#f5a623]/40 rounded-sm text-[#78350f] flex items-center justify-center transition-colors">›</button>
          </div>
        </div>
      </div>

      {/* PAGE CONTENT */}
      <main className="max-w-7xl mx-auto px-4 py-5">

        {/* ═══ HOME ═══ */}
        {activeTab === "home" && (
          <>
            {/* Hero + Track */}
            <div className="grid lg:grid-cols-3 gap-5 mb-5">
              <div className="lg:col-span-2 bg-[#154360] rounded-sm overflow-hidden border border-[#1a5276] shadow-sm">
                <div className="p-7">
                  <div className="text-[#f5a623] text-xs font-semibold uppercase tracking-wider mb-3">
                    Digital India Land Records Modernisation Programme — Phase III
                  </div>
                  <h1 className="text-3xl font-black text-white leading-snug mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    BhuSetu — Intelligent Land Record
                    <br />Digitization & Validation Platform
                  </h1>
                  <p className="text-white/60 text-sm leading-relaxed mb-5 max-w-lg">
                    Automates extraction, classification, validation, and integration of legacy land records — handwritten registers, scanned maps, and historical documents — into structured digital records using OCR, NLP, and computer vision.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setActiveTab("upload")} className="px-5 py-2 bg-[#f5a623] text-[#0d1b2e] font-semibold text-sm rounded-sm hover:bg-[#e8961a] transition-colors">Upload Document</button>
                    <button onClick={() => setActiveTab("gis")} className="px-5 py-2 bg-white/10 border border-white/25 text-white text-sm rounded-sm hover:bg-white/20 transition-colors">GIS Map Viewer</button>
                    <button onClick={() => setActiveTab("workflow")} className="px-5 py-2 bg-white/10 border border-white/25 text-white text-sm rounded-sm hover:bg-white/20 transition-colors">View Workflow</button>
                  </div>
                </div>
                <TricolorBar />
              </div>
              <div className="flex flex-col gap-4">
                <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm p-4">
                  <div className="text-xs font-semibold text-[#154360] mb-3 pb-2 border-b border-[#e5e7eb] flex items-center gap-2">
                    <span className="w-0.5 h-3.5 bg-[#f5a623]" />Track Application Status
                  </div>
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-xs text-[#5a6680] block mb-1">Job ID / Application Number</label>
                      <input value={trackId} onChange={e => setTrackId(e.target.value)} placeholder="BHU-2024-XXXXXXX"
                        className="w-full border border-[#c8d0e4] rounded-sm px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#154360] font-mono placeholder-[#aab0c0]" />
                    </div>
                    <div>
                      <label className="text-xs text-[#5a6680] block mb-1">State</label>
                      <select className="w-full border border-[#c8d0e4] rounded-sm px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-[#154360]">
                        <option>Select State</option>
                        {Object.keys(STATE_DATA).map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <button className="w-full py-2 bg-[#154360] text-white text-xs font-semibold rounded-sm hover:bg-[#1a5276] transition-colors">Check Status</button>
                  </div>
                </div>
                <div className="bg-[#154360] border border-[#1a5276] rounded-sm p-4 text-center">
                  <div className="text-white/40 text-xs mb-1">Documents Digitized Today</div>
                  <div className="text-[#f5a623] text-3xl font-black font-mono" style={{ fontFamily: "'Outfit', sans-serif" }}>14,832</div>
                  <div className="mt-3 flex justify-around text-center border-t border-white/10 pt-3">
                    <div><div className="text-white font-bold text-sm">97.3%</div><div className="text-white/40 text-xs">Accuracy</div></div>
                    <div className="border-l border-white/10" />
                    <div><div className="text-[#f5a623] font-bold text-sm">1,204</div><div className="text-white/40 text-xs">Pending</div></div>
                    <div className="border-l border-white/10" />
                    <div><div className="text-[#22c55e] font-bold text-sm">12</div><div className="text-white/40 text-xs">States</div></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm mb-5 overflow-hidden">
              <SectionHeader title="Citizen Services — Quick Access" />
              <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-y divide-[#e5e7eb]">
                {[
                  { icon: "📄", label: "Upload Document", id: "upload" },
                  { icon: "🔍", label: "Track Status", id: "queue" },
                  { icon: "✅", label: "Verify Record", id: "workflow" },
                  { icon: "📊", label: "Dashboard", id: "dashboard" },
                  { icon: "🗺", label: "GIS Map", id: "gis" },
                  { icon: "📞", label: "Helpdesk", id: "home" },
                ].map(ql => (
                  <button key={ql.label} onClick={() => setActiveTab(ql.id as typeof activeTab)}
                    className="flex flex-col items-center text-center p-4 hover:bg-[#eef2f8] transition-colors group">
                    <span className="text-2xl mb-1.5">{ql.icon}</span>
                    <span className="text-xs font-semibold text-[#154360] group-hover:text-[#1a5276] leading-tight">{ql.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-[#154360] rounded-sm shadow-sm mb-5 overflow-hidden border border-[#1a5276]">
              <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
                <span className="w-0.5 h-4 bg-[#f5a623]" />
                <span className="text-white text-sm font-semibold">Platform Statistics — As on 28 August 2024</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-white/10">
                {STATS.map(s => (
                  <div key={s.label} className="p-4 text-center hover:bg-white/5 transition-colors">
                    <div className="text-xl font-black text-[#f5a623]" style={{ fontFamily: "'Outfit', sans-serif" }}>{s.value}</div>
                    <div className="text-white/55 text-xs mt-1 leading-snug">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notices + State Progress */}
            <div className="grid lg:grid-cols-2 gap-5 mb-5">
              <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm overflow-hidden">
                <SectionHeader title="Notice Board" action="View All →" />
                <div className="divide-y divide-[#e5e7eb]">
                  {NOTICES.map((n, i) => (
                    <div key={i} className="px-4 py-3 hover:bg-[#f8f9fa] flex gap-3 transition-colors">
                      <div className="shrink-0 bg-[#eef2f8] text-[#154360] text-xs font-mono px-2 py-1 rounded-sm text-center leading-tight">
                        {n.date.split(" ")[0]}<br />{n.date.split(" ")[1]}<br />{n.date.split(" ")[2]}
                      </div>
                      <div className="text-sm text-[#374151] leading-relaxed">{n.text}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm overflow-hidden">
                <SectionHeader title="State-wise Digitization Progress" />
                <div className="p-4 space-y-3.5">
                  {Object.entries(STATE_DATA).map(([state, d]) => (
                    <div key={state}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-[#0d1b2e]">{state}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[#5a6680] font-mono">{(d.docs/1000).toFixed(0)}K</span>
                          <span className="text-sm font-bold font-mono text-[#154360] w-8 text-right">{d.pct}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: d.pct >= 70 ? "#138808" : d.pct >= 50 ? "#f5a623" : "#dc2626" }} />
                      </div>
                    </div>
                  ))}
                  <div className="pt-1 flex gap-4 text-xs text-[#5a6680]">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#138808]" />≥70%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f5a623]" />50–69%</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#dc2626]" />&lt;50%</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══ GIS MAP ═══ */}
        {activeTab === "gis" && (
          <div className="mb-5">
            <GISPanel />
          </div>
        )}

        {/* ═══ WORKFLOW ═══ */}
        {activeTab === "workflow" && (
          <>
            <WorkflowPanel />
            {/* Problems & expected solution side by side */}
            <div className="grid lg:grid-cols-2 gap-5 mb-5">
              <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm overflow-hidden">
                <SectionHeader title="Scope of Study" />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#eef2f8] text-[#154360] border-b border-[#d0d5dd]">
                        <th className="text-left px-4 py-2.5 font-semibold w-36">Dimension</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Coverage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Document Types", "Scanned PDFs, TIFF, JPEG, handwritten registers, microfilm, legacy files"],
                        ["Languages", "22 scheduled Indian languages — all major scripts"],
                        ["Record Categories", "RoR, Jamabandi, Khatauni, Patta, Mutation Register, Survey Maps"],
                        ["Extraction Fields", "Survey No., Khasra, Khata, Plot Area, Landowner, Village, Tehsil, District, Land Classification, Mutation"],
                        ["Validation", "Business rules, duplicate detection, cross-DB, confidence scoring"],
                        ["Integrations", "LRMS, DILRMP, DORIS, Bhu-Naksha, Bhulekh, NGDRS, NIC Cloud"],
                        ["User Roles", "National/State Admin, District Officer, Verifier, Auditor, Citizen"],
                        ["Outputs", "Structured JSON/XML, CSV, GeoJSON, Shapefile, digitized PDF"],
                      ].map(([k, v], i) => (
                        <tr key={k} className={`border-b border-[#e5e7eb] hover:bg-[#f5f9ff] ${i % 2 ? "bg-[#fafbfc]" : ""}`}>
                          <td className="px-4 py-2.5 font-semibold text-[#154360]">{k}</td>
                          <td className="px-4 py-2.5 text-[#374151] leading-relaxed">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm overflow-hidden">
                <SectionHeader title="Expected Solution Checklist" />
                <div className="divide-y divide-[#e5e7eb]">
                  {[
                    ["Multilingual document recognition (22 languages)", true],
                    ["Automatic structured data extraction from scanned docs", true],
                    ["Intelligent field classification into predefined fields", true],
                    ["Automated validation — business rules & cross-DB checks", true],
                    ["Confidence scoring with flagging of uncertain fields", true],
                    ["Human-assisted verification workflow for low-confidence records", true],
                    ["AI learning from correction feedback loops", true],
                    ["GIS & cadastral map integration (Bhu-Naksha, state portals)", true],
                    ["Secure document repository with metadata & audit trail", true],
                    ["Interactive analytics dashboard — state/district drill-down", true],
                    ["REST/GraphQL APIs for government application integration", true],
                    ["Role-based access control (RBAC)", true],
                  ].map(([item, done], i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-[#f8f9fa]">
                      <span className={`mt-0.5 text-sm shrink-0 ${done ? "text-[#138808]" : "text-[#d1d5db]"}`}>
                        {done ? "✓" : "○"}
                      </span>
                      <span className="text-xs text-[#374151]">{item as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══ PROCESSING QUEUE ═══ */}
        {activeTab === "queue" && (
          <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm mb-5 overflow-hidden">
            <SectionHeader title="Document Processing Queue" action="Refresh ↻" />
            <div className="px-4 py-2 bg-[#f8f9fa] border-b border-[#e5e7eb] flex flex-wrap items-center gap-3 text-xs">
              <select className="border border-[#c8d0e4] rounded-sm px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#154360]">
                <option>All States</option>
                {Object.keys(STATE_DATA).map(s => <option key={s}>{s}</option>)}
              </select>
              <select className="border border-[#c8d0e4] rounded-sm px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#154360]">
                <option>All Statuses</option>
                <option>Processing</option>
                <option>Pending Verification</option>
                <option>Approved</option>
                <option>Rejected</option>
              </select>
              <select className="border border-[#c8d0e4] rounded-sm px-2.5 py-1.5 bg-white focus:outline-none focus:border-[#154360]">
                <option>All Document Types</option>
                <option>Jamabandi / RoR</option>
                <option>Khatauni</option>
                <option>Mutation Register</option>
              </select>
              <div className="ml-auto flex gap-2">
                <button className="px-3 py-1.5 border border-[#c8d0e4] rounded-sm bg-white hover:bg-[#f0f0f0]">Export CSV</button>
                <button className="px-3 py-1.5 bg-[#154360] text-white rounded-sm hover:bg-[#1a5276] transition-colors">Bulk Approve</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#eef2f8] text-[#154360] border-b border-[#d0d5dd]">
                    {["Job ID","State","District","Document Type","Language","Pages","Submitted","Confidence","Status","Action"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {QUEUE_ITEMS.map((item, i) => (
                    <tr key={item.id} className={`border-b border-[#e5e7eb] hover:bg-[#f0f5ff] transition-colors ${i%2?"bg-[#fafbfc]":""}`}>
                      <td className="px-4 py-2.5 font-mono font-medium text-[#154360]">{item.id}</td>
                      <td className="px-4 py-2.5">{item.state}</td>
                      <td className="px-4 py-2.5">{item.district}</td>
                      <td className="px-4 py-2.5">{item.type}</td>
                      <td className="px-4 py-2.5">{item.lang}</td>
                      <td className="px-4 py-2.5 font-mono">{item.pages}</td>
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap">{item.submitted}</td>
                      <td className="px-4 py-2.5">
                        {item.confidence !== null ? (
                          <span className={`font-mono font-bold ${item.confidence >= 90 ? "text-[#138808]" : item.confidence >= 70 ? "text-[#f5a623]" : "text-[#dc2626]"}`}>
                            {item.confidence}%
                          </span>
                        ) : <span className="text-[#9ca3af]">—</span>}
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1.5">
                          <button className="text-[#154360] hover:underline font-medium">View</button>
                          {item.status === "Pending Verification" && <>
                            <span className="text-[#d0d5dd]">|</span>
                            <button className="text-[#138808] hover:underline font-medium">Approve</button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-[#f8f9fa] border-t border-[#e5e7eb] flex items-center justify-between text-xs text-[#5a6680]">
              <span>Showing 6 of 14,832 records for today</span>
              <div className="flex gap-1">
                {["‹","1","2","3","...","›"].map(p => (
                  <button key={p} className={`px-2 py-1 border rounded-sm transition-colors text-xs ${p==="1"?"bg-[#154360] text-white border-[#154360]":"bg-white border-[#c8d0e4] hover:bg-[#f0f0f0]"}`}>{p}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ UPLOAD ═══ */}
        {activeTab === "upload" && (
          <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm mb-5 overflow-hidden">
            <SectionHeader title="Submit Document for Digitization" />
            <div className="p-6 grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="text-sm font-semibold text-[#154360] mb-2">Document Details</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#5a6680] font-medium block mb-1">State *</label>
                    <select className="w-full border border-[#c8d0e4] rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#154360]">
                      <option>Select State</option>
                      {Object.keys(STATE_DATA).map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#5a6680] font-medium block mb-1">District *</label>
                    <select className="w-full border border-[#c8d0e4] rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#154360]">
                      <option>Select District</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#5a6680] font-medium block mb-1">Tehsil</label>
                    <select className="w-full border border-[#c8d0e4] rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#154360]">
                      <option>Select Tehsil</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#5a6680] font-medium block mb-1">Village</label>
                    <input type="text" placeholder="Village name" className="w-full border border-[#c8d0e4] rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#154360] placeholder-[#aab0c0]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#5a6680] font-medium block mb-1">Document Type *</label>
                    <select className="w-full border border-[#c8d0e4] rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#154360]">
                      <option>Select Type</option>
                      <option>Jamabandi / RoR</option>
                      <option>Khatauni</option>
                      <option>Mutation Register</option>
                      <option>Survey Map / Cadastral</option>
                      <option>Patta</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#5a6680] font-medium block mb-1">Document Language *</label>
                    <select className="w-full border border-[#c8d0e4] rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#154360]">
                      <option>Select Language</option>
                      <option>Hindi (हिंदी)</option>
                      <option>Marathi (मराठी)</option>
                      <option>Tamil (தமிழ்)</option>
                      <option>Telugu (తెలుగు)</option>
                      <option>Bengali (বাংলা)</option>
                      <option>Gujarati (ગુજરાતી)</option>
                      <option>Kannada (ಕನ್ನಡ)</option>
                      <option>Punjabi (ਪੰਜਾਬੀ)</option>
                      <option>Odia (ଓଡ଼ିଆ)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#5a6680] font-medium block mb-1">Survey / Khasra Number</label>
                    <input type="text" placeholder="e.g. 123/A or 45" className="w-full border border-[#c8d0e4] rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#154360] placeholder-[#aab0c0] font-mono" />
                  </div>
                  <div>
                    <label className="text-xs text-[#5a6680] font-medium block mb-1">Approximate Year</label>
                    <select className="w-full border border-[#c8d0e4] rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#154360]">
                      <option>Unknown</option>
                      {Array.from({length:12},(_,i)=><option key={i}>{2024-i}</option>)}
                      <option>Pre-2000</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#5a6680] font-medium block mb-1">Remarks / Special Instructions</label>
                  <textarea rows={3} placeholder="Note any special conditions — damaged pages, mixed languages, partial records, etc."
                    className="w-full border border-[#c8d0e4] rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#154360] placeholder-[#aab0c0] resize-none" />
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#154360] mb-3">Upload Documents</div>
                <div className="border-2 border-dashed border-[#c8d0e4] rounded-sm p-8 text-center hover:border-[#154360] hover:bg-[#f5f9ff] transition-colors cursor-pointer min-h-[180px] flex flex-col items-center justify-center gap-2 mb-3">
                  <span className="text-4xl">📄</span>
                  <div className="text-sm font-semibold text-[#154360]">Click to upload or drag & drop</div>
                  <div className="text-xs text-[#5a6680]">PDF, TIFF, JPG, PNG · Max 50 MB per file</div>
                  <div className="text-xs text-[#5a6680]">Batch upload: up to 100 files</div>
                </div>
                <div className="bg-[#fffbeb] border border-[#f5a623]/40 rounded-sm px-3 py-2.5 text-xs text-[#78350f] mb-3">
                  <strong>Important:</strong> Ensure scanned documents are at minimum 300 DPI. Poor quality scans may result in lower extraction accuracy and require manual verification.
                </div>
                <button className="w-full py-2.5 bg-[#154360] text-white text-sm font-semibold rounded-sm hover:bg-[#1a5276] transition-colors mb-2">
                  Submit for Processing
                </button>
                <p className="text-xs text-[#5a6680] text-center">A Job ID will be generated for status tracking upon submission.</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ DASHBOARD ═══ */}
        {activeTab === "dashboard" && (
          <div className="space-y-5 mb-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total Documents Processed", value: "24,18,432", delta: "+14,832 today", color: "text-[#138808]" },
                { label: "Extraction Accuracy", value: "97.3%", delta: "+0.2% this week", color: "text-[#138808]" },
                { label: "Pending Verification", value: "1,204", delta: "−8% from yesterday", color: "text-[#f5a623]" },
                { label: "Rejected / Error Rate", value: "2.7%", delta: "Within SLA", color: "text-[#154360]" },
              ].map(card => (
                <div key={card.label} className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm p-4">
                  <div className="text-xs text-[#5a6680] mb-1">{card.label}</div>
                  <div className="text-2xl font-black text-[#154360]" style={{ fontFamily: "'Outfit', sans-serif" }}>{card.value}</div>
                  <div className={`text-xs mt-1 ${card.color}`}>{card.delta}</div>
                </div>
              ))}
            </div>
            <div className="grid lg:grid-cols-2 gap-5">
              <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm overflow-hidden">
                <SectionHeader title="Processing Volume — Last 7 Days" />
                <div className="p-4">
                  <div className="flex items-end gap-2 h-32">
                    {[9200,11400,8800,14200,12600,13100,14832].map((v,i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-[#5a6680] font-mono">{(v/1000).toFixed(1)}k</span>
                        <div className="w-full bg-[#154360] rounded-t-sm hover:bg-[#1a5276] transition-colors" style={{ height: `${(v/15000)*100}%`, minHeight: 4 }} />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2 text-xs text-[#9ca3af] justify-around">
                    {["22 Aug","23 Aug","24 Aug","25 Aug","26 Aug","27 Aug","28 Aug"].map(d=><span key={d}>{d}</span>)}
                  </div>
                </div>
              </div>
              <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm overflow-hidden">
                <SectionHeader title="Document Type Breakdown" />
                <div className="p-4 space-y-3">
                  {[
                    { type: "Jamabandi / RoR", count: 8420, pct: 57 },
                    { type: "Khatauni", count: 3210, pct: 22 },
                    { type: "Mutation Register", count: 1890, pct: 13 },
                    { type: "Survey Maps", count: 880, pct: 6 },
                    { type: "Patta / Others", count: 432, pct: 3 },
                  ].map(d => (
                    <div key={d.type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#374151]">{d.type}</span>
                        <span className="font-mono text-[#5a6680]">{d.count.toLocaleString("en-IN")} ({d.pct}%)</span>
                      </div>
                      <div className="h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
                        <div className="h-full bg-[#154360] rounded-full" style={{ width: `${d.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm overflow-hidden">
              <SectionHeader title="State-wise Summary Table" />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#eef2f8] text-[#154360] border-b border-[#d0d5dd]">
                      {["State","Digitized Documents","Districts Active","Coverage %","Nodal Officer","Status"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(STATE_DATA).map(([state, d], i) => (
                      <tr key={state} className={`border-b border-[#e5e7eb] hover:bg-[#f0f5ff] transition-colors ${i%2?"bg-[#fafbfc]":""}`}>
                        <td className="px-4 py-2.5 font-medium text-[#0d1b2e]">{state}</td>
                        <td className="px-4 py-2.5 font-mono">{d.docs.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-2.5">{d.district}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${d.pct}%`, background: d.pct>=70?"#138808":d.pct>=50?"#f5a623":"#dc2626" }} />
                            </div>
                            <span className="font-mono font-bold">{d.pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">{d.officer}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={d.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* HELP SECTION on home */}
        {activeTab === "home" && (
          <div className="grid sm:grid-cols-3 gap-4 mb-5">
            {[
              { icon: "📘", title: "User Manual", desc: "Step-by-step guide for officers and scanning staff", action: "Download PDF" },
              { icon: "🎓", title: "Training Videos", desc: "Video walkthroughs for document upload, verification, and dashboard use", action: "Watch Now" },
              { icon: "📞", title: "Technical Helpdesk", desc: "NIC Support: 1800-111-555 (Toll Free) · Mon–Fri, 9AM–6PM IST", action: "Raise Ticket" },
            ].map(h => (
              <div key={h.title} className="bg-white border border-[#d0d5dd] rounded-sm shadow-sm p-4 hover:border-[#154360]/40 hover:shadow-md transition-all">
                <div className="text-2xl mb-2">{h.icon}</div>
                <div className="font-semibold text-[#154360] text-sm mb-1">{h.title}</div>
                <div className="text-[#5a6680] text-xs leading-relaxed mb-3">{h.desc}</div>
                <button className="text-xs font-semibold text-[#154360] border border-[#154360] px-3 py-1.5 rounded-sm hover:bg-[#154360] hover:text-white transition-colors">{h.action} →</button>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer>
        <TricolorBar />
        <div className="bg-[#0d2137] text-white">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid lg:grid-cols-4 gap-8 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-lg">🏛</div>
                  <div>
                    <div className="font-bold text-white text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>BhuSetu | भूसेतु</div>
                    <div className="text-white/35 text-xs">Ministry of Panchayati Raj</div>
                  </div>
                </div>
                <p className="text-white/40 text-xs leading-relaxed mb-3">
                  Intelligent Land Record Digitization & Validation System under DILRMP Phase III, Digital India initiative.
                </p>
                <div className="text-white/25 text-xs font-mono">v2.4.1 · Build 20240828 · NIC MeghRaj</div>
              </div>
              {[
                { title: "Quick Links", links: ["Home", "Upload Document", "Track Status", "GIS Map Viewer", "Processing Queue", "Dashboard"] },
                { title: "Government Portals", links: ["india.gov.in", "digitalindia.gov.in", "dilrmp.gov.in", "nic.in", "meity.gov.in", "bhunaksha.gov.in"] },
                { title: "Policies & Help", links: ["Privacy Policy", "Terms of Use", "Accessibility Statement", "RTI Act 2005", "Hyperlinking Policy", "Technical Helpdesk"] },
              ].map(col => (
                <div key={col.title}>
                  <div className="text-[#f5a623] text-xs font-semibold uppercase tracking-wider mb-3">{col.title}</div>
                  <ul className="space-y-1.5">
                    {col.links.map(link => <li key={link}><a href="#" className="text-white/45 text-xs hover:text-white transition-colors">{link}</a></li>)}
                  </ul>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 pt-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/30">
              <div>© 2024 Government of India · Ministry of Panchayati Raj · National Informatics Centre</div>
              <div className="flex items-center gap-4">
                <span>Last Updated: 28 Aug 2024</span>
                <span>|</span>
                <span>Visitors: 4,28,931</span>
                <span>|</span>
                <a href="#" className="hover:text-white/60">Feedback</a>
              </div>
            </div>
            <div className="text-center text-white/15 text-xs mt-3">
              This is the official website of BhuSetu — Intelligent Land Record Digitization System · Government of India
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
