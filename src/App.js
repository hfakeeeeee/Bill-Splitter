import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Calculator, Users, Receipt, AlertTriangle, CheckCircle,
  CreditCard, X, Filter, Copy, Shuffle, Gauge, ListChecks
} from "lucide-react";
import "./App.css";

/** QR có sẵn */
const qrCodes = [
  { id: "Dat", name: "Dat", file: "Dat.png" },
  { id: "Huy", name: "Huy", file: "Huy.png" },
  { id: "Nguyen", name: "Nguyen", file: "Nguyen.png" },
  { id: "Quang", name: "Quang", file: "Quang.png" },
  { id: "Thu", name: "Thu", file: "Thu.png" },
];

export default function App() {
  // ----- State -----
  const [billData, setBillData] = useState({ totalAmount: "", discount: "", shipping: "" });
  const [members, setMembers] = useState([{ id: 1, name: "", originalPrice: "", finalPrice: 0, paid: false }]);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [validationMessage, setValidationMessage] = useState("");
  const [validationType, setValidationType] = useState(""); // success|warning|error
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // UX
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  const [selectedQR, setSelectedQR] = useState(qrCodes[0].id);
  const [payerMemberId, setPayerMemberId] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [rightTab, setRightTab] = useState("overview"); // 'overview' | 'transfer'

  // Pagination (auto-fit)
  const listRef = useRef(null);
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(2);
  const [page, setPage] = useState(1);

  // constants for layout calc
  const MIN_CARD_W = 300; // px
  const CARD_H = 200;     // px (chiều cao cố định mỗi member)
  const GAP = 12;         // px (khớp CSS)

  // ----- Load -----
  useEffect(() => {
    try {
      const savedBillData = localStorage.getItem("billSplitter_billData");
      const savedMembers = localStorage.getItem("billSplitter_members");
      const savedQR = localStorage.getItem("billSplitter_selectedQR");
      const savedUnpaidOnly = localStorage.getItem("billSplitter_unpaidOnly");
      const savedPayerId = localStorage.getItem("billSplitter_payerMemberId");
      const savedTab = localStorage.getItem("billSplitter_rightTab");

      if (savedBillData) setBillData(JSON.parse(savedBillData));
      if (savedMembers) {
        const parsed = JSON.parse(savedMembers);
        setMembers(parsed.map((m) => ({ ...m, finalPrice: Number(m.finalPrice) || 0 })));
      }
      if (savedQR && qrCodes.some((q) => q.id === savedQR)) setSelectedQR(savedQR);
      if (savedUnpaidOnly) setShowUnpaidOnly(savedUnpaidOnly === "true");
      if (savedPayerId) setPayerMemberId(Number(savedPayerId));
      if (savedTab) setRightTab(savedTab);
    } catch (e) {
      console.error("Load localStorage error:", e);
    } finally {
      setIsDataLoaded(true);
    }
  }, []);

  // ----- Save -----
  useEffect(() => { if (isDataLoaded) localStorage.setItem("billSplitter_billData", JSON.stringify(billData)); }, [billData, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem("billSplitter_members", JSON.stringify(members)); }, [members, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem("billSplitter_selectedQR", selectedQR); }, [selectedQR, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem("billSplitter_unpaidOnly", String(showUnpaidOnly)); }, [showUnpaidOnly, isDataLoaded]);
  useEffect(() => {
    if (!isDataLoaded) return;
    if (payerMemberId == null) localStorage.removeItem("billSplitter_payerMemberId");
    else localStorage.setItem("billSplitter_payerMemberId", String(payerMemberId));
  }, [payerMemberId, isDataLoaded]);
  useEffect(() => { if (isDataLoaded) localStorage.setItem("billSplitter_rightTab", rightTab); }, [rightTab, isDataLoaded]);

  // ----- Logic -----
  useEffect(() => {
    const total = parseFloat(billData.totalAmount) || 0;
    const discount = parseFloat(billData.discount) || 0;
    const shipping = parseFloat(billData.shipping) || 0;
    if (total > 0) {
      const netDiscount = Math.max(0, discount - shipping);
      const percentage = (netDiscount / total) * 100;
      setDiscountPercentage(Math.min(Math.max(percentage, 0), 100));
    } else setDiscountPercentage(0);
  }, [billData]);

  useEffect(() => {
    if (!isDataLoaded) return;
    setMembers((prev) =>
      prev.map((m) => {
        const original = parseFloat(m.originalPrice) || 0;
        const finalPrice = Math.round(original * (1 - discountPercentage / 100));
        return { ...m, finalPrice };
      })
    );
  }, [discountPercentage, isDataLoaded]);

  useEffect(() => {
    const sumOriginal = members.reduce((s, m) => s + (parseFloat(m.originalPrice) || 0), 0);
    const expected = parseFloat(billData.totalAmount) || 0;
    if (expected > 0 && sumOriginal > 0) {
      const diff = expected - sumOriginal;
      const abs = Math.abs(diff);
      const tolerance = 1000;
      if (abs <= tolerance) {
        if (abs < 100) { setValidationMessage("✅ Tổng tiền khớp chính xác!"); setValidationType("success"); }
        else { setValidationMessage(`⚠️ Tổng tiền gần đúng (sai số: ${abs.toLocaleString()} VNĐ)`); setValidationType("warning"); }
      } else {
        const label = diff > 0 ? "Thiếu" : "Thừa";
        setValidationMessage(`❌ Tổng tiền không khớp! ${label}: ${abs.toLocaleString()} VNĐ`);
        setValidationType("error");
      }
    } else { setValidationMessage(""); setValidationType(""); }
  }, [members, billData.totalAmount]);

  // ----- Pagination auto-fit -----
  useEffect(() => {
    const compute = () => {
      const el = listRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const newCols = Math.max(1, Math.floor((w + GAP) / (MIN_CARD_W + GAP)));
      const newRows = Math.max(1, Math.floor((h + GAP) / (CARD_H + GAP)));
      setCols(newCols);
      setRows(newRows);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (listRef.current) ro.observe(listRef.current);
    window.addEventListener("resize", compute);
    return () => { ro.disconnect(); window.removeEventListener("resize", compute); };
  }, []);

  const handleBillDataChange = (field, value) => setBillData((p) => ({ ...p, [field]: value }));
  const addMember = () => {
    const newId = members.length ? Math.max(...members.map((m) => m.id)) + 1 : 1;
    setMembers((p) => [...p, { id: newId, name: "", originalPrice: "", finalPrice: 0, paid: false }]);
  };
  const removeMember = (id) => {
    if (members.length <= 1) return;
    setMembers((p) => p.filter((m) => m.id !== id));
    setPayerMemberId((cur) => (cur === id ? null : cur));
  };
  const updateMember = (id, field, value) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const updated = { ...m, [field]: value };
        if (field === "originalPrice") {
          const original = parseFloat(value) || 0;
          updated.finalPrice = Math.round(original * (1 - discountPercentage / 100));
        }
        if (field === "name" && payerMemberId === id) autoMatchQR(value);
        return updated;
      })
    );
  };
  const togglePaid = (id) => setMembers((p) => p.map((m) => (m.id === id ? { ...m, paid: !m.paid } : m)));
  const clearAllData = () => {
    if (!window.confirm("Bạn có chắc muốn xóa tất cả dữ liệu?")) return;
    setBillData({ totalAmount: "", discount: "", shipping: "" });
    setMembers([{ id: 1, name: "", originalPrice: "", finalPrice: 0, paid: false }]);
    setSelectedQR(qrCodes[0].id);
    setShowUnpaidOnly(false);
    setPayerMemberId(null);
    setPage(1);
    ["billSplitter_billData","billSplitter_members","billSplitter_selectedQR","billSplitter_unpaidOnly","billSplitter_payerMemberId","billSplitter_rightTab"].forEach((k)=>localStorage.removeItem(k));
    setValidationMessage(""); setValidationType("");
  };

  const totalOriginalPrice = useMemo(() => members.reduce((s, m) => s + (parseFloat(m.originalPrice) || 0), 0), [members]);
  const totalFinalPrice = useMemo(() => members.reduce((s, m) => s + (parseFloat(m.finalPrice) || 0), 0), [members]);
  const totalPaid = useMemo(() => members.reduce((s, m) => s + (m.paid ? (parseFloat(m.finalPrice) || 0) : 0), 0), [members]);
  const totalUnpaid = totalFinalPrice - totalPaid;
  const paidRatio = totalFinalPrice > 0 ? Math.min(totalPaid / totalFinalPrice, 1) : 0;

  const displayedMembers = useMemo(() => (showUnpaidOnly ? members.filter((m) => !m.paid) : members), [members, showUnpaidOnly]);

  // page calc
  const pageSize = Math.max(1, cols * rows);
  const pageCount = Math.max(1, Math.ceil(displayedMembers.length / pageSize));
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const start = (page - 1) * pageSize;
  const pageMembers = displayedMembers.slice(start, start + pageSize);

  // helpers
  const autoMatchQR = (name) => {
    if (!name) return;
    const t = qrCodes.find((q) => q.id.toLowerCase() === name.toLowerCase() || q.name.toLowerCase() === name.toLowerCase());
    if (t) setSelectedQR(t.id);
  };
  const onSelectPayer = (memberId) => {
    setPayerMemberId(memberId);
    const m = members.find((x) => x.id === memberId);
    if (m?.name) autoMatchQR(m.name);
    if (totalUnpaid > 0 && !showQR) setShowQR(true);
    setRightTab("transfer");
  };
  const chooseRandomPayer = () => {
    if (!members.length) return;
    const pick = members[Math.floor(Math.random() * members.length)];
    onSelectPayer(pick.id);
  };
  const copySummary = async () => {
    const lines = [];
    lines.push("Bill Splitter");
    lines.push(`Tổng đơn: ${(parseFloat(billData.totalAmount) || 0).toLocaleString()} VNĐ`);
    lines.push(`Giảm: ${(parseFloat(billData.discount) || 0).toLocaleString()} - Ship: ${(parseFloat(billData.shipping) || 0).toLocaleString()}`);
    lines.push(`Phần trăm giảm áp: ${discountPercentage.toFixed(1)}%`);
    lines.push("-------------------------");
    members.forEach((m, i) => {
      const name = m.name || `#${i + 1}`;
      const price = (Number(m.finalPrice) || 0).toLocaleString();
      const status = m.paid ? "✅" : "🕘";
      lines.push(`${name}: ${price} VNĐ ${status}`);
    });
    lines.push("-------------------------");
    lines.push(`Đã thu: ${totalPaid.toLocaleString()} VNĐ`);
    lines.push(`Còn thiếu: ${totalUnpaid.toLocaleString()} VNĐ`);
    try { await navigator.clipboard.writeText(lines.join("\n")); alert("Đã sao chép nội dung chia sẻ ✅"); }
    catch { alert("Không thể sao chép. Hãy thử trên HTTPS hoặc trình duyệt khác."); }
  };

  // ----- UI -----
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Receipt className="brand-icon" />
          <span>Bill Splitter</span>
        </div>
        <div className="top-actions">
          <button className="ghost" onClick={copySummary}><Copy size={16} /> Copy chia sẻ</button>
          <button className="danger" onClick={clearAllData}><Trash2 size={16} /> Xóa tất cả</button>
        </div>
      </header>

      <main className="shell">
        <div className="main-grid">
          {/* LEFT */}
          <section className="stack">
            <div className="card">
              <div className="card-header">
                <Calculator className="card-icon" />
                <h2>Thông tin đơn hàng</h2>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Tổng tiền đơn (VNĐ)</label>
                  <input type="number" value={billData.totalAmount} onChange={(e) => handleBillDataChange("totalAmount", e.target.value)} placeholder="Nhập tổng tiền..." />
                </div>
                <div className="form-group">
                  <label>Tiền giảm giá voucher (VNĐ)</label>
                  <input type="number" value={billData.discount} onChange={(e) => handleBillDataChange("discount", e.target.value)} placeholder="Nhập tiền giảm giá..." />
                </div>
                <div className="form-group">
                  <label>Tiền ship (VNĐ)</label>
                  <input type="number" value={billData.shipping} onChange={(e) => handleBillDataChange("shipping", e.target.value)} placeholder="Nhập tiền ship..." />
                </div>
              </div>
              <div className="discount-info">
                <div className="discount-badge">
                  <span>Phần trăm giảm giá</span>
                  <strong>{discountPercentage.toFixed(1)}%</strong>
                </div>
              </div>
            </div>

            <div className="card card-fill">
              <div className="card-header">
                <Users className="card-icon" />
                <h2>Thành viên</h2>
                <div className="spacer" />
                <label className="switch">
                  <input type="checkbox" checked={showUnpaidOnly} onChange={(e) => { setShowUnpaidOnly(e.target.checked); setPage(1); }} />
                  <span><Filter size={14} /> Chỉ hiện chưa trả</span>
                </label>
                <button className="primary" onClick={addMember}><Plus size={16} /> Thêm</button>
              </div>

              {validationMessage && (
                <div className={`validation ${validationType}`}>
                  {validationType === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                  <span>{validationMessage}</span>
                </div>
              )}

              <div
                className="members-list"
                ref={listRef}
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: `${CARD_H}px`, gap: `${GAP}px` }}
              >
                {pageMembers.map((m, idx) => (
                  <div key={m.id} className={`member ${m.paid ? "paid" : ""}`}>
                    <div className="member-header">
                      <span className="badge">#{(idx + 1) + (page - 1) * pageSize}</span>
                      <div className="member-actions">
                        <button className={`circle ${m.paid ? "ok" : ""}`} onClick={() => togglePaid(m.id)} title={m.paid ? "Đã trả" : "Chưa trả"}>
                          {m.paid ? <CheckCircle size={16} /> : <CreditCard size={16} />}
                        </button>
                        <button className="circle danger" onClick={() => removeMember(m.id)} disabled={members.length === 1} title="Xóa">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="member-form">
                      <div className="form-group">
                        <label>Tên</label>
                        <input type="text" value={m.name} onChange={(e) => updateMember(m.id, "name", e.target.value)} placeholder="Nhập tên..." />
                      </div>
                      <div className="form-group">
                        <label>Giá gốc</label>
                        <input
                          type="number"
                          value={m.originalPrice}
                          onChange={(e) => updateMember(m.id, "originalPrice", e.target.value)}
                          placeholder="0"
                          onKeyDown={(e) => { if (e.key === "Enter" && (e.currentTarget.value || "").trim() !== "") addMember(); }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Phải trả</label>
                        <div className="price-pill">{(Number(m.finalPrice) || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pager">
                <button className="ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Trước</button>
                <div className="pager-label">Trang {page} / {pageCount} • Hiển thị {pageMembers.length}/{displayedMembers.length}</div>
                <button className="ghost" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Sau →</button>
              </div>
            </div>
          </section>

          {/* RIGHT */}
          <section className="stack">
            <div className="card card-fill">
              <div className="tabs">
                <button className={`tab ${rightTab === "overview" ? "active" : ""}`} onClick={() => setRightTab("overview")}>
                  <Gauge size={16} /> Tổng quan
                </button>
                <button className={`tab ${rightTab === "transfer" ? "active" : ""}`} onClick={() => setRightTab("transfer")}>
                  <CreditCard size={16} /> Chuyển khoản
                </button>
              </div>

              {rightTab === "overview" && (
                <div className="panel">
                  <div className="progress progress-lg">
                    <div className="progress-fill" style={{ width: `${paidRatio * 100}%` }} />
                  </div>
                  <div className="progress-label-lg">
                    ĐÃ THU {totalPaid.toLocaleString()} / {totalFinalPrice.toLocaleString()} VNĐ
                  </div>

                  <div className="summary">
                    <div className="row"><span>Tổng giá gốc</span><strong>{totalOriginalPrice.toLocaleString()} VNĐ</strong></div>
                    <div className="row"><span>Tổng phải trả</span><strong>{totalFinalPrice.toLocaleString()} VNĐ</strong></div>
                    <div className="row"><span>Đã trả</span><strong className="ok">{totalPaid.toLocaleString()} VNĐ</strong></div>
                    <div className="row"><span>Chưa trả</span><strong className="danger">{totalUnpaid.toLocaleString()} VNĐ</strong></div>
                    <div className="row total"><span>Tiết kiệm được</span><strong>{(totalOriginalPrice - totalFinalPrice).toLocaleString()} VNĐ</strong></div>
                  </div>
                </div>
              )}

              {rightTab === "transfer" && (
                <div className="panel panel-transfer">
                  <div className="grid-2">
                    <div className="form-group">
                      <label>Người nhận hôm nay</label>
                      <select value={payerMemberId ?? ""} onChange={(e) => onSelectPayer(e.target.value ? Number(e.target.value) : null)}>
                        <option value="">— Chọn người nhận —</option>
                        {members.map((m) => (<option key={m.id} value={m.id}>{m.name || `#${m.id}`}</option>))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>QR hiển thị</label>
                      <div className="hstack">
                        <select value={selectedQR} onChange={(e) => setSelectedQR(e.target.value)}>
                          {qrCodes.map((q) => (<option key={q.id} value={q.id}>{q.name}</option>))}
                        </select>
                        <button className="ghost" onClick={chooseRandomPayer}><Shuffle size={16} /> Random</button>
                        <button className="primary" onClick={() => setShowQR((v) => !v)}>
                          {showQR ? <X size={16} /> : <ListChecks size={16} />}{showQR ? " Ẩn QR" : " Hiện QR"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {payerMemberId != null && (
                    <div className="note">
                      Đang chọn người nhận: <strong>{members.find((m) => m.id === payerMemberId)?.name || `#${payerMemberId}`}</strong>
                      {" — "}QR hiện tại: <strong>{selectedQR}</strong>
                    </div>
                  )}

                  {showQR && (
                    <div className="qr-frame">
                      <img
                        src={`/qr-codes/${qrCodes.find((q) => q.id === selectedQR)?.file}`}
                        alt={`QR chuyển khoản của ${qrCodes.find((q) => q.id === selectedQR)?.name || selectedQR}`}
                        onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling.style.display = "flex"; }}
                      />
                      <div className="qr-fallback" style={{ display: "none" }}>
                        <CreditCard size={40} />
                        <p>Chưa có QR cho {qrCodes.find((q) => q.id === selectedQR)?.name}</p>
                        <p>Thêm file vào /public/qr-codes/</p>
                      </div>
                    </div>
                  )}

                  <div className="note">
                    {totalUnpaid > 0 ? <>Còn thiếu <strong>{totalUnpaid.toLocaleString()} VNĐ</strong>. Vui lòng chuyển cho người nhận.</>
                      : <>🎉 Đã thu đủ tiền!</>}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
