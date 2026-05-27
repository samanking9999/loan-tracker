// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  LOAN TRACKER v7 — Google Drive sync + localStorage fallback             ║
// ║  Data: Property (tên + ghi chú) → Loan[] (mỗi khoản: NH, lãi, kỳ hạn) ║
// ║                                                                          ║
// ║  [CFG]   Cấu hình: ngân hàng, màu, dữ liệu mẫu                         ║
// ║  [CALC]  Công thức: lịch trả nợ, lãi suất nhiều giai đoạn              ║
// ║  [STORE] Lưu trữ: Google Drive sync + localStorage + export JSON         ║
// ║  [UI]    UI primitives                                                   ║
// ║  [MENU]  Dropdown phương thức lãi + công thức                           ║
// ║  [PFORM] Form Dự án (tên + ghi chú)                                    ║
// ║  [LFORM] Form Khoản vay + preview real-time                             ║
// ║  [RATE]  Panel lịch sử lãi suất                                         ║
// ║  [TAB1]  Tab Tổng quan: Property cards → Loan rows                      ║
// ║  [TAB2]  Tab Chi tiết khoản vay                                         ║
// ║  [TAB3]  Tab Lịch sử 12 tháng                                           ║
// ║  [APP]   App Root                                                        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { useState, useMemo, useEffect, useCallback, useRef } from "react";


// ════════════════════════════════════════════════════════════════════════════
// [CFG] SECTION 1 · CẤU HÌNH
// ════════════════════════════════════════════════════════════════════════════

const BANKS = [
  "BIDV","Vietcombank","MB Bank","Techcombank",
  "VPBank","ACB","Sacombank","HDBank","Agribank","OCB",
];

const PALETTE = [
  "#f59e0b","#34d399","#60a5fa","#f472b6",
  "#a78bfa","#fb923c","#2dd4bf","#e879f9",
];

const LOAN_COLORS = [
  "#f59e0b","#60a5fa","#f472b6","#34d399","#a78bfa","#fb923c",
];

const INTEREST_METHODS = [
  {
    id: "declining_grace",
    label: "Ân hạn → Dư nợ giảm dần",
    short: "Ân hạn + Gốc đều",
    tag: "BĐS phổ biến",
    desc: "Trong ân hạn chỉ trả lãi. Sau ân hạn trả gốc chia đều + lãi tính trên dư nợ còn lại (giảm dần mỗi tháng).",
    formula: "Ân hạn: Lãi = P × r/12\nSau ân hạn: Gốc = P ÷ n_còn  |  Lãi(t) = Dư_nợ(t) × r/12",
  },
  {
    id: "declining_no_grace",
    label: "Dư nợ giảm dần — Gốc đều",
    short: "Gốc đều",
    tag: "Phổ biến",
    desc: "Gốc chia đều từ tháng đầu. Lãi tính trên dư nợ còn lại giảm dần theo thời gian.",
    formula: "Gốc = P ÷ n  |  Lãi(t) = Dư_nợ(t) × r/12",
  },
  {
    id: "annuity",
    label: "Annuity — Khoản trả cố định",
    short: "Annuity",
    tag: "Vay tiêu dùng",
    desc: "PMT mỗi tháng cố định. Gốc tăng dần, lãi giảm dần.",
    formula: "PMT = P × [r(1+r)ⁿ] ÷ [(1+r)ⁿ − 1]  |  Gốc(t) = PMT − Lãi(t)",
  },
];

// ── Dữ liệu mẫu ──────────────────────────────────────────────────────────────
const INITIAL_PROPERTIES = [
  {
    id: "p1", color: PALETTE[0],
    name: "Nhà phố Quận 7",
    note: "Nhà phố liền kề, hợp đồng thuê 3 năm",
    rentalIncome: 45_000_000,
    loans: [
      {
        id: "p1-l1", color: LOAN_COLORS[0],
        name: "Vay BIDV", bank: "BIDV",
        disburseDate: "2023-06-01", principal: 2_500_000_000,
        termMonths: 240, gracePeriod: 24,
        interestMethod: "declining_grace",
        rateHistory: [
          { effectiveDate: "2023-06-01", rate: 9.5,  note: "Lãi suất ký HĐ" },
          { effectiveDate: "2024-06-01", rate: 10.2, note: "Điều chỉnh định kỳ" },
        ],
      },
      {
        id: "p1-l2", color: LOAN_COLORS[1],
        name: "Vay Vietcombank", bank: "Vietcombank",
        disburseDate: "2023-08-15", principal: 1_000_000_000,
        termMonths: 120, gracePeriod: 12,
        interestMethod: "declining_grace",
        rateHistory: [{ effectiveDate: "2023-08-15", rate: 8.8, note: "Lãi suất ban đầu" }],
      },
    ],
  },
  {
    id: "p2", color: PALETTE[1],
    name: "Căn hộ Bình Thạnh",
    note: "Căn 2PN tầng 15, view sông",
    rentalIncome: 28_000_000,
    loans: [
      {
        id: "p2-l1", color: LOAN_COLORS[0],
        name: "Vay MB Bank", bank: "MB Bank",
        disburseDate: "2024-01-15", principal: 2_100_000_000,
        termMonths: 180, gracePeriod: 12,
        interestMethod: "declining_grace",
        rateHistory: [
          { effectiveDate: "2024-01-15", rate: 8.5,  note: "Ưu đãi 12 tháng" },
          { effectiveDate: "2025-01-15", rate: 9.8,  note: "Hết ưu đãi" },
        ],
      },
    ],
  },
  {
    id: "p3", color: PALETTE[2],
    name: "Nhà phố Thủ Đức",
    note: "Mặt tiền đường lớn, cho thuê KD",
    rentalIncome: 22_000_000,
    loans: [
      {
        id: "p3-l1", color: LOAN_COLORS[0],
        name: "Vay ACB", bank: "ACB",
        disburseDate: "2024-09-01", principal: 1_200_000_000,
        termMonths: 120, gracePeriod: 0,
        interestMethod: "declining_no_grace",
        rateHistory: [{ effectiveDate: "2024-09-01", rate: 10.2, note: "Lãi suất ban đầu" }],
      },
      {
        id: "p3-l2", color: LOAN_COLORS[1],
        name: "Vay Techcombank", bank: "Techcombank",
        disburseDate: "2024-11-01", principal: 600_000_000,
        termMonths: 60, gracePeriod: 0,
        interestMethod: "declining_no_grace",
        rateHistory: [{ effectiveDate: "2024-11-01", rate: 9.9, note: "Vay bổ sung" }],
      },
    ],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// [CALC] SECTION 2 · CÔNG THỨC
// ════════════════════════════════════════════════════════════════════════════

const fmt   = (n) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n ?? 0);
const fmtM  = (n) => { const a = Math.abs(n ?? 0); return a >= 1e9 ? (n / 1e9).toFixed(2) + " tỷ" : a >= 1e6 ? (n / 1e6).toFixed(1) + " tr" : fmt(n); };
const sign  = (n) => (n >= 0 ? "+" : "") + fmtM(n);
const mkKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const mkLbl = (d) => `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
const addMo = (str, n) => { const d = new Date(str); d.setMonth(d.getMonth() + n); return d; };
const nowKey = () => mkKey(new Date());
const uid   = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function getRateForMonth(rateHistory, monthKey) {
  const sorted = [...rateHistory].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  let cur = sorted[0]?.rate ?? 0;
  for (const item of sorted) {
    if (item.effectiveDate.slice(0, 7) <= monthKey) cur = item.rate;
    else break;
  }
  return cur;
}

function buildSchedule(loan) {
  const rows = [];
  const grace  = loan.gracePeriod ?? 0;
  const term   = loan.termMonths;
  let   balance = loan.principal;
  const repayN  = term - grace;
  const eqPrin  = repayN > 0 ? loan.principal / repayN : 0;
  const r0      = (loan.rateHistory?.[0]?.rate ?? 9) / 100 / 12;
  const annuPMT = loan.interestMethod === "annuity" && r0 > 0
    ? (loan.principal * r0 * Math.pow(1 + r0, term)) / (Math.pow(1 + r0, term) - 1)
    : loan.principal / term;

  for (let i = 0; i < term; i++) {
    const date    = addMo(loan.disburseDate, i + 1);
    const mkey   = mkKey(date);
    const rate   = getRateForMonth(loan.rateHistory ?? [], mkey);
    const r      = rate / 100 / 12;
    const inGrace = loan.interestMethod === "declining_grace" && i < grace;
    const interest = balance * r;
    let   principal = 0;
    if (!inGrace) {
      if (loan.interestMethod === "annuity") principal = annuPMT - interest;
      else principal = eqPrin;
    }
    principal = Math.min(Math.max(principal, 0), balance);
    balance   = Math.max(0, balance - principal);
    rows.push({
      month: i + 1, date, monthKey: mkey, monthLabel: mkLbl(date),
      rate, interest, principal, totalPayment: interest + principal,
      balance, inGrace, loanId: loan.id,
    });
  }
  return rows;
}

function calcPreview(loan) {
  const rh     = loan.rateHistory ?? [{ effectiveDate: loan.disburseDate ?? "", rate: 9 }];
  const curRate = [...rh].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]?.rate ?? 9;
  const r      = curRate / 100 / 12;
  const grace  = loan.gracePeriod ?? 0;
  const repayN = loan.termMonths - grace;
  const eqPrin = repayN > 0 ? loan.principal / repayN : 0;
  const annuPMT = loan.interestMethod === "annuity" && r > 0
    ? (loan.principal * r * Math.pow(1 + r, loan.termMonths)) / (Math.pow(1 + r, loan.termMonths) - 1) : 0;
  let totalInt = 0, bal = loan.principal;
  for (let i = 0; i < loan.termMonths; i++) {
    const inG = loan.interestMethod === "declining_grace" && i < grace;
    const li  = bal * r;
    const pi  = inG ? 0 : loan.interestMethod === "annuity" ? annuPMT - li : eqPrin;
    totalInt += li;
    bal = Math.max(0, bal - Math.min(Math.max(pi, 0), bal));
  }
  return { curRate, r, grace, repayN, eqPrin, annuPMT, totalInt, interestMonth: loan.principal * r };
}

function summariseProperty(prop, schedules, mk) {
  let totBalance = 0, totInterest = 0, totPrincipal = 0;
  const loanRows = prop.loans.map(l => {
    const row = schedules[l.id]?.find(r => r.monthKey === mk) ?? null;
    totBalance   += row?.balance   ?? l.principal;
    totInterest  += row?.interest  ?? 0;
    totPrincipal += row?.principal ?? 0;
    return { ...l, row };
  });
  const netCF = prop.rentalIncome - totInterest - totPrincipal;
  return { ...prop, loanRows, totBalance, totInterest, totPrincipal, netCF };
}

// ════════════════════════════════════════════════════════════════════════════
// [STORE] SECTION 3 · LƯU TRỮ
// ════════════════════════════════════════════════════════════════════════════
//
//  3 lớp lưu trữ (ưu tiên từ trên xuống):
//  1. Google Drive appDataFolder — không mất dù xóa cache, sync mọi thiết bị
//  2. localStorage              — đọc/ghi tức thì, dùng được offline
//  3. Export JSON thủ công      — backup tuyệt đối
//
//  ĐỂ BẬT GOOGLE DRIVE: thay GD_CLIENT_ID bằng OAuth Client ID của bạn
//  (xem file HUONG_DAN_DEPLOY.md — Bước A)
// ════════════════════════════════════════════════════════════════════════════

const GD_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
const GD_SCOPES    = "https://www.googleapis.com/auth/drive.appdata";
const GD_FILE_NAME = "loan_tracker_data.json";
const STORAGE_KEY  = "loan_tracker_v7";

// ── Lớp 2: localStorage ──────────────────────────────────────────────────────
function loadLocal() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; }
  catch(_e) { return null; }
}
function saveLocal(p) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch(_e) {}
}

// ── Lớp 1: Google Drive helpers ──────────────────────────────────────────────

function initGoogleAuth(onReady) {
  const s1 = document.createElement("script");
  s1.src = "https://apis.google.com/js/api.js";
  s1.onload = () => {
    gapi.load("client", async () => {
      await gapi.client.init({
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
      });
      const s2 = document.createElement("script");
      s2.src = "https://accounts.google.com/gsi/client";
      s2.onload = () => {
        const tc = google.accounts.oauth2.initTokenClient({
          client_id: GD_CLIENT_ID,
          scope: GD_SCOPES,
          callback: () => {},
        });
        onReady(tc);
      };
      document.body.appendChild(s2);
    });
  };
  document.body.appendChild(s1);
}

function getToken(tokenClient) {
  return new Promise((resolve, reject) => {
    tokenClient.callback = (resp) => {
      if (resp.error) reject(resp.error);
      else resolve(resp.access_token);
    };
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

async function findDriveFile() {
  const res = await gapi.client.drive.files.list({
    spaces: "appDataFolder",
    q: `name='${GD_FILE_NAME}'`,
    fields: "files(id,modifiedTime)",
  });
  return res.result.files?.[0] ?? null;
}

async function readDriveFile(fileId) {
  const res = await gapi.client.request({
    path: `/drive/v3/files/${fileId}`,
    params: { alt: "media" },
  });
  return typeof res.result === "string" ? JSON.parse(res.result) : res.result;
}

async function writeDriveFile(token, data, existingFileId) {
  const body = JSON.stringify({ version: 7, savedAt: new Date().toISOString(), properties: data });
  const blob = new Blob([body], { type: "application/json" });
  const form = new FormData();

  if (existingFileId) {
    form.append("metadata", new Blob(["{}"], { type: "application/json" }));
    form.append("file", blob);
    await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`,
      { method: "PATCH", headers: { Authorization: `Bearer ${token}` }, body: form }
    );
    return existingFileId;
  } else {
    form.append("metadata", new Blob(
      [JSON.stringify({ name: GD_FILE_NAME, parents: ["appDataFolder"] })],
      { type: "application/json" }
    ));
    form.append("file", blob);
    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
      { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form }
    );
    const json = await res.json();
    return json.id;
  }
}

