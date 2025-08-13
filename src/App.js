import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Calculator,
  Users,
  Receipt,
  AlertTriangle,
  CheckCircle,
  CreditCard,
  Filter,
  Copy,
  Shuffle,
  Gauge,
  ListChecks,
  Upload,
  Edit2,
} from "lucide-react";
import "./App.css";

/* ================= Firebase ================= */
import { db, auth } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

/* ================= Storage keys ================= */
const STORAGE_SHEETS = "billSplitter_sheets_v1";
const STORAGE_ACTIVE = "billSplitter_activeSheet_v1";
const STORAGE_CUSTOM_QR = "billSplitter_customQR_v1";

/* ================= Built-in QR (ảnh trong /public/qr-codes/) ================= */
const builtinQRCodes = [
  { id: "Dat", name: "Dat", file: "Dat.png", builtin: true },
  { id: "Huy", name: "Huy", file: "Huy.png", builtin: true },
  { id: "Nguyen", name: "Nguyen", file: "Nguyen.png", builtin: true },
  { id: "Quang", name: "Quang", file: "Quang.png", builtin: true },
  { id: "Thu", name: "Thu", file: "Thu.png", builtin: true },
];

/* ================= Defaults ================= */
const defaultSheetState = (name = "Sheet 1") => ({
  name,
  billData: { totalAmount: "", discount: "", shipping: "" },
  members: [{ id: 1, name: "", originalPrice: "", finalPrice: 0, paid: false }],
  selectedQR: builtinQRCodes[0].id,
  payerMemberId: null,
  showUnpaidOnly: false,
  rightTab: "overview",
  cloudId: null, // Firestore doc id nếu đã bật đồng bộ
});

const genId = () => "s" + Math.random().toString(36).slice(2, 9);