// Hook quản lý toàn bộ Google Drive sync
function useGoogleDriveSync({ onLoadSuccess }: { onLoadSuccess: (p: any[]) => void }) {
  const [gdStatus,    setGdStatus]    = useState("idle");
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [gdToken,     setGdToken]     = useState<string|null>(null);
  const [gdFileId,    setGdFileId]    = useState<string|null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  const isConfigured = GD_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

  useEffect(() => {
    if (!isConfigured) { setGdStatus("disabled"); return; }
    initGoogleAuth(tc => { setTokenClient(tc); setGdStatus("idle"); });
  }, []);

  const gdSignIn = useCallback(async () => {
    if (!tokenClient) return;
    setGdStatus("loading");
    try {
      const token = await getToken(tokenClient);
      setGdToken(token);
      const file = await findDriveFile();
      if (file) {
        setGdFileId(file.id);
        const data = await readDriveFile(file.id);
        const props = data.properties ?? data;
        if (Array.isArray(props) && props.length > 0) onLoadSuccess(props);
      }
      setGdStatus("ready");
    } catch(e) {
      console.error("GD sign in", e);
      setGdStatus("error");
    }
  }, [tokenClient, onLoadSuccess]);

  const gdSignOut = useCallback(() => {
    if (gdToken) google?.accounts?.oauth2?.revoke(gdToken);
    setGdToken(null); setGdFileId(null); setGdStatus("idle");
  }, [gdToken]);

  const syncToDrive = useCallback((properties) => {
    if (!gdToken || gdStatus !== "ready") return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        const newId = await writeDriveFile(gdToken, properties, gdFileId);
        if (!gdFileId) setGdFileId(newId);
      } catch(e) {
        console.error("GD sync", e);
        if ((e as {status?:number})?.status === 401 && tokenClient) {
          try {
            const t = await getToken(tokenClient);
            setGdToken(t);
            await writeDriveFile(t, properties, gdFileId);
          } catch(_e2) {}
        }
      }
    }, 2000);
  }, [gdToken, gdStatus, gdFileId, tokenClient]);

  return { gdStatus, gdSignIn, gdSignOut, syncToDrive, isConfigured };
}

// ── Lớp 3: Export / Import JSON ──────────────────────────────────────────────
function exportJSON(properties) {
  const blob = new Blob([JSON.stringify({ version: 7, exportedAt: new Date().toISOString(), properties }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = `loan_tracker_${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}
function importJSON(file, onOk, onErr) {
  const r = new FileReader();
  r.onload = e => { try { const d = JSON.parse((e.target as FileReader).result as string); onOk(d.properties ?? d); } catch(_e) { onErr(); } };
  r.readAsText(file);
}

// ════════════════════════════════════════════════════════════════════════════
// [UI] SECTION 4 · UI PRIMITIVES
// ════════════════════════════════════════════════════════════════════════════

// ── Layout shells ──────────────────────────────────────────────────────────
function ModalShell({ onClose, children, width = 860 }) {
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)",padding:16 }}
      onClick={onClose}>
      <div style={{ background:"#0b1120",border:"1px solid #1e293b",borderRadius:16,width:"100%",maxWidth:width,maxHeight:"92vh",display:"flex",flexDirection:"column",overflow:"hidden" }}
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
function MHead({ title, sub, onClose }) {
  return (
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",borderBottom:"1px solid #1a2540",flexShrink:0 }}>
      <div>
        <div style={{ fontWeight:800,fontSize:15,color:"#e2e8f0" }}>{title}</div>
        {sub && <div style={{ fontSize:11,color:"#334155",marginTop:2 }}>{sub}</div>}
      </div>
      <button onClick={onClose} style={{ background:"none",border:"none",color:"#334155",fontSize:20,cursor:"pointer",lineHeight:1 }}>✕</button>
    </div>
  );
}
function MFoot({ children }) {
  return <div style={{ display:"flex",justifyContent:"flex-end",gap:9,padding:"11px 20px",borderTop:"1px solid #1a2540",flexShrink:0 }}>{children}</div>;
}

function Section({ title, sub, children, flush, action }) {
  return (
    <div style={{ background:"#0b1120",border:"1px solid #1e293b",borderRadius:12,overflow:"hidden" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderBottom:"1px solid #1a2540" }}>
        <span style={{ fontWeight:700,color:"#e2e8f0",fontSize:13 }}>{title}</span>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          {sub && <span style={{ fontSize:11,color:"#475569" }}>{sub}</span>}
          {action}
        </div>
      </div>
      <div style={flush ? {} : { padding:"13px 16px" }}>{children}</div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background:"#0b1120",border:`1px solid ${hov&&onClick?"#334155":"#1e293b"}`,borderTop:`3px solid ${color}`,
        borderRadius:12,padding:"14px 16px",cursor:onClick?"pointer":"default",
        transform:hov&&onClick?"translateY(-2px)":"none",transition:"all .18s",
        boxShadow:hov&&onClick?`0 8px 24px ${color}22`:"none" }}>
      <div style={{ display:"flex",justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:1.2,marginBottom:6,fontWeight:700 }}>{label}</div>
          <div style={{ fontSize:20,fontWeight:900,color,fontFamily:"monospace" }}>{value}</div>
          {sub && <div style={{ fontSize:11,color:"#475569",marginTop:4 }}>{sub}</div>}
        </div>
        <div style={{ display:"flex",flexDirection:"column",justifyContent:"space-between",alignItems:"flex-end" }}>
          <span style={{ fontSize:22,opacity:.35 }}>{icon}</span>
          {onClick && <span style={{ fontSize:9,color:"#334155",fontWeight:700,letterSpacing:.5 }}>XEM CHI TIẾT ›</span>}
        </div>
      </div>
    </div>
  );
}

// ── Table ──────────────────────────────────────────────────────────────────
function Table({ headers, children, maxH }) {
  return (
    <div style={{ overflowX:"auto",overflowY:maxH?"auto":"visible",maxHeight:maxH }}>
      <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
        <thead style={{ position:"sticky",top:0,zIndex:2 }}>
          <tr style={{ background:"#060b14" }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding:"7px 10px",textAlign:h.r?"right":"left",color:h.c||"#475569",
                fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:.6,
                whiteSpace:"nowrap",borderBottom:"1px solid #1a2540" }}>
                {h.l ?? h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function TR({ children, highlight, accent, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <tr onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ borderBottom:"1px solid #0d1522",cursor:onClick?"pointer":"default",
        background: highlight ? "rgba(245,158,11,.07)" : accent ? "rgba(255,255,255,.018)" : hov&&onClick ? "rgba(255,255,255,.025)" : "transparent",
        outline: highlight ? "1px solid rgba(245,158,11,.2)" : "none",
        transition:"background .12s" }}>
      {children}
    </tr>
  );
}
function TD({ v, c, mono, r, bold, faded, indent }) {
  return (
    <td style={{ padding:"7px 10px",color:faded?"#2a3a50":c||"#64748b",
      fontFamily:mono?"monospace":"inherit",textAlign:r?"right":"left",
      fontWeight:bold?700:400,whiteSpace:"nowrap",fontSize:12,
      paddingLeft:indent?26:10 }}>
      {v ?? <span style={{ color:"#2a3a50" }}>—</span>}
    </td>
  );
}

// ── Bar chart ──────────────────────────────────────────────────────────────
function BarChart({ data, keys, colors, nameMap, h = 130 }) {
  const [hov, setHov] = useState(null);
  const max = Math.max(...data.map(d => keys.reduce((s, k) => s + (d[k] || 0), 0)), 1);
  return (
    <div style={{ display:"flex",alignItems:"flex-end",gap:3,height:h,padding:"0 2px" }}>
      {data.map((d, i) => {
        const total = keys.reduce((s, k) => s + (d[k] || 0), 0);
        const pct   = (total / max) * 100;
        return (
          <div key={i}
            style={{ flex:1,height:`${Math.max(pct, total>0?1.5:0)}%`,display:"flex",flexDirection:"column",justifyContent:"flex-end",gap:1,position:"relative" }}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            {hov === i && total > 0 && (
              <div style={{ position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",
                background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"9px 12px",
                zIndex:30,minWidth:150,boxShadow:"0 12px 32px rgba(0,0,0,.65)",pointerEvents:"none" }}>
                <div style={{ fontWeight:800,marginBottom:5,color:"#e2e8f0",fontSize:11 }}>{d.label}</div>
                {keys.filter(k => d[k] > 0).map(k => (
                  <div key={k} style={{ color:colors[keys.indexOf(k)],fontSize:11,marginBottom:2 }}>
                    {nameMap?.[k] || k}: {fmtM(d[k])}
                  </div>
                ))}
                <div style={{ color:"#fbbf24",fontWeight:800,marginTop:5,fontSize:12,borderTop:"1px solid #334155",paddingTop:4 }}>
                  Tổng: {fmtM(total)}
                </div>
              </div>
            )}
            {keys.map((k, ki) => (
              <div key={k} style={{ flex:(d[k]||0)/(total||1),background:colors[ki],minHeight:d[k]>0?2:0,
                borderRadius:ki===keys.length-1?"2px 2px 0 0":0,
                opacity:hov!==null&&hov!==i?.3:1,transition:"opacity .2s" }}/>
            ))}
          </div>
        );
      })}
    </div>
  );
}
function ChartX({ labels }) {
  return (
    <div style={{ display:"flex",marginTop:5,padding:"0 2px" }}>
      {labels.map((l, i) => <span key={i} style={{ flex:1,fontSize:9,color:"#334155",textAlign:"center" }}>{l}</span>)}
    </div>
  );
}
function Legend({ items }) {
  return (
    <div style={{ display:"flex",flexWrap:"wrap",gap:"5px 14px",marginTop:9 }}>
      {items.map(it => (
        <span key={it.label} style={{ display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#64748b" }}>
          <span style={{ width:9,height:9,borderRadius:2,background:it.color,display:"inline-block",flexShrink:0 }}/>
          {it.label}
        </span>
      ))}
    </div>
  );
}

function ProgressBar({ pct, label1, label2 }) {
  return (
    <div>
      <div style={{ position:"relative",height:14,background:"#1a2540",borderRadius:7,overflow:"hidden" }}>
        <div style={{ position:"absolute",left:0,top:0,height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#6d28d9,#a78bfa)" }}/>
        <div style={{ position:"absolute",left:`${pct}%`,top:0,height:"100%",width:`${100-pct}%`,background:"linear-gradient(90deg,#047857,#34d399)" }}/>
      </div>
      <div style={{ display:"flex",justifyContent:"space-between",marginTop:4 }}>
        <span style={{ fontSize:10,color:"#a78bfa" }}>{label1}</span>
        <span style={{ fontSize:10,color:"#34d399" }}>{label2}</span>
      </div>
    </div>
  );
}

// ── Badges ──────────────────────────────────────────────────────────────────
const bdg = (c, bg) => ({ background:bg,color:c,border:`1px solid ${c}40`,borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700,letterSpacing:.3,whiteSpace:"nowrap" });
function GraceBadge({ inGrace }) { return inGrace ? <span style={bdg("#a78bfa","rgba(167,139,250,.12)")}>⏳ Ân hạn</span> : <span style={bdg("#34d399","rgba(52,211,153,.1)")}>✅ Trả gốc</span>; }
function BankBadge({ bank, color }) { return <span style={bdg(color, color + "18")}>{bank}</span>; }

// ── Buttons ──────────────────────────────────────────────────────────────────
function BtnP({ onClick, children, small }) {
  return <button onClick={onClick} style={{ background:"#f59e0b",border:"none",borderRadius:7,padding:small?"6px 11px":"8px 18px",color:"#060b14",fontWeight:800,cursor:"pointer",fontSize:small?11:13 }}>{children}</button>;
}
function BtnG({ onClick, children, danger, small }) {
  return <button onClick={onClick} style={{ background:"none",border:`1px solid ${danger?"#7f1d1d":"#1e293b"}`,borderRadius:7,padding:small?"5px 9px":"7px 13px",color:danger?"#f87171":"#64748b",cursor:"pointer",fontSize:small?11:12 }}>{children}</button>;
}

// ── Month picker ─────────────────────────────────────────────────────────────
function MonthPicker({ value, onChange }) {
  const months = useMemo(() => {
    const list = []; const now = new Date();
    for (let i = -24; i <= 12; i++) { const d = addMo(now.toISOString().slice(0, 10), i); list.push({ key: mkKey(d), label: mkLbl(d) }); }
    return list;
  }, []);
  return (
    <div style={{ display:"flex",gap:4,alignItems:"center" }}>
      <span style={{ fontSize:9,color:"#334155",fontWeight:700,letterSpacing:.8 }}>THÁNG</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ background:"#111827",border:"1px solid #1e293b",borderRadius:6,color:"#e2e8f0",padding:"5px 8px",fontSize:12,fontFamily:"monospace" }}>
        {months.map(m => <option key={m.key} value={m.key} style={{ background:"#111827" }}>{m.label}{m.key === nowKey() ? " ← nay" : ""}</option>)}
      </select>
    </div>
  );
}

// ── Form primitives ──────────────────────────────────────────────────────────
function FF({ label, hint, req, span2, children }) {
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:4,gridColumn:span2?"1/-1":undefined }}>
      <label style={{ fontSize:10,color:"#5a6a82",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,display:"flex",gap:3 }}>
        {label}{req && <span style={{ color:"#f87171" }}>*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize:10,color:"#2d3f55",lineHeight:1.4 }}>{hint}</span>}
    </div>
  );
}
const FI = ({ value, onChange, type="text", placeholder, step, min, max }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder} step={step} min={min} max={max}
    style={{ background:"#060b14",border:"1px solid #1a2540",borderRadius:6,padding:"8px 10px",color:"#e2e8f0",
      fontSize:13,width:"100%",boxSizing:"border-box",outline:"none",fontFamily:type==="number"?"monospace":"inherit" }}/>
);
const FS = ({ value, onChange, children }) => (
  <select value={value} onChange={onChange}
    style={{ background:"#060b14",border:"1px solid #1a2540",borderRadius:6,padding:"8px 10px",color:"#e2e8f0",fontSize:13,width:"100%",outline:"none" }}>
    {children}
  </select>
);
const FTA = ({ value, onChange, placeholder, rows = 2 }) => (
  <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
    style={{ background:"#060b14",border:"1px solid #1a2540",borderRadius:6,padding:"8px 10px",color:"#e2e8f0",
      fontSize:12,width:"100%",boxSizing:"border-box",outline:"none",resize:"vertical",lineHeight:1.5 }}/>
);
function FGrid({ cols = "1fr 1fr", children }) {
  return <div style={{ display:"grid",gridTemplateColumns:cols,gap:"10px 13px" }}>{children}</div>;
}
function BlockTitle({ icon, label }) {
  return (
    <div style={{ display:"flex",alignItems:"center",gap:7,padding:"12px 0 8px",borderBottom:"1px solid #1a2540",marginBottom:10 }}>
      <span style={{ fontSize:12 }}>{icon}</span>
      <span style={{ fontSize:10,fontWeight:800,color:"#475569",textTransform:"uppercase",letterSpacing:1 }}>{label}</span>
    </div>
  );
}

// Preview sub-components (dùng trong form)
function PG({ label, children }) {
  return (
    <div style={{ marginBottom:11 }}>
      <div style={{ fontSize:9,color:"#2d3f55",textTransform:"uppercase",letterSpacing:.8,fontWeight:700,marginBottom:4,paddingBottom:3,borderBottom:"1px solid #0d1522" }}>{label}</div>
      {children}
    </div>
  );
}
function PR({ l, v, c, lg }) {
  return (
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 0" }}>
      <span style={{ fontSize:10,color:"#3a4f66" }}>{l}</span>
      <span style={{ fontSize:lg?13:11,fontWeight:lg?800:600,color:c,fontFamily:"monospace" }}>{v}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// [MENU] SECTION 5 · MENU PHƯƠNG THỨC LÃI
// ════════════════════════════════════════════════════════════════════════════

function InterestMethodMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const sel = INTEREST_METHODS.find(m => m.id === value) ?? INTEREST_METHODS[0];
  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(p => !p)}
        style={{ width:"100%",background:"#060b14",border:"1px solid #1a2540",borderRadius:6,padding:"9px 11px",
          color:"#e2e8f0",textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8 }}>
        <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
          <span style={{ fontSize:13,fontWeight:700 }}>{sel.label}</span>
          <span style={{ fontSize:10,color:"#475569",fontFamily:"monospace" }}>{sel.formula.split("\n")[0]}</span>
        </div>
        <span style={{ color:"#334155",fontSize:11,flexShrink:0 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"#0d1525",
          border:"1px solid #334155",borderRadius:10,zIndex:60,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,.75)" }}>
          {INTEREST_METHODS.map(m => {
            const active = m.id === value;
            return (
              <div key={m.id} onClick={() => { onChange(m.id); setOpen(false); }}
                style={{ padding:"13px 15px",cursor:"pointer",borderBottom:"1px solid #1a2540",
                  background:active?"rgba(245,158,11,.06)":"transparent" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                  <span style={{ fontWeight:700,fontSize:13,color:active?"#f59e0b":"#e2e8f0" }}>{active && "✓ "}{m.label}</span>
                  <span style={{ fontSize:9,fontWeight:700,color:"#60a5fa",background:"rgba(96,165,250,.1)",border:"1px solid rgba(96,165,250,.25)",borderRadius:4,padding:"2px 6px" }}>{m.tag}</span>
                </div>
                <div style={{ fontSize:11,color:"#4a5e75",lineHeight:1.5,marginBottom:6 }}>{m.desc}</div>
                <div style={{ background:"#060b14",border:"1px solid #1a2540",borderRadius:5,padding:"6px 9px" }}>
                  {m.formula.split("\n").map((line, i) => (
                    <div key={i} style={{ fontFamily:"monospace",fontSize:10,color:"#60a5fa",lineHeight:1.7 }}>{line}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// [PFORM] SECTION 6 · FORM DỰ ÁN — tên + ghi chú + thu nhập cho thuê
// ════════════════════════════════════════════════════════════════════════════

function PropertyFormModal({ property, onSave, onClose, nextColor }) {
  const [f, setF] = useState(property ?? {
    id: uid(), color: nextColor,
    name: "", note: "", rentalIncome: 20_000_000, loans: [],
  });
  const setK = k => e => setF(p => ({ ...p, [k]: e.target.type === "number" ? +e.target.value : e.target.value }));

  return (
    <ModalShell onClose={onClose} width={500}>
      <MHead title={property ? "✏️ Sửa dự án" : "🏠 Thêm dự án mới"} sub="Khoản vay sẽ thêm sau vào dự án này" onClose={onClose}/>
      <div style={{ flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12 }}>

        <FF label="Tên dự án / tài sản" req>
          <FI value={f.name} onChange={setK("name")} placeholder="VD: Nhà phố Quận 7, Căn hộ Vinhomes…"/>
        </FF>

        <FF label="Thu nhập cho thuê / tháng (VNĐ)" hint={`Năm: ${fmtM((f.rentalIncome||0) * 12)}`}>
          <FI type="number" value={f.rentalIncome} onChange={setK("rentalIncome")} min={0}/>
        </FF>

        {/* Màu nhận diện */}
        <FF label="Màu nhận diện">
          <div style={{ display:"flex",gap:8,flexWrap:"wrap",paddingTop:4 }}>
            {PALETTE.map(c => (
              <div key={c} onClick={() => setF(p => ({ ...p, color: c }))}
                style={{ width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",
                  border:f.color===c?"3px solid #fff":"3px solid transparent",transition:"border .15s" }}/>
            ))}
          </div>
        </FF>

        <FF label="Ghi chú">
          <FTA value={f.note} onChange={setK("note")} placeholder="Mô tả ngắn, địa chỉ, hợp đồng thuê…" rows={3}/>
        </FF>
      </div>
      <MFoot>
        <BtnG onClick={onClose}>Hủy</BtnG>
        <BtnP onClick={() => { if (!f.name.trim()) return alert("Nhập tên dự án"); onSave(f); }}>💾 Lưu dự án</BtnP>
      </MFoot>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// [LFORM] SECTION 7 · FORM KHOẢN VAY
// ════════════════════════════════════════════════════════════════════════════

function emptyLoan(propName, idx) {
  return {
    id: uid(), color: LOAN_COLORS[idx % LOAN_COLORS.length],
    name: `Khoản vay ${propName}`,
    bank: BANKS[0], disburseDate: new Date().toISOString().slice(0, 10),
    principal: 1_000_000_000, termMonths: 120, gracePeriod: 12,
    interestMethod: "declining_grace",
    rateHistory: [{ effectiveDate: new Date().toISOString().slice(0, 10), rate: 9.0, note: "Lãi suất ban đầu" }],
  };
}

function LoanFormModal({ loan, propName, loanCount, onSave, onClose }) {
  const [f, setF] = useState(loan ?? emptyLoan(propName, loanCount));
  const setK = k => e => setF(p => ({ ...p, [k]: e.target ? (e.target.type === "number" ? +e.target.value : e.target.value) : e }));
  const pv = calcPreview(f);
  const isGrace   = f.interestMethod === "declining_grace";
  const isAnnuity = f.interestMethod === "annuity";
  const nc = n => n >= 0 ? "#34d399" : "#f87171";
  const curRate = [...(f.rateHistory ?? [])].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0]?.rate ?? 9;

  return (
    <ModalShell onClose={onClose} width={920}>
      <MHead title={loan ? "✏️ Sửa khoản vay" : "➕ Thêm khoản vay"} sub={`Dự án: ${propName} · Preview cập nhật real-time`} onClose={onClose}/>
      <div style={{ display:"flex",flex:1,overflow:"hidden" }}>

        {/* LEFT — fields */}
        <div style={{ flex:1,padding:"13px 18px",overflowY:"auto" }}>

          <BlockTitle icon="🏦" label="Thông tin khoản vay"/>
          <FGrid>
            <FF label="Tên khoản vay" req span2>
              <FI value={f.name} onChange={setK("name")} placeholder="VD: Vay BIDV đợt 1"/>
            </FF>
            <FF label="Ngân hàng" req>
              <FS value={f.bank} onChange={setK("bank")}>{BANKS.map(b => <option key={b}>{b}</option>)}</FS>
            </FF>
            <FF label="Ngày giải ngân" req>
              <FI type="date" value={f.disburseDate} onChange={setK("disburseDate")}/>
            </FF>
          </FGrid>

          <BlockTitle icon="💵" label="Thông số vay"/>
          <FGrid>
            <FF label="Số tiền vay (VNĐ)" req hint={fmtM(f.principal)}>
              <FI type="number" value={f.principal} onChange={setK("principal")} min={0}/>
            </FF>
            <FF label="Kỳ hạn tổng (tháng)" req hint={`${Math.floor(f.termMonths/12)} năm ${f.termMonths%12} tháng`}>
              <FI type="number" value={f.termMonths} onChange={setK("termMonths")} min={1}/>
            </FF>
            {isGrace && (
              <FF label="Thời gian ân hạn (tháng)" hint={`Trả gốc từ tháng ${(f.gracePeriod??0)+1}`}>
                <FI type="number" value={f.gracePeriod} onChange={setK("gracePeriod")} min={0} max={f.termMonths - 1}/>
              </FF>
            )}
          </FGrid>

          <BlockTitle icon="📐" label="Phương thức tính lãi"/>
          <FF label="Chọn phương thức">
            <InterestMethodMenu value={f.interestMethod} onChange={v => setF(p => ({ ...p, interestMethod: v }))}/>
          </FF>

          <BlockTitle icon="📊" label="Lãi suất ban đầu"/>
          <FGrid>
            <FF label="Lãi suất (%/năm)" req hint={`Tháng: ${(curRate / 12).toFixed(3)}%`}>
              <FI type="number" value={f.rateHistory[0]?.rate ?? 9} step={0.1} min={0}
                onChange={e => setF(p => ({ ...p, rateHistory: [{ ...p.rateHistory[0], rate: +e.target.value }, ...p.rateHistory.slice(1)] }))}/>
            </FF>
            <FF label="Ghi chú lãi suất">
              <FI value={f.rateHistory[0]?.note ?? ""} onChange={e => setF(p => ({ ...p, rateHistory: [{ ...p.rateHistory[0], note: e.target.value }, ...p.rateHistory.slice(1)] }))}
                placeholder="VD: Lãi ký HĐ, ưu đãi 12 tháng…"/>
            </FF>
          </FGrid>
          <div style={{ fontSize:11,color:"#334155",padding:"7px 9px",background:"#060b14",borderRadius:6,border:"1px solid #1a2540",marginTop:4 }}>
            💡 Điều chỉnh lãi suất theo thời gian: Lưu → bấm <b style={{ color:"#a78bfa" }}>📊 Lãi suất</b> trên thẻ khoản vay
          </div>
        </div>

        {/* RIGHT — preview */}
        <div style={{ width:235,flexShrink:0,borderLeft:"1px solid #1a2540",overflowY:"auto",background:"#080d18" }}>
          <div style={{ padding:"13px 14px" }}>
            <div style={{ fontSize:10,color:"#f59e0b",fontWeight:800,textTransform:"uppercase",letterSpacing:1,marginBottom:11 }}>📊 Preview</div>
            <PG label="Khoản vay">
              <PR l="Số tiền vay"   v={fmtM(f.principal)}              c="#e2e8f0"/>
              <PR l="Lãi suất/năm" v={`${curRate}%`}                  c="#f59e0b"/>
              <PR l="Lãi/tháng"   v={`${(curRate/12).toFixed(3)}%`}  c="#94a3b8"/>
              <PR l="Kỳ hạn"      v={`${f.termMonths} tháng`}        c="#94a3b8"/>
              {isGrace && <PR l="Ân hạn"   v={`${f.gracePeriod} tháng`}   c="#a78bfa"/>}
              {isGrace && <PR l="Trả gốc"  v={`${pv.repayN} tháng`}       c="#34d399"/>}
            </PG>
            {isAnnuity ? (
              <PG label="Hàng tháng">
                <PR l="PMT cố định" v={fmtM(pv.annuityPMT)} c="#fbbf24" lg/>
              </PG>
            ) : isGrace ? (
              <>
                <PG label={`Ân hạn (${f.gracePeriod}T)`}>
                  <PR l="Lãi/tháng"  v={fmtM(pv.interestMonth)} c="#f472b6"/>
                  <PR l="Tổng/tháng" v={fmtM(pv.interestMonth)} c="#fbbf24" lg/>
                </PG>
                <PG label={`Trả gốc (${pv.repayN}T)`}>
                  <PR l="Gốc đều"    v={fmtM(pv.eqPrin)}                       c="#60a5fa"/>
                  <PR l="Lãi T đầu"  v={fmtM(pv.interestMonth)}                c="#f472b6"/>
                  <PR l="Tổng T đầu" v={fmtM(pv.eqPrin + pv.interestMonth)}    c="#fbbf24" lg/>
                </PG>
              </>
            ) : (
              <PG label="Hàng tháng">
                <PR l="Gốc đều" v={fmtM(pv.eqPrin)}                      c="#60a5fa"/>
                <PR l="Lãi T1"  v={fmtM(pv.interestMonth)}               c="#f472b6"/>
                <PR l="Tổng T1" v={fmtM(pv.eqPrin + pv.interestMonth)}  c="#fbbf24" lg/>
              </PG>
            )}
            <PG label="Toàn kỳ">
              <PR l="Tổng lãi ước tính" v={fmtM(pv.totalInt)}                   c="#f87171"/>
              <PR l="Tổng chi phí"      v={fmtM(f.principal + pv.totalInt)}     c="#f87171"/>
            </PG>
          </div>
        </div>
      </div>
      <MFoot>
        <BtnG onClick={onClose}>Hủy</BtnG>
        <BtnP onClick={() => onSave(f)}>💾 Lưu khoản vay</BtnP>
      </MFoot>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// [RATE] SECTION 8 · PANEL LỊCH SỬ LÃI SUẤT
// ════════════════════════════════════════════════════════════════════════════

function RateHistoryPanel({ loan, onUpdate, onClose }) {
  const [history, setHistory] = useState([...loan.rateHistory].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)));
  const [nr, setNr] = useState({ effectiveDate: new Date().toISOString().slice(0, 10), rate: history.at(-1)?.rate ?? 9, note: "" });

  const add = () => {
    if (!nr.effectiveDate || !nr.rate) return;
    setHistory(h => [...h, { ...nr }].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)));
    setNr(p => ({ ...p, note: "" }));
  };
  const remove = i => {
    if (history.length <= 1) return alert("Phải có ít nhất 1 mức lãi suất");
    setHistory(h => h.filter((_, idx) => idx !== i));
  };

  return (
    <ModalShell onClose={onClose} width={520}>
      <MHead title="📊 Lịch sử lãi suất" sub={`${loan.name} · ${loan.bank}`} onClose={onClose}/>
      <div style={{ flex:1,overflowY:"auto",padding:"14px 18px" }}>
        {/* Timeline */}
        <div style={{ display:"flex",flexDirection:"column",marginBottom:18 }}>
          {history.map((h, i) => (
            <div key={i} style={{ display:"flex",gap:11,alignItems:"flex-start" }}>
              <div style={{ display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0 }}>
                <div style={{ width:10,height:10,borderRadius:"50%",background:i===0?"#f59e0b":"#a78bfa",marginTop:3 }}/>
                {i < history.length - 1 && <div style={{ width:2,height:38,background:"#1a2540",marginTop:2 }}/>}
              </div>
              <div style={{ flex:1,background:"#080d18",border:"1px solid #1a2540",borderRadius:8,padding:"9px 12px",marginBottom:i<history.length-1?2:0 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <span style={{ fontSize:18,fontWeight:900,color:"#f59e0b",fontFamily:"monospace" }}>{h.rate}%</span>
                    <span style={{ fontSize:10,color:"#475569",marginLeft:8 }}>/năm · {(h.rate/12).toFixed(3)}%/tháng</span>
                  </div>
                  <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                    <span style={{ fontSize:11,color:"#334155",fontFamily:"monospace" }}>từ {h.effectiveDate}</span>
                    {i > 0 && <button onClick={() => remove(i)} style={{ background:"none",border:"none",color:"#4a1c1c",cursor:"pointer",fontSize:14,lineHeight:1 }}>✕</button>}
                  </div>
                </div>
                {h.note && <div style={{ fontSize:11,color:"#475569",marginTop:3 }}>{h.note}</div>}
              </div>
            </div>
          ))}
        </div>
        {/* Add new */}
        <div style={{ background:"#080d18",border:"1px dashed #334155",borderRadius:9,padding:"13px 15px" }}>
          <div style={{ fontSize:11,color:"#60a5fa",fontWeight:700,marginBottom:11 }}>➕ Thêm lần điều chỉnh lãi suất</div>
          <FGrid>
            <FF label="Ngày hiệu lực" req>
              <FI type="date" value={nr.effectiveDate} onChange={e => setNr(p => ({ ...p, effectiveDate: e.target.value }))}/>
            </FF>
            <FF label="Lãi suất mới (%/năm)" req>
              <FI type="number" value={nr.rate} step={0.1} onChange={e => setNr(p => ({ ...p, rate: +e.target.value }))}/>
            </FF>
          </FGrid>
          <FF label="Ghi chú">
            <FI value={nr.note} onChange={e => setNr(p => ({ ...p, note: e.target.value }))} placeholder="VD: Hết ưu đãi, điều chỉnh định kỳ…"/>
          </FF>
          <div style={{ marginTop:10 }}><BtnP onClick={add} small>+ Thêm mức lãi</BtnP></div>
        </div>
      </div>
      <MFoot>
        <BtnG onClick={onClose}>Hủy</BtnG>
        <BtnP onClick={() => { onUpdate({ ...loan, rateHistory: history }); onClose(); }}>💾 Lưu lãi suất</BtnP>
      </MFoot>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// [TAB1] SECTION 9 · TAB TỔNG QUAN — Property cards + Loan rows
// ════════════════════════════════════════════════════════════════════════════

function TabDashboard({ properties, schedules, viewMonth, onDrillLoan, onEditProp, onAddLoan, onDrillTab }) {
  const summaries = useMemo(
    () => properties.map(p => summariseProperty(p, schedules, viewMonth)),
    [properties, schedules, viewMonth]
  );

  const grand = {
    balance:  summaries.reduce((s, p) => s + p.totBalance, 0),
    interest: summaries.reduce((s, p) => s + p.totInterest, 0),
    principal:summaries.reduce((s, p) => s + p.totPrincipal, 0),
    rental:   summaries.reduce((s, p) => s + p.rentalIncome, 0),
  };
  const grandNet = grand.rental - grand.interest - grand.principal;

  // bank aggregation
  const bankMap = {};
  properties.forEach(p => p.loans.forEach(l => {
    if (!bankMap[l.bank]) bankMap[l.bank] = { bank: l.bank, balance: 0, interest: 0, count: 0 };
    const row = schedules[l.id]?.find(r => r.monthKey === viewMonth);
    bankMap[l.bank].balance  += row?.balance  ?? l.principal;
    bankMap[l.bank].interest += row?.interest ?? 0;
    bankMap[l.bank].count++;
  }));

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:16 }}>

      {/* ── Grand stats ── */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
        <StatCard label="Tổng dư nợ"    value={fmtM(grand.balance)}   sub={`${properties.length} dự án · ${properties.reduce((s,p)=>s+p.loans.length,0)} khoản vay`} color="#f59e0b" icon="🏠" onClick={() => onDrillTab("detail")}/>
        <StatCard label="Lãi tháng này" value={fmtM(grand.interest)}  sub="Tổng lãi phải trả"  color="#f472b6" icon="💸" onClick={() => onDrillTab("history")}/>
        <StatCard label="Gốc tháng này" value={fmtM(grand.principal)} sub="Tổng giảm dư nợ"   color="#60a5fa" icon="📉"/>
        <StatCard label="Net cashflow"  value={sign(grandNet)} sub={`Thuê: ${fmtM(grand.rental)}`} color={grandNet >= 0 ? "#34d399" : "#f87171"} icon="💰"/>
      </div>

      {/* ── Property cards ── */}
      {summaries.map(p => (
        <PropertyCard key={p.id} p={p} viewMonth={viewMonth}
          onDrillLoan={onDrillLoan}
          onEditProp={() => onEditProp(p)}
          onAddLoan={() => onAddLoan(p.id)}/>
      ))}

      {/* ── Bank summary (compact) ── */}
      {Object.values(bankMap).length > 0 && (
        <Section title="Tổng hợp theo ngân hàng" sub={`Tháng ${viewMonth}`} flush>
          <Table headers={[{l:"Ngân hàng"},{l:"Dư nợ",r:true},{l:"Lãi tháng",r:true},{l:"Số khoản",r:true}]}>
            {Object.values(bankMap).map(b => (
              <TR key={b.bank}>
                <TD v={b.bank} c="#e2e8f0" bold/>
                <TD v={fmtM(b.balance)}  c="#fbbf24" mono r/>
                <TD v={fmtM(b.interest)} c="#f472b6" mono r/>
                <TD v={`${b.count} khoản`} c="#64748b" r/>
              </TR>
            ))}
          </Table>
        </Section>
      )}
    </div>
  );
}

// Property card với loan rows bên trong
function PropertyCard({ p, viewMonth, onDrillLoan, onEditProp, onAddLoan }) {
  const [expanded, setExpanded] = useState(true);
  const net = p.netCF;

  return (
    <div style={{ background:"#0b1120",border:`1px solid #1e293b`,borderLeft:`4px solid ${p.color}`,borderRadius:12,overflow:"hidden" }}>
      {/* Property header row */}
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 16px",cursor:"pointer",borderBottom:expanded?"1px solid #1a2540":"none" }}
        onClick={() => setExpanded(e => !e)}>
        {/* Caret */}
        <span style={{ fontSize:14,color:"#334155",transition:"transform .2s",display:"inline-block",transform:expanded?"rotate(90deg)":"none",flexShrink:0 }}>›</span>
        {/* Dot + name */}
        <div style={{ width:11,height:11,borderRadius:"50%",background:p.color,flexShrink:0 }}/>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ fontSize:15,fontWeight:800,color:"#e2e8f0" }}>{p.name}</div>
          {p.note && <div style={{ fontSize:11,color:"#475569",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.note}</div>}
        </div>
        {/* Summary numbers */}
        <div style={{ display:"flex",gap:20,alignItems:"center",flexShrink:0 }}>
          <NumPill label="Dư nợ"       value={fmtM(p.totBalance)}  color="#fbbf24"/>
          <NumPill label="Lãi tháng"   value={fmtM(p.totInterest)} color="#f472b6"/>
          <NumPill label="Thu nhập TN" value={fmtM(p.rentalIncome)} color="#34d399"/>
          <NumPill label="Net CF"      value={sign(net)} color={net >= 0 ? "#34d399" : "#f87171"}/>
          <span style={{ fontSize:11,color:"#475569" }}>{p.loans.length} khoản vay</span>
        </div>
        {/* Actions (stop propagation) */}
        <div style={{ display:"flex",gap:6,flexShrink:0 }} onClick={e => e.stopPropagation()}>
          <BtnG onClick={onEditProp} small>✏️</BtnG>
          <BtnG onClick={onAddLoan} small>＋ Vay</BtnG>
        </div>
      </div>

      {/* Loan rows */}
      {expanded && (
        <div>
          {p.loanRows.length === 0 ? (
            <div style={{ padding:"16px 20px",color:"#334155",fontSize:12,textAlign:"center" }}>
              Chưa có khoản vay · <span style={{ color:"#f59e0b",cursor:"pointer" }} onClick={onAddLoan}>＋ Thêm khoản vay</span>
            </div>
          ) : (
            <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12 }}>
              <thead>
                <tr style={{ background:"#060b14" }}>
                  {[{l:"Khoản vay"},{l:"Ngân hàng"},{l:"Trạng thái"},{l:"Lãi suất HH"},{l:"Gốc vay",r:true},{l:"Dư nợ",c:"#fbbf24",r:true},{l:"Lãi tháng",c:"#f472b6",r:true},{l:"Gốc tháng",c:"#60a5fa",r:true},{l:"Net CF",r:true},{l:""}]
                    .map((h, i) => <th key={i} style={{ padding:"6px 10px",textAlign:h.r?"right":"left",color:h.c||"#475569",fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:.6,whiteSpace:"nowrap",borderBottom:"1px solid #1a2540" }}>{h.l}</th>)}
                </tr>
              </thead>
              <tbody>
                {p.loanRows.map(l => {
                  const lnet = p.rentalIncome / p.loans.length - (l.row?.interest ?? 0) - (l.row?.principal ?? 0);
                  return (
                    <LoanRow key={l.id} l={l} lnet={lnet} propId={p.id} onDrillLoan={onDrillLoan}/>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function LoanRow({ l, lnet, propId, onDrillLoan }) {
  const [hov, setHov] = useState(false);
  return (
    <tr onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => onDrillLoan(propId, l.id)}
      style={{ borderBottom:"1px solid #0d1522",cursor:"pointer",background:hov?"rgba(255,255,255,.025)":"transparent",transition:"background .12s" }}>
      <td style={{ padding:"8px 10px",paddingLeft:22 }}>
        <span style={{ display:"flex",alignItems:"center",gap:7 }}>
          <span style={{ width:7,height:7,borderRadius:"50%",background:l.color,flexShrink:0,display:"inline-block" }}/>
          <span style={{ color:"#c4cdd8",fontWeight:600 }}>{l.name}</span>
        </span>
      </td>
      <td style={{ padding:"8px 10px" }}><BankBadge bank={l.bank} color={l.color}/></td>
      <td style={{ padding:"8px 10px" }}>{l.row ? <GraceBadge inGrace={l.row.inGrace}/> : <span style={{ color:"#2a3a50",fontSize:11 }}>—</span>}</td>
      <td style={{ padding:"8px 10px",color:"#f59e0b",fontFamily:"monospace" }}>{l.row ? `${l.row.rate}%` : "—"}</td>
      <td style={{ padding:"8px 10px",textAlign:"right",color:"#64748b",fontFamily:"monospace" }}>{fmtM(l.principal)}</td>
      <td style={{ padding:"8px 10px",textAlign:"right",color:"#fbbf24",fontFamily:"monospace",fontWeight:700 }}>{l.row ? fmt(l.row.balance) : fmt(l.principal)}</td>
      <td style={{ padding:"8px 10px",textAlign:"right",color:"#f472b6",fontFamily:"monospace" }}>{l.row ? fmt(l.row.interest) : "—"}</td>
      <td style={{ padding:"8px 10px",textAlign:"right",color: l.row?.inGrace ? "#334155" : "#60a5fa",fontFamily:"monospace" }}>{l.row ? (l.row.inGrace ? "—" : fmt(l.row.principal)) : "—"}</td>
      <td style={{ padding:"8px 10px",textAlign:"right",color:lnet>=0?"#34d399":"#f87171",fontFamily:"monospace",fontWeight:700 }}>{l.row ? sign(lnet) : "—"}</td>
      <td style={{ padding:"8px 10px",color:"#334155",fontSize:11 }}>Chi tiết ›</td>
    </tr>
  );
}

function NumPill({ label, value, color }) {
  return (
    <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:1 }}>
      <span style={{ fontSize:9,color:"#334155",textTransform:"uppercase",letterSpacing:.6,fontWeight:700 }}>{label}</span>
      <span style={{ fontSize:13,fontWeight:800,color,fontFamily:"monospace" }}>{value}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// [TAB2] SECTION 10 · TAB CHI TIẾT KHOẢN VAY
// ════════════════════════════════════════════════════════════════════════════

function TabDetail({ properties, schedules, viewMonth, selectedPropId, selectedLoanId, onSelectProp, onSelectLoan, onEditLoan, onDeleteLoan, onUpdateLoan, onAddLoan }) {
  const [ratePanel, setRatePanel] = useState(false);
  const prop  = properties.find(p => p.id === selectedPropId);
  const loan  = prop?.loans.find(l => l.id === selectedLoanId);
  const sched = loan ? schedules[loan.id] : null;

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:13 }}>
      {/* Dự án selector */}
      <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
        <span style={{ fontSize:10,color:"#334155",fontWeight:700,letterSpacing:.7 }}>DỰ ÁN:</span>
        {properties.map(p => (
          <button key={p.id} onClick={() => onSelectProp(p.id)}
            style={{ background:selectedPropId===p.id?p.color:"#111827",border:"none",borderRadius:7,padding:"6px 13px",
              color:selectedPropId===p.id?"#060b14":"#64748b",fontWeight:700,fontSize:12,cursor:"pointer",
              display:"flex",alignItems:"center",gap:6,transition:"all .2s" }}>
            <span style={{ width:7,height:7,borderRadius:"50%",background:selectedPropId===p.id?"#060b14":p.color,display:"inline-block",flexShrink:0 }}/>
            {p.name}
          </button>
        ))}
      </div>

      {!prop ? (
        <div style={{ textAlign:"center",padding:60,color:"#334155" }}>Chọn một dự án</div>
      ) : (
        <>
          {/* Khoản vay selector */}
          <div style={{ display:"flex",gap:7,flexWrap:"wrap",alignItems:"center" }}>
            <span style={{ fontSize:10,color:"#334155",fontWeight:700,letterSpacing:.7 }}>KHOẢN VAY:</span>
            {prop.loans.map(l => (
              <button key={l.id} onClick={() => onSelectLoan(l.id)}
                style={{ background:selectedLoanId===l.id?l.color:"#111827",border:"none",borderRadius:7,padding:"6px 13px",
                  color:selectedLoanId===l.id?"#060b14":"#64748b",fontWeight:700,fontSize:12,cursor:"pointer",
                  display:"flex",alignItems:"center",gap:6,transition:"all .2s" }}>
                <span style={{ width:7,height:7,borderRadius:"50%",background:selectedLoanId===l.id?"#060b14":l.color,display:"inline-block",flexShrink:0 }}/>
                {l.name}
                <span style={{ fontSize:10,opacity:.7 }}>{l.bank}</span>
              </button>
            ))}
            <BtnG onClick={() => onAddLoan(prop.id)} small>＋ Thêm khoản vay</BtnG>
          </div>

          {!loan ? (
            <div style={{ textAlign:"center",padding:40,color:"#334155" }}>Chọn một khoản vay</div>
          ) : (
            <>
              {/* Loan info card */}
              <div style={{ background:"#0b1120",border:"1px solid #1e293b",borderRadius:11,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10 }}>
                <div>
                  <div style={{ display:"flex",gap:9,alignItems:"center",flexWrap:"wrap",marginBottom:5 }}>
                    <span style={{ fontSize:15,fontWeight:800,color:"#e2e8f0" }}>{loan.name}</span>
                    <BankBadge bank={loan.bank} color={loan.color}/>
                  </div>
                  <div style={{ display:"flex",gap:13,flexWrap:"wrap",fontSize:11,color:"#475569" }}>
                    <span>📅 {loan.disburseDate}</span>
                    <span>💵 Gốc: {fmtM(loan.principal)}</span>
                    <span>⏱ {loan.termMonths} tháng</span>
                    {loan.interestMethod === "declining_grace" && <span style={{ color:"#a78bfa" }}>⏳ Ân hạn: {loan.gracePeriod} tháng</span>}
                  </div>
                </div>
                {/* Rate box + actions */}
                <div style={{ display:"flex",gap:9,alignItems:"flex-start" }}>
                  <div style={{ background:"#080d18",border:"1px solid #1a2540",borderRadius:8,padding:"8px 12px",minWidth:160 }}>
                    <div style={{ fontSize:9,color:"#475569",textTransform:"uppercase",letterSpacing:.8,marginBottom:3 }}>Lãi suất hiện tại</div>
                    <div style={{ fontSize:20,fontWeight:900,color:"#f59e0b",fontFamily:"monospace" }}>{getRateForMonth(loan.rateHistory, viewMonth)}%</div>
                    <div style={{ fontSize:10,color:"#475569" }}>{(getRateForMonth(loan.rateHistory, viewMonth) / 12).toFixed(3)}%/tháng</div>
                    {loan.rateHistory.length > 1 && (
                      <div style={{ marginTop:5,borderTop:"1px solid #1a2540",paddingTop:4 }}>
                        {[...loan.rateHistory].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)).slice(0, 3).map((h, i) => (
                          <div key={i} style={{ fontSize:10,display:"flex",justifyContent:"space-between",color:i===0?"#fbbf24":"#334155" }}>
                            <span>{h.effectiveDate.slice(0, 7)}</span>
                            <span style={{ fontFamily:"monospace" }}>{h.rate}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    <BtnG onClick={() => setRatePanel(true)} small>📊 Lãi suất</BtnG>
                    <BtnG onClick={() => onEditLoan(loan)} small>✏️ Sửa</BtnG>
                    <BtnG onClick={() => onDeleteLoan(prop.id, loan.id)} danger small>🗑️ Xóa</BtnG>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {loan.interestMethod === "declining_grace" && loan.gracePeriod > 0 && (
                <Section title="Tiến độ khoản vay">
                  <ProgressBar
                    pct={(loan.gracePeriod / loan.termMonths) * 100}
                    label1={`⏳ Ân hạn: ${loan.gracePeriod} tháng`}
                    label2={`✅ Trả gốc: ${loan.termMonths - loan.gracePeriod} tháng`}/>
                </Section>
              )}

              {/* Schedule table */}
              <Section title="Lịch trả nợ chi tiết" sub={`${sched?.length} kỳ · Tháng hiện tại được highlight`} flush>
                <Table maxH={430} headers={[
                  {l:"T#"},{l:"Kỳ"},{l:"TT"},{l:"Lãi suất",r:true},
                  {l:"Lãi tháng",c:"#f472b6",r:true},{l:"Gốc tháng",c:"#60a5fa",r:true},
                  {l:"Tổng TT",r:true},{l:"Dư nợ",c:"#fbbf24",r:true},{l:"Net CF",r:true},
                ]}>
                  {sched?.map(r => {
                    const isCur = r.monthKey === viewMonth;
                    const netRow = prop.rentalIncome - r.interest - r.principal;
                    return (
                      <TR key={r.month} highlight={isCur}>
                        <TD v={r.month} c={isCur ? "#f59e0b" : "#334155"} bold={isCur}/>
                        <TD v={r.monthLabel} c="#475569"/>
                        <TD v={<GraceBadge inGrace={r.inGrace}/>}/>
                        <TD v={`${r.rate}%`} c="#f59e0b" mono r/>
                        <TD v={fmt(r.interest)} c="#f472b6" mono r/>
                        <TD v={r.inGrace ? "—" : fmt(r.principal)} c={r.inGrace ? "#334155" : "#60a5fa"} mono r/>
                        <TD v={fmt(r.totalPayment)} c="#e2e8f0" mono r/>
                        <TD v={fmt(r.balance)} c="#fbbf24" mono r/>
                        <TD v={(netRow >= 0 ? "+" : "") + fmt(netRow)} c={netRow >= 0 ? "#34d399" : "#f87171"} mono r bold/>
                      </TR>
                    );
                  })}
                </Table>
              </Section>
            </>
          )}
        </>
      )}

      {ratePanel && loan && (
        <RateHistoryPanel loan={loan}
          onUpdate={updated => onUpdateLoan(prop.id, updated)}
          onClose={() => setRatePanel(false)}/>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// [TAB3] SECTION 11 · TAB LỊCH SỬ 12 THÁNG
// ════════════════════════════════════════════════════════════════════════════

function TabHistory({ properties, schedules, viewMonth }) {
  const allLoans = properties.flatMap(p => p.loans);

  const last12 = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d  = addMo(now.toISOString().slice(0, 10), i - 11);
      const mk = mkKey(d);
      const byLoan = Object.fromEntries(allLoans.map(l => [l.id, schedules[l.id]?.find(r => r.monthKey === mk)]));
      const byProp = {}, byBank = {};
      properties.forEach(p => {
        p.loans.forEach(l => {
          const li = byLoan[l.id]?.interest || 0;
          byProp[p.id]  = (byProp[p.id]  || 0) + li;
          byBank[l.bank] = (byBank[l.bank] || 0) + li;
        });
      });
      return {
        label: mkLbl(d), monthKey: mk, byLoan, byProp, byBank,
        totalInterest: allLoans.reduce((s, l) => s + (byLoan[l.id]?.interest || 0), 0),
      };
    });
  }, [properties, schedules]);

  const uniqueBanks  = [...new Set(allLoans.map(l => l.bank))];
  const bankColorMap = Object.fromEntries(uniqueBanks.map((b, i) => [b, PALETTE[i % PALETTE.length]]));

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
      <Section title="Lãi hàng tháng — theo dự án" sub="Hover để xem chi tiết">
        <BarChart
          data={last12.map(m => ({ label: m.label, ...Object.fromEntries(properties.map(p => [p.id, m.byProp[p.id] || 0])) }))}
          keys={properties.map(p => p.id)} colors={properties.map(p => p.color)}
          nameMap={Object.fromEntries(properties.map(p => [p.id, p.name]))}/>
        <ChartX labels={last12.map(m => m.label)}/>
        <Legend items={properties.map(p => ({ label: p.name, color: p.color }))}/>
      </Section>

      <Section title="Lãi hàng tháng — theo ngân hàng">
        <BarChart
          data={last12.map(m => ({ label: m.label, ...Object.fromEntries(uniqueBanks.map(b => [b, m.byBank[b] || 0])) }))}
          keys={uniqueBanks} colors={uniqueBanks.map(b => bankColorMap[b])}/>
        <ChartX labels={last12.map(m => m.label)}/>
        <Legend items={uniqueBanks.map(b => ({ label: b, color: bankColorMap[b] }))}/>
      </Section>

      <Section title="Bảng chi tiết lãi 12 tháng" flush>
        <Table headers={[{ l: "Tháng" }, ...properties.map(p => ({ l: p.name, c: p.color, r: true })), { l: "Tổng lãi", c: "#fbbf24", r: true }]}>
          {last12.map(m => (
            <TR key={m.monthKey} highlight={m.monthKey === viewMonth}>
              <TD v={m.label} c={m.monthKey === viewMonth ? "#f59e0b" : "#475569"} bold={m.monthKey === viewMonth}/>
              {properties.map(p => <TD key={p.id} v={fmtM(m.byProp[p.id] || 0)} c="#f472b6" mono r/>)}
              <TD v={fmtM(m.totalInterest)} c="#fbbf24" mono r bold/>
            </TR>
          ))}
        </Table>
      </Section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// [APP] SECTION 12 · APP ROOT
// ════════════════════════════════════════════════════════════════════════════

export default function App() {
  const [properties,     setProperties]     = useState(() => loadLocal() ?? INITIAL_PROPERTIES);
  const [activeTab,      setActiveTab]      = useState("dashboard");
  const [viewMonth,      setViewMonth]      = useState(nowKey);
  const [selectedPropId, setSelectedPropId] = useState<string|null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string|null>(null);
  const [importErr,      setImportErr]      = useState(false);

  const [propModal, setPropModal] = useState<any>(null);
  const [loanModal, setLoanModal] = useState<any>(null);

  // Google Drive sync
  const { gdStatus, gdSignIn, gdSignOut, syncToDrive, isConfigured } = useGoogleDriveSync({
    onLoadSuccess: (props) => { setProperties(props); saveLocal(props); },
  });

  // Lưu mỗi khi properties thay đổi
  useEffect(() => { saveLocal(properties); syncToDrive(properties); }, [properties]);

  // Init selection
  useEffect(() => {
    if (!selectedPropId && properties.length) {
      setSelectedPropId(properties[0].id);
      setSelectedLoanId(properties[0].loans[0]?.id ?? null);
    }
  }, [properties]);

  // Build schedules
  const schedules = useMemo(() => {
    const map = {};
    properties.forEach(p => p.loans.forEach(l => { map[l.id] = buildSchedule(l); }));
    return map;
  }, [properties]);

  // ── Property CRUD ──────────────────────────────────────────────────────
  const saveProperty = f => {
    setProperties(prev =>
      prev.some(p => p.id === f.id)
        ? prev.map(p => p.id === f.id ? { ...f, loans: p.loans } : p)
        : [...prev, { ...f, loans: [] }]
    );
    setPropModal(null);
  };
  const deleteProperty = id => {
    if (!window.confirm("Xóa dự án này và toàn bộ khoản vay?")) return;
    setProperties(p => p.filter(x => x.id !== id));
    if (selectedPropId === id) setSelectedPropId(null);
  };

  // ── Loan CRUD ──────────────────────────────────────────────────────────
  const saveLoan = (propId, loanData) => {
    setProperties(prev => prev.map(p => p.id === propId ? {
      ...p, loans: p.loans.some(l => l.id === loanData.id)
        ? p.loans.map(l => l.id === loanData.id ? loanData : l)
        : [...p.loans, loanData],
    } : p));
    setLoanModal(null);
    setSelectedLoanId(loanData.id);
  };
  const deleteLoan = (propId, loanId) => {
    if (!window.confirm("Xóa khoản vay này?")) return;
    setProperties(prev => prev.map(p => p.id === propId ? { ...p, loans: p.loans.filter(l => l.id !== loanId) } : p));
    if (selectedLoanId === loanId) setSelectedLoanId(null);
  };
  const updateLoan = useCallback((propId, updated) => {
    setProperties(prev => prev.map(p => p.id === propId
      ? { ...p, loans: p.loans.map(l => l.id === updated.id ? updated : l) }
      : p));
  }, []);

  // Drill helpers
  const drillLoan = (propId, loanId) => {
    setSelectedPropId(propId);
    setSelectedLoanId(loanId);
    setActiveTab("detail");
  };

  // Import / export
  const handleImport = e => {
    const file = e.target.files?.[0]; if (!file) return;
    importJSON(file,
      imported => { if (window.confirm(`Import ${imported.length} dự án? Dữ liệu hiện tại bị thay thế.`)) setProperties(imported); },
      () => { setImportErr(true); setTimeout(() => setImportErr(false), 3000); }
    );
    e.target.value = "";
  };

  const nextColor    = PALETTE[properties.length % PALETTE.length];
  const loanModalProp = loanModal ? properties.find(p => p.id === loanModal.propId) : null;
  const TABS = [["dashboard","📊 Tổng quan"],["detail","📋 Chi tiết"],["history","📈 Lịch sử"]];

  return (
    <div style={{ minHeight:"100vh",background:"#060b14",fontFamily:"'IBM Plex Sans','Segoe UI',sans-serif",color:"#cbd5e1" }}>

      {/* Header */}
      <header style={{ background:"rgba(6,11,20,.97)",borderBottom:"1px solid #1a2540",padding:"10px 22px",
        display:"flex",justifyContent:"space-between",alignItems:"center",
        position:"sticky",top:0,zIndex:10,backdropFilter:"blur(12px)" }}>
        <div style={{ display:"flex",gap:11,alignItems:"center" }}>
          <span style={{ fontSize:24 }}>🏦</span>
          <div>
            <div style={{ fontWeight:900,fontSize:17,letterSpacing:4,color:"#f59e0b",fontFamily:"monospace" }}>LOAN TRACKER</div>
            <div style={{ fontSize:10,color:"#2a3a50",marginTop:1 }}>Đa dự án · Đa khoản vay · Lãi suất nhiều giai đoạn</div>
          </div>
        </div>
        <div style={{ display:"flex",gap:9,alignItems:"center",flexWrap:"wrap" }}>
          <MonthPicker value={viewMonth} onChange={setViewMonth}/>
          {/* Google Drive status */}
          {isConfigured && (
            <div style={{ display:"flex",gap:6,alignItems:"center",background:"#0d1525",border:"1px solid #1a2540",borderRadius:7,padding:"5px 10px" }}>
              <span style={{ width:7,height:7,borderRadius:"50%",flexShrink:0,display:"inline-block",
                background: gdStatus==="ready"?"#34d399":gdStatus==="loading"?"#f59e0b":gdStatus==="error"?"#f87171":"#475569" }}/>
              <span style={{ fontSize:10,color:"#475569" }}>
                {gdStatus==="ready"?"Drive: đang sync":gdStatus==="loading"?"Đang kết nối…":gdStatus==="error"?"Drive: lỗi":"Drive: chưa kết nối"}
              </span>
              {gdStatus==="idle"   && <BtnG onClick={gdSignIn}  small>🔗 Kết nối</BtnG>}
              {gdStatus==="error"  && <BtnG onClick={gdSignIn}  small>🔄 Thử lại</BtnG>}
              {gdStatus==="ready"  && <BtnG onClick={gdSignOut} small>⏏</BtnG>}
            </div>
          )}
          <div style={{ display:"flex",gap:6 }}>
            <BtnG onClick={() => exportJSON(properties)} small>📥 Export</BtnG>
            <label style={{ background:"none",border:"1px solid #1e293b",borderRadius:7,padding:"5px 10px",color:"#64748b",cursor:"pointer",fontSize:11 }}>
              📤 Import
              <input type="file" accept=".json" onChange={handleImport} style={{ display:"none" }}/>
            </label>
            {importErr && <span style={{ fontSize:11,color:"#f87171",alignSelf:"center" }}>File lỗi</span>}
          </div>
          <BtnG onClick={() => setPropModal("add")} small>🏠 Thêm dự án</BtnG>
          <BtnP onClick={() => {
            if (!properties.length) { alert("Thêm dự án trước"); return; }
            setLoanModal({ propId: selectedPropId ?? properties[0].id });
          }}>＋ Thêm khoản vay</BtnP>
        </div>
      </header>

      {/* Nav */}
      <nav style={{ background:"#080e1a",borderBottom:"1px solid #1a2540",padding:"0 22px",display:"flex",gap:2,alignItems:"center" }}>
        {TABS.map(([id, lbl]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ background:"none",border:"none",color:activeTab===id?"#f59e0b":"#475569",
              padding:"10px 15px",cursor:"pointer",fontSize:12,fontWeight:700,
              borderBottom:`2px solid ${activeTab===id?"#f59e0b":"transparent"}`,transition:"all .2s" }}>
            {lbl}
          </button>
        ))}
        <div style={{ marginLeft:"auto",fontSize:10,color:"#2a3a50",display:"flex",gap:8,alignItems:"center" }}>
          <span style={{ color:"#34d399" }}>● localStorage</span>
          {gdStatus==="ready" && <><span>·</span><span style={{ color:"#34d399" }}>● Drive sync</span></>}
          <span>·</span>
          <span>{properties.length} dự án · {properties.reduce((s, p) => s + p.loans.length, 0)} khoản vay</span>
        </div>
      </nav>

      {/* Main */}
      <main style={{ padding:"16px 22px",maxWidth:1440,margin:"0 auto" }}>
        {activeTab === "dashboard" && (
          <TabDashboard
            properties={properties} schedules={schedules} viewMonth={viewMonth}
            onDrillLoan={drillLoan}
            onEditProp={p => setPropModal(p)}
            onAddLoan={propId => setLoanModal({ propId })}
            onDrillTab={setActiveTab}/>
        )}
        {activeTab === "detail" && (
          <TabDetail
            properties={properties} schedules={schedules} viewMonth={viewMonth}
            selectedPropId={selectedPropId} selectedLoanId={selectedLoanId}
            onSelectProp={id => { setSelectedPropId(id); const p = properties.find(x => x.id === id); setSelectedLoanId(p?.loans[0]?.id ?? null); }}
            onSelectLoan={setSelectedLoanId}
            onEditLoan={l => setLoanModal({ propId: selectedPropId, loan: l })}
            onDeleteLoan={deleteLoan}
            onUpdateLoan={updateLoan}
            onAddLoan={propId => setLoanModal({ propId })}/>
        )}
        {activeTab === "history" && (
          <TabHistory properties={properties} schedules={schedules} viewMonth={viewMonth}/>
        )}
      </main>

      {/* Modals */}
      {propModal && (
        <PropertyFormModal
          property={propModal === "add" ? null : propModal}
          nextColor={nextColor}
          onSave={saveProperty}
          onClose={() => setPropModal(null)}/>
      )}
      {loanModal && loanModalProp && (
        <LoanFormModal
          loan={loanModal.loan ?? null}
          propName={loanModalProp.name}
          loanCount={loanModalProp.loans.length}
          onSave={l => saveLoan(loanModal.propId, l)}
          onClose={() => setLoanModal(null)}/>
      )}
    </div>
  );
}