export default function App() {
  /* ---------- Global: sheets & custom QR ---------- */
  const [sheetsMap, setSheetsMap] = useState({}); // {sheetId: SheetState}
  const [activeSheetId, setActiveSheetId] = useState("");
  const [customQRs, setCustomQRs] = useState([]); // [{id,name,src,builtin:false}]
  const allQRCodes = useMemo(
    () => [...builtinQRCodes, ...customQRs],
    [customQRs]
  );

  /* ---------- Per-sheet states (bind theo sheet đang active) ---------- */
  const [billData, setBillData] = useState(defaultSheetState().billData);
  const [members, setMembers] = useState(defaultSheetState().members);
  const [selectedQR, setSelectedQR] = useState(defaultSheetState().selectedQR);
  const [payerMemberId, setPayerMemberId] = useState(
    defaultSheetState().payerMemberId
  );
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(
    defaultSheetState().showUnpaidOnly
  );
  const [rightTab, setRightTab] = useState(defaultSheetState().rightTab);

  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [validationMessage, setValidationMessage] = useState("");
  const [validationType, setValidationType] = useState(""); // success|warning|error
  const [isLoaded, setIsLoaded] = useState(false);

  /* ---------- Firebase auth (ẩn danh) ---------- */
  const [uid, setUid] = useState(null);
  useEffect(() => onAuthStateChanged(auth, (u) => setUid(u?.uid || null)), []);

  /* ---------- Realtime cloud sync state ---------- */
  const [cloudUnsub, setCloudUnsub] = useState(null); // hàm hủy subscribe
  const [canWrite, setCanWrite] = useState(false); // có quyền cập nhật doc không
  const lastPushedRef = useRef(""); // tránh vòng lặp phản xạ

  /* ---------- Pagination (auto-fit, no page scroll) ---------- */
  const listRef = useRef(null);
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(2);
  const [page, setPage] = useState(1);

  // Layout constants (đồng bộ với CSS)
  const MIN_CARD_W = 260; // px
  const CARD_H = 200; // px (theo yêu cầu)
  const GAP = 12; // px

  /* ---------- Initial load ---------- */
  useEffect(() => {
    try {
      // 1) Nạp QR custom
      const rawQR = localStorage.getItem(STORAGE_CUSTOM_QR);
      const custom = rawQR ? JSON.parse(rawQR) : [];
      setCustomQRs(custom || []);

      // 2) Nếu URL có ?cloud=... -> mở live view ngay (không ghi "(live)" vào dữ liệu)
      const params = new URLSearchParams(window.location.search);
      const cloudParam = params.get("cloud");
      if (cloudParam) {
        const unsub = onSnapshot(doc(db, "sheets", cloudParam), (snap) => {
          if (!snap.exists()) return;
          const d = snap.data();
          setCanWrite(d.owner === uid);
          const s = d.data || {};
          const viewId = "cloudView";
          setSheetsMap({
            [viewId]: {
              name: d.name || "Live",
              billData: s.billData || {},
              members: (s.members || []).map((m) => ({
                ...m,
                finalPrice: Number(m.finalPrice) || 0,
              })),
              selectedQR: s.selectedQR,
              payerMemberId: s.payerMemberId ?? null,
              showUnpaidOnly: !!s.showUnpaidOnly,
              rightTab: s.rightTab || "overview",
              cloudId: cloudParam,
            },
          });
          setActiveSheetId(viewId);
          setBillData(s.billData || {});
          setMembers(
            (s.members || []).map((m) => ({
              ...m,
              finalPrice: Number(m.finalPrice) || 0,
            }))
          );
          setSelectedQR(s.selectedQR);
          setPayerMemberId(s.payerMemberId ?? null);
          setShowUnpaidOnly(!!s.showUnpaidOnly);
          setRightTab(s.rightTab || "overview");
          setPage(1);
        });
        setCloudUnsub(() => unsub);
        setIsLoaded(true);
        return () => unsub();
      }

      // 3) Nạp từ localStorage
      const rawSheets = localStorage.getItem(STORAGE_SHEETS);
      const rawActive = localStorage.getItem(STORAGE_ACTIVE);
      if (rawSheets) {
        const parsed = JSON.parse(rawSheets) || {};
        // sanitize members
        Object.values(parsed).forEach((s) => {
          s.members = (s.members || []).map((m) => ({
            ...m,
            finalPrice: Number(m.finalPrice) || 0,
          }));
        });
        setSheetsMap(parsed);
        const aid =
          rawActive && parsed[rawActive] ? rawActive : Object.keys(parsed)[0];
        if (aid) {
          setActiveSheetId(aid);
          const s = parsed[aid];
          const exists = [...builtinQRCodes, ...custom].some(
            (q) => q.id === s.selectedQR
          );
          setBillData(s.billData || defaultSheetState().billData);
          setMembers(
            (s.members || defaultSheetState().members).map((m) => ({
              ...m,
              finalPrice: Number(m.finalPrice) || 0,
            }))
          );
          setSelectedQR(exists ? s.selectedQR : builtinQRCodes[0].id);
          setPayerMemberId(s.payerMemberId ?? null);
          setShowUnpaidOnly(!!s.showUnpaidOnly);
          setRightTab(s.rightTab || "overview");
        } else {
          const id = genId();
          const init = { [id]: defaultSheetState("Sheet 1") };
          setSheetsMap(init);
          setActiveSheetId(id);
          const s = init[id];
          setBillData(s.billData);
          setMembers(s.members);
          setSelectedQR(s.selectedQR);
          setPayerMemberId(s.payerMemberId);
          setShowUnpaidOnly(s.showUnpaidOnly);
          setRightTab(s.rightTab);
          localStorage.setItem(STORAGE_SHEETS, JSON.stringify(init));
          localStorage.setItem(STORAGE_ACTIVE, id);
        }
      } else {
        const id = genId();
        const init = { [id]: defaultSheetState("Sheet 1") };
        setSheetsMap(init);
        setActiveSheetId(id);
        const s = init[id];
        setBillData(s.billData);
        setMembers(s.members);
        setSelectedQR(s.selectedQR);
        setPayerMemberId(s.payerMemberId);
        setShowUnpaidOnly(s.showUnpaidOnly);
        setRightTab(s.rightTab);
        localStorage.setItem(STORAGE_SHEETS, JSON.stringify(init));
        localStorage.setItem(STORAGE_ACTIVE, id);
      }
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setIsLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  /* ---------- Persist changes per sheet ---------- */
  useEffect(() => {
    if (!isLoaded || !activeSheetId) return;
    setSheetsMap((prev) => {
      const next = {
        ...prev,
        [activeSheetId]: {
          ...(prev[activeSheetId] || defaultSheetState()),
          billData,
          members,
          selectedQR,
          payerMemberId,
          showUnpaidOnly,
          rightTab,
          name: prev[activeSheetId]?.name || "Sheet",
          cloudId: prev[activeSheetId]?.cloudId || null,
        },
      };
      localStorage.setItem(STORAGE_SHEETS, JSON.stringify(next));
      localStorage.setItem(STORAGE_ACTIVE, activeSheetId);
      return next;
    });
  }, [
    billData,
    members,
    selectedQR,
    payerMemberId,
    showUnpaidOnly,
    rightTab,
    activeSheetId,
    isLoaded,
  ]);

  /* ---------- Persist custom QR ---------- */
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_CUSTOM_QR, JSON.stringify(customQRs));
  }, [customQRs, isLoaded]);

  /* ---------- Sheet actions ---------- */
  const switchSheet = (id) => {
    if (!id || !sheetsMap[id]) return;
    setActiveSheetId(id);
    const s = sheetsMap[id];
    const exists = allQRCodes.some((q) => q.id === s.selectedQR);
    setBillData(s.billData || defaultSheetState().billData);
    setMembers(
      (s.members || defaultSheetState().members).map((m) => ({
        ...m,
        finalPrice: Number(m.finalPrice) || 0,
      }))
    );
    setSelectedQR(exists ? s.selectedQR : builtinQRCodes[0].id);
    setPayerMemberId(s.payerMemberId ?? null);
    setShowUnpaidOnly(!!s.showUnpaidOnly);
    setRightTab(s.rightTab || "overview");
    setPage(1);
    localStorage.setItem(STORAGE_ACTIVE, id);
  };

  const createSheet = () => {
    const name = window.prompt(
      "Tên sheet mới:",
      `Sheet ${Object.keys(sheetsMap).length + 1}`
    );
    if (!name) return;
    const id = genId();
    const newSheet = defaultSheetState(name);
    setSheetsMap((prev) => {
      const next = { ...prev, [id]: newSheet };
      localStorage.setItem(STORAGE_SHEETS, JSON.stringify(next));
      return next;
    });
    setActiveSheetId(id);
    setBillData(newSheet.billData);
    setMembers(newSheet.members);
    setSelectedQR(newSheet.selectedQR);
    setPayerMemberId(newSheet.payerMemberId);
    setShowUnpaidOnly(newSheet.showUnpaidOnly);
    setRightTab(newSheet.rightTab);
    setPage(1);
    localStorage.setItem(STORAGE_ACTIVE, id);
  };

  const renameSheet = () => {
    if (!activeSheetId) return;
    const current = sheetsMap[activeSheetId];
    const name = window.prompt("Đổi tên sheet:", current?.name || "");
    if (!name) return;
    setSheetsMap((prev) => {
      const next = {
        ...prev,
        [activeSheetId]: { ...(prev[activeSheetId] || defaultSheetState()), name },
      };
      localStorage.setItem(STORAGE_SHEETS, JSON.stringify(next));
      return next;
    });
  };

  const deleteSheet = () => {
    if (!activeSheetId) return;
    const current = sheetsMap[activeSheetId];
    if (!window.confirm(`Xoá sheet "${current?.name}"?`)) return;
    setSheetsMap((prev) => {
      const ids = Object.keys(prev).filter((k) => k !== activeSheetId);
      let nextMap = { ...prev };
      delete nextMap[activeSheetId];

      if (ids.length === 0) {
        const id = genId();
        nextMap = { [id]: defaultSheetState("Sheet 1") };
        setActiveSheetId(id);
        const s = nextMap[id];
        setBillData(s.billData);
        setMembers(s.members);
        setSelectedQR(s.selectedQR);
        setPayerMemberId(s.payerMemberId);
        setShowUnpaidOnly(s.showUnpaidOnly);
        setRightTab(s.rightTab);
        setPage(1);
        localStorage.setItem(STORAGE_ACTIVE, id);
      } else {
        const nextId = ids[0];
        setActiveSheetId(nextId);
        const s = prev[nextId];
        const exists = allQRCodes.some((q) => q.id === s.selectedQR);
        setBillData(s.billData);
        setMembers(
          (s.members || []).map((m) => ({
            ...m,
            finalPrice: Number(m.finalPrice) || 0,
          }))
        );
        setSelectedQR(exists ? s.selectedQR : builtinQRCodes[0].id);
        setPayerMemberId(s.payerMemberId ?? null);
        setShowUnpaidOnly(!!s.showUnpaidOnly);
        setRightTab(s.rightTab || "overview");
        setPage(1);
        localStorage.setItem(STORAGE_ACTIVE, nextId);
      }
      localStorage.setItem(STORAGE_SHEETS, JSON.stringify(nextMap));
      return nextMap;
    });
  };

  /* ---------- Business logic ---------- */
  useEffect(() => {
    const total = parseFloat(billData.totalAmount) || 0;
    const discount = parseFloat(billData.discount) || 0;
    const shipping = parseFloat(billData.shipping) || 0;
    if (total > 0) {
      const netDiscount = Math.max(0, discount - shipping);
      const pct = (netDiscount / total) * 100;
      setDiscountPercentage(Math.min(Math.max(pct, 0), 100));
    } else setDiscountPercentage(0);
  }, [billData]);

  useEffect(() => {
    if (!isLoaded) return;
    setMembers((prev) =>
      prev.map((m) => {
        const original = parseFloat(m.originalPrice) || 0;
        const finalPrice = Math.round(original * (1 - discountPercentage / 100));
        return { ...m, finalPrice };
      })
    );
  }, [discountPercentage, isLoaded]);

  useEffect(() => {
    const sumOriginal = members.reduce(
      (s, m) => s + (parseFloat(m.originalPrice) || 0),
      0
    );
    const expected = parseFloat(billData.totalAmount) || 0;
    if (expected > 0 && sumOriginal > 0) {
      const diff = expected - sumOriginal;
      const abs = Math.abs(diff);
      const tolerance = 1000;
      if (abs <= tolerance) {
        if (abs < 100) {
          setValidationMessage("✅ Tổng tiền khớp chính xác!");
          setValidationType("success");
        } else {
          setValidationMessage(
            `⚠️ Tổng tiền gần đúng (sai số: ${abs.toLocaleString()} VNĐ)`
          );
          setValidationType("warning");
        }
      } else {
        const label = diff > 0 ? "Thiếu" : "Thừa";
        setValidationMessage(
          `❌ Tổng tiền không khớp! ${label}: ${abs.toLocaleString()} VNĐ`
        );
        setValidationType("error");
      }
    } else {
      setValidationMessage("");
      setValidationType("");
    }
  }, [members, billData.totalAmount]);

  /* ---------- Auto-fit (no scroll) ---------- */
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
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, []);

  /* ---------- Derived ---------- */
  const totalOriginalPrice = useMemo(
    () => members.reduce((s, m) => s + (parseFloat(m.originalPrice) || 0), 0),
    [members]
  );
  const totalFinalPrice = useMemo(
    () => members.reduce((s, m) => s + (parseFloat(m.finalPrice) || 0), 0),
    [members]
  );
  const totalPaid = useMemo(
    () =>
      members.reduce(
        (s, m) => s + (m.paid ? (parseFloat(m.finalPrice) || 0) : 0),
        0
      ),
    [members]
  );
  const totalUnpaid = totalFinalPrice - totalPaid;
  const paidRatio =
    totalFinalPrice > 0 ? Math.min(totalPaid / totalFinalPrice, 1) : 0;

  const displayedMembers = useMemo(
    () => (showUnpaidOnly ? members.filter((m) => !m.paid) : members),
    [members, showUnpaidOnly]
  );

  const pageSize = Math.max(1, cols * rows);
  const pageCount = Math.max(1, Math.ceil(displayedMembers.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const start = (page - 1) * pageSize;
  const pageMembers = displayedMembers.slice(start, start + pageSize);

  /* ---------- Member & utility actions ---------- */
  const handleBillDataChange = (field, value) =>
    setBillData((prev) => ({ ...prev, [field]: value }));

  const addMember = () => {
    const newId = members.length ? Math.max(...members.map((m) => m.id)) + 1 : 1;
    setMembers((prev) => [
      ...prev,
      { id: newId, name: "", originalPrice: "", finalPrice: 0, paid: false },
    ]);
  };
  const removeMember = (id) => {
    if (members.length <= 1) return;
    setMembers((prev) => prev.filter((m) => m.id !== id));
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
  const togglePaid = (id) =>
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, paid: !m.paid } : m))
    );

  const autoMatchQR = (name) => {
    if (!name) return;
    const t = allQRCodes.find(
      (q) =>
        q.id.toLowerCase() === name.toLowerCase() ||
        q.name.toLowerCase() === name.toLowerCase()
    );
    if (t) setSelectedQR(t.id);
  };

  // Random người nhận (dùng ở nút Random)
  const chooseRandomPayer = () => {
    if (!members.length) return;
    const pool = members; // hoặc members.filter(m => !m.paid)
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) return;
    setPayerMemberId(pick.id);
    if (pick.name) autoMatchQR(pick.name);
    setRightTab("transfer");
  };

  const copySummary = async () => {
    const sheetName = sheetsMap[activeSheetId]?.name || "Sheet";
    const lines = [];
    lines.push(`Bill Splitter - ${sheetName}`);
    lines.push(
      `Tổng đơn: ${(parseFloat(billData.totalAmount) || 0).toLocaleString()} VNĐ`
    );
    lines.push(
      `Giảm: ${(parseFloat(billData.discount) || 0).toLocaleString()} - Ship: ${
        (parseFloat(billData.shipping) || 0).toLocaleString()
      }`
    );
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
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      alert("Đã sao chép nội dung chia sẻ ✅");
    } catch {
      alert("Không thể sao chép. Hãy thử trên HTTPS hoặc trình duyệt khác.");
    }
  };

  /* ---------- Upload QR ---------- */
  const [qrUploadName, setQrUploadName] = useState("");
  const [qrUploadData, setQrUploadData] = useState(null);
  const onPickQRFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setQrUploadData(e.target.result); // dataURL
    reader.readAsDataURL(file);
  };
  const addCustomQR = () => {
    if (!qrUploadName || !qrUploadData) return;
    const id = "custom-" + Date.now();
    const newQR = { id, name: qrUploadName, src: qrUploadData, builtin: false };
    setCustomQRs((prev) => [...prev, newQR]);
    setSelectedQR(id);
    setQrUploadName("");
    setQrUploadData(null);
  };
  const removeCustomQR = (id) => {
    setCustomQRs((prev) => prev.filter((q) => q.id !== id));
    if (selectedQR === id) setSelectedQR(builtinQRCodes[0].id);
  };

  /* ---------- Helpers for QR src (CRA) ---------- */
  const getQRSrcById = (id) => {
    const q =
      allQRCodes.find((x) => x.id === id) ||
      builtinQRCodes.find((x) => x.id === id);
    if (!q) return null;
    if (q.builtin) {
      // ảnh trong public/qr-codes/<file>
      return `${process.env.PUBLIC_URL}/qr-codes/${q.file}`;
    }
    return q.src; // dataURL khi là custom
  };

  /* ---------- Cloud sync: start/stop & link ---------- */
  const makeSheetData = () => ({
    billData,
    members,
    selectedQR,
    payerMemberId,
    showUnpaidOnly,
    rightTab,
  });

  const startCloudSync = async () => {
    try {
      const sheet = sheetsMap[activeSheetId];
      if (!sheet) return alert("Chưa chọn sheet.");
      if (!uid) return alert("Đang đăng nhập ẩn danh… thử lại sau vài giây.");

      let cloudId = sheet.cloudId;

      // 1) Nếu chưa có doc -> tạo
      if (!cloudId) {
        const docRef = await addDoc(collection(db, "sheets"), {
          owner: uid,
          name: sheet.name,
          data: makeSheetData(),
          updatedAt: serverTimestamp(),
        });
        cloudId = docRef.id;
        // lưu vào sheet
        setSheetsMap((prev) => {
          const next = { ...prev };
          next[activeSheetId] = { ...next[activeSheetId], cloudId };
          localStorage.setItem(STORAGE_SHEETS, JSON.stringify(next));
          return next;
        });
      }

      // 2) Subscribe realtime
      if (cloudUnsub) cloudUnsub();
      const unsub = onSnapshot(doc(db, "sheets", cloudId), (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        setCanWrite(d.owner === uid);

        const incoming = JSON.stringify(d.data || {});
        if (incoming === lastPushedRef.current) return; // bỏ echo của chính mình

        const s = d.data || {};
        setBillData(s.billData || {});
        setMembers(
          (s.members || []).map((m) => ({
            ...m,
            finalPrice: Number(m.finalPrice) || 0,
          }))
        );
        setSelectedQR(s.selectedQR);
        setPayerMemberId(s.payerMemberId ?? null);
        setShowUnpaidOnly(!!s.showUnpaidOnly);
        setRightTab(s.rightTab || "overview");
      });
      setCloudUnsub(() => unsub);
      alert("Đã bật đồng bộ realtime cho sheet này.");
    } catch (err) {
      console.error("startCloudSync failed:", err);
      alert("Không thể bật đồng bộ: " + (err?.message || err));
    }
  };

  const stopCloudSync = () => {
    if (cloudUnsub) {
      cloudUnsub();
      setCloudUnsub(null);
      alert("Đã tắt đồng bộ realtime.");
    }
  };

  const copyLiveLink = async () => {
    const id = sheetsMap[activeSheetId]?.cloudId;
    if (!id) return alert("Sheet này chưa bật đồng bộ.");
    const url = `${window.location.origin}${window.location.pathname}?cloud=${id}`;
    await navigator.clipboard.writeText(url);
    alert("Đã copy link live ✅");
  };

  // Push local -> cloud (chỉ khi là owner và không ở cloudView)
  useEffect(() => {
    const sheet = sheetsMap[activeSheetId];
    const cloudId = sheet?.cloudId;
    if (!cloudId || !canWrite || activeSheetId === "cloudView") return;

    const data = makeSheetData();
    const payloadStr = JSON.stringify(data);

    const t = setTimeout(async () => {
      try {
        lastPushedRef.current = payloadStr;
        const payload = {
          data,
          updatedAt: serverTimestamp(),
        };
        // Chỉ cập nhật tên khi không ở chế độ cloudView
        payload.name = sheet.name;
        await updateDoc(doc(db, "sheets", cloudId), payload);
      } catch (e) {
        console.error(e);
      }
    }, 350); // debounce

    return () => clearTimeout(t);
  }, [
    billData,
    members,
    selectedQR,
    payerMemberId,
    showUnpaidOnly,
    rightTab,
    activeSheetId,
    canWrite,
    sheetsMap,
  ]);

  /* ================= UI ================= */
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Receipt className="brand-icon" />
          <span>Bill Splitter</span>
        </div>

        {/* Sheet controls */}
        <div className="sheetbar">
          <select
            className="sheet-select"
            value={activeSheetId}
            onChange={(e) => switchSheet(e.target.value)}
          >
            {Object.entries(sheetsMap).map(([id, sheet]) => (
              <option key={id} value={id}>
                {sheet.name}
              </option>
            ))}
          </select>
          <button className="ghost" onClick={createSheet}>
            <Plus size={16} /> Sheet mới
          </button>
          <button className="ghost" onClick={renameSheet}>
            <Edit2 size={16} /> Đổi tên
          </button>
          <button className="danger" onClick={deleteSheet}>
            <Trash2 size={16} /> Xoá sheet
          </button>
        </div>

        <div className="top-actions">
          <button className="ghost" onClick={copySummary}>
            <Copy size={16} /> Copy chia sẻ
          </button>
          <button className="ghost" onClick={startCloudSync}>
            Bật đồng bộ
          </button>
          <button className="ghost" onClick={copyLiveLink}>
            Link live
          </button>
          <button className="danger" onClick={stopCloudSync}>
            Tắt đồng bộ
          </button>
        </div>
      </header>

      <main className="shell">
        <div className="main-grid">
          {/* LEFT */}
          <section className="stack">
            {/* Bill */}
            <div className="card">
              <div className="card-header">
                <Calculator className="card-icon" />
                <h2>
                  Thông tin đơn hàng — {sheetsMap[activeSheetId]?.name || ""}
                  {activeSheetId === "cloudView" ? " (live)" : ""}
                </h2>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Tổng tiền đơn (VNĐ)</label>
                  <input
                    type="number"
                    value={billData.totalAmount}
                    onChange={(e) =>
                      handleBillDataChange("totalAmount", e.target.value)
                    }
                    placeholder="Nhập tổng tiền..."
                  />
                </div>
                <div className="form-group">
                  <label>Tiền giảm giá voucher (VNĐ)</label>
                  <input
                    type="number"
                    value={billData.discount}
                    onChange={(e) =>
                      handleBillDataChange("discount", e.target.value)
                    }
                    placeholder="Nhập tiền giảm giá..."
                  />
                </div>
                <div className="form-group">
                  <label>Tiền ship (VNĐ)</label>
                  <input
                    type="number"
                    value={billData.shipping}
                    onChange={(e) =>
                      handleBillDataChange("shipping", e.target.value)
                    }
                    placeholder="Nhập tiền ship..."
                  />
                </div>
              </div>
              <div className="discount-info">
                <div className="discount-badge">
                  <span>Phần trăm giảm giá</span>
                  <strong>{discountPercentage.toFixed(1)}%</strong>
                </div>
              </div>
            </div>

            {/* Members */}
            <div className="card card-fill">
              <div className="card-header">
                <Users className="card-icon" />
                <h2>Thành viên</h2>
                <div className="spacer" />
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={showUnpaidOnly}
                    onChange={(e) => {
                      setShowUnpaidOnly(e.target.checked);
                      setPage(1);
                    }}
                  />
                  <span>
                    <Filter size={14} /> Chỉ hiện chưa trả
                  </span>
                </label>
                <button className="primary" onClick={addMember}>
                  <Plus size={16} /> Thêm
                </button>
              </div>

              {validationMessage && (
                <div className={`validation ${validationType}`}>
                  {validationType === "success" ? (
                    <CheckCircle size={18} />
                  ) : (
                    <AlertTriangle size={18} />
                  )}
                  <span>{validationMessage}</span>
                </div>
              )}

              <div
                className="members-list"
                ref={listRef}
                style={{
                  gridTemplateColumns: `repeat(${cols}, minmax(${MIN_CARD_W}px, 1fr))`,
                  gridAutoRows: `${CARD_H}px`,
                  gap: `${GAP}px`,
                }}
              >
                {pageMembers.map((m, idx) => (
                  <div key={m.id} className={`member ${m.paid ? "paid" : ""}`}>
                    <div className="member-header">
                      <span className="badge">
                        #{idx + 1 + (page - 1) * pageSize}
                      </span>
                      <div className="member-actions">
                        <button
                          className={`circle ${m.paid ? "ok" : ""}`}
                          onClick={() => togglePaid(m.id)}
                          title={m.paid ? "Đã trả" : "Chưa trả"}
                        >
                          {m.paid ? (
                            <CheckCircle size={16} />
                          ) : (
                            <CreditCard size={16} />
                          )}
                        </button>
                        <button
                          className="circle danger"
                          onClick={() => removeMember(m.id)}
                          disabled={members.length === 1}
                          title="Xóa"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="member-form">
                      <div className="form-group">
                        <label>Tên</label>
                        <input
                          type="text"
                          value={m.name}
                          onChange={(e) => updateMember(m.id, "name", e.target.value)}
                          placeholder="Nhập tên..."
                        />
                      </div>
                      <div className="form-group">
                        <label>Giá gốc</label>
                        <input
                          type="number"
                          value={m.originalPrice}
                          onChange={(e) =>
                            updateMember(m.id, "originalPrice", e.target.value)
                          }
                          placeholder="0"
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              (e.currentTarget.value || "").trim() !== ""
                            )
                              addMember();
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label>Phải trả</label>
                        <div className="price-pill">
                          {(Number(m.finalPrice) || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pager">
                <button
                  className="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Trước
                </button>
                <div className="pager-label">
                  Trang {page} / {pageCount} • Hiển thị {pageMembers.length}/
                  {displayedMembers.length}
                </div>
                <button
                  className="ghost"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Sau →
                </button>
              </div>
            </div>
          </section>

          {/* RIGHT */}
          <section className="stack">
            <div className="card card-fill">
              <div className="tabs">
                <button
                  className={`tab ${rightTab === "overview" ? "active" : ""}`}
                  onClick={() => setRightTab("overview")}
                >
                  <Gauge size={16} /> Tổng quan
                </button>
                <button
                  className={`tab ${rightTab === "transfer" ? "active" : ""}`}
                  onClick={() => setRightTab("transfer")}
                >
                  <CreditCard size={16} /> Chuyển khoản
                </button>
              </div>

              {rightTab === "overview" && (
                <div className="panel">
                  <div className="progress progress-lg">
                    <div
                      className="progress-fill"
                      style={{ width: `${paidRatio * 100}%` }}
                    />
                  </div>
                  <div className="progress-label-lg">
                    ĐÃ THU {totalPaid.toLocaleString()} /{" "}
                    {totalFinalPrice.toLocaleString()} VNĐ
                  </div>

                  <div className="summary">
                    <div className="row">
                      <span>Tổng giá gốc</span>
                      <strong>{totalOriginalPrice.toLocaleString()} VNĐ</strong>
                    </div>
                    <div className="row">
                      <span>Tổng phải trả</span>
                      <strong>{totalFinalPrice.toLocaleString()} VNĐ</strong>
                    </div>
                    <div className="row">
                      <span>Đã trả</span>
                      <strong className="ok">
                        {totalPaid.toLocaleString()} VNĐ
                      </strong>
                    </div>
                    <div className="row">
                      <span>Chưa trả</span>
                      <strong className="danger">
                        {totalUnpaid.toLocaleString()} VNĐ
                      </strong>
                    </div>
                    <div className="row total">
                      <span>Tiết kiệm được</span>
                      <strong>
                        {(totalOriginalPrice - totalFinalPrice).toLocaleString()} VNĐ
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {rightTab === "transfer" && (
                <div className="panel panel-transfer">
                  <div className="grid-2">
                    <div className="form-group">
                      <label>Người nhận hôm nay</label>
                      <select
                        value={payerMemberId ?? ""}
                        onChange={(e) =>
                          setPayerMemberId(
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      >
                        <option value="">— Chọn người nhận —</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name || `#${m.id}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>QR hiển thị</label>
                      <div className="hstack">
                        <select
                          value={selectedQR}
                          onChange={(e) => setSelectedQR(e.target.value)}
                          title="Chọn QR"
                        >
                          {allQRCodes.map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.name}
                              {q.builtin ? "" : " (custom)"}
                            </option>
                          ))}
                        </select>
                        <button className="ghost" onClick={chooseRandomPayer}>
                          <Shuffle size={16} /> Random
                        </button>
                        <button
                          className="primary"
                          onClick={() => setRightTab("transfer")}
                        >
                          <ListChecks size={16} /> Hiện QR
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Khung QR */}
                  <div className="qr-frame">
                    {(() => {
                      const src = getQRSrcById(selectedQR);
                      if (!src) {
                        return (
                          <div className="qr-fallback">
                            <CreditCard size={40} />
                            <p>Chưa chọn QR</p>
                          </div>
                        );
                      }
                      return (
                        <>
                          <img
                            src={src}
                            alt="QR chuyển khoản"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              e.currentTarget.nextElementSibling.style.display =
                                "flex";
                            }}
                          />
                          <div className="qr-fallback" style={{ display: "none" }}>
                            <CreditCard size={40} />
                            <p>Không tìm thấy ảnh QR.</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Upload QR */}
                  <div className="qr-upload">
                    <div className="form-group">
                      <label>Tên QR (chủ/ghi chú)</label>
                      <input
                        type="text"
                        placeholder="VD: Huy Momo"
                        value={qrUploadName}
                        onChange={(e) => setQrUploadName(e.target.value)}
                      />
                    </div>
                    <div className="hstack">
                      <label className="upload-btn">
                        <Upload size={16} />
                        <span>Chọn ảnh QR</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => onPickQRFile(e.target.files?.[0])}
                        />
                      </label>
                      <button
                        className="primary"
                        disabled={!qrUploadName || !qrUploadData}
                        onClick={addCustomQR}
                      >
                        Thêm QR
                      </button>
                    </div>

                    {customQRs.length > 0 && (
                      <div className="qr-list">
                        {customQRs.map((q) => (
                          <div key={q.id} className="qr-item">
                            <img src={q.src} alt={q.name} />
                            <span title={q.name}>{q.name}</span>
                            <button
                              className="circle danger"
                              onClick={() => removeCustomQR(q.id)}
                              title="Xóa QR"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="note">
                    {totalUnpaid > 0 ? (
                      <>
                        Còn thiếu <strong>{totalUnpaid.toLocaleString()} VNĐ</strong>. Vui lòng
                        chuyển cho người nhận.
                      </>
                    ) : (
                      <>🎉 Đã thu đủ tiền!</>
                    )}
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
