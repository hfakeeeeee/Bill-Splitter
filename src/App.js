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
  Gauge,
  Upload,
  Edit2,
  Share2,
  Wifi,
  WifiOff,
  X,
  Minus,
  Eye,
  EyeOff,
} from "lucide-react";
import "./App.css";
import { syncService, getSetupStatus, showSetupGuide } from "./supabase";

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
  const [showQR, setShowQR] = useState(false);
  const [justSaved, setJustSaved] = useState(false); // Track recent saves to prevent immediate unsaved marking

  /* ---------- Live sync state ---------- */
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveId, setLiveId] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, error
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null); // {type: 'success'|'error'|'loading', message: '...'}
  const [isDataLoading, setIsDataLoading] = useState(false);
  const unsubscribeRef = useRef(null);

  /* ---------- Notification System ---------- */
  const showNotification = (type, message, duration = 3000) => {
    setNotification({ type, message });
    if (duration > 0) {
      setTimeout(() => setNotification(null), duration);
    }
  };

  const hideNotification = () => setNotification(null);

  /* ---------- Monitor online status ---------- */
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const listRef = useRef(null);
  const [cols, setCols] = useState(3);
  const [rows, setRows] = useState(2);
  const [page, setPage] = useState(1);

  // Layout constants (đồng bộ với CSS)
  const MIN_CARD_W = 240; // px (reduced from 260)
  const CARD_H = 180; // px (reduced from 200)
  const GAP = 10; // px (reduced from 12)

  /* ---------- Initial load ---------- */
  useEffect(() => {
    try {
      // 1) Nạp QR custom
      const rawQR = localStorage.getItem(STORAGE_CUSTOM_QR);
      const custom = rawQR ? JSON.parse(rawQR) : [];
      setCustomQRs(custom || []);

      // 1.5) Show setup status for development
      if (process.env.NODE_ENV === 'development') {
        const status = getSetupStatus();
        console.log('🔧 Sync Service Status:', status);
        if (!status.usingSupabase) {
          showSetupGuide();
        }
      }

      // 2) Check for live shared data in URL
      const params = new URLSearchParams(window.location.search);
      const liveParam = params.get("live");
      if (liveParam) {
        // Show loading for shared links
        setIsDataLoading(true);
        showNotification('loading', '� Đang tải dữ liệu chia sẻ...', 0);
        
        // Try to get data from real-time service first
        const syncData = localStorage.getItem(`sync_${liveParam}`);
        const liveData = localStorage.getItem(`live_${liveParam}`);
        
        const dataSource = syncData || liveData;
        if (dataSource) {
          try {
            const decoded = JSON.parse(dataSource);
            const liveViewId = "live_view";
            const liveSheet = {
              ...defaultSheetState(decoded.name || "Live Sheet"),
              billData: decoded.billData || defaultSheetState().billData,
              members: (decoded.members || []).map((m) => ({
                ...m,
                finalPrice: Number(m.finalPrice) || 0,
              })),
              selectedQR: decoded.selectedQR || defaultSheetState().selectedQR,
              payerMemberId: decoded.payerMemberId ?? null,
              showUnpaidOnly: !!decoded.showUnpaidOnly,
              rightTab: decoded.rightTab || "overview",
            };
            
            setSheetsMap({ [liveViewId]: liveSheet });
            setActiveSheetId(liveViewId);
            setBillData(liveSheet.billData);
            setMembers(liveSheet.members);
            setSelectedQR(liveSheet.selectedQR);
            setPayerMemberId(liveSheet.payerMemberId);
            setShowUnpaidOnly(liveSheet.showUnpaidOnly);
            setRightTab(liveSheet.rightTab);
            setLiveId(liveParam);
            setIsLiveMode(true);
            setLastUpdateTime(decoded.lastUpdate || Date.now());
            
            // Subscribe to real-time updates
            const unsubscribe = syncService.subscribe(liveParam, (newData) => {
              if (newData.timestamp > lastUpdateTime) {
                setBillData(newData.billData || {});
                setMembers((newData.members || []).map((m) => ({
                  ...m,
                  finalPrice: Number(m.finalPrice) || 0,
                })));
                setSelectedQR(newData.selectedQR || builtinQRCodes[0].id);
                setPayerMemberId(newData.payerMemberId ?? null);
                setShowUnpaidOnly(!!newData.showUnpaidOnly);
                setRightTab(newData.rightTab || "overview");
                setLastUpdateTime(newData.timestamp);
              }
            });
            
            // Setup cross-tab sync
            const crossTabUnsub = syncService.setupCrossTabSync(liveParam, (newData) => {
              if (newData.lastUpdate && newData.lastUpdate > lastUpdateTime) {
                setBillData(newData.billData || {});
                setMembers((newData.members || []).map((m) => ({
                  ...m,
                  finalPrice: Number(m.finalPrice) || 0,
                })));
                setSelectedQR(newData.selectedQR || builtinQRCodes[0].id);
                setPayerMemberId(newData.payerMemberId ?? null);
                setShowUnpaidOnly(!!newData.showUnpaidOnly);
                setRightTab(newData.rightTab || "overview");
                setLastUpdateTime(newData.lastUpdate);
              }
            });
            
            unsubscribeRef.current = () => {
              unsubscribe();
              crossTabUnsub();
            };
            
            setIsLoaded(true);
            setIsDataLoading(false);
            hideNotification();
            // Show notification that shared sheet can be edited
            setTimeout(() => {
              showNotification('success', '✅ Bạn có thể chỉnh sửa sheet được chia sẻ này!', 4000);
            }, 1000);
            return;
          } catch (e) {
            console.warn("Failed to decode live data:", e);
          }
        } else {
          // No data found - setup collaborative mode
          const liveViewId = "live_view";
          const waitingSheet = {
            ...defaultSheetState("Sheet Live - Cộng tác"),
            billData: { 
              totalAmount: "", 
              discount: "", 
              shipping: ""
            },
            members: [{ 
              id: 1, 
              name: "", 
              originalPrice: "", 
              finalPrice: 0, 
              paid: false 
            }],
          };
          
          setSheetsMap({ [liveViewId]: waitingSheet });
          setActiveSheetId(liveViewId);
          setBillData(waitingSheet.billData);
          setMembers(waitingSheet.members);
          setSelectedQR(waitingSheet.selectedQR);
          setPayerMemberId(waitingSheet.payerMemberId);
          setShowUnpaidOnly(waitingSheet.showUnpaidOnly);
          setRightTab(waitingSheet.rightTab);
          setLiveId(liveParam);
          setIsLiveMode(true);
          
          // Setup subscription to wait for data
          const unsubscribe = syncService.subscribe(liveParam, (newData) => {
            if (newData && (newData.billData || newData.members)) {
              const liveSheet = {
                ...defaultSheetState(newData.name || "Live Sheet"),
                billData: newData.billData || defaultSheetState().billData,
                members: (newData.members || []).map((m) => ({
                  ...m,
                  finalPrice: Number(m.finalPrice) || 0,
                })),
                selectedQR: newData.selectedQR || defaultSheetState().selectedQR,
                payerMemberId: newData.payerMemberId ?? null,
                showUnpaidOnly: !!newData.showUnpaidOnly,
                rightTab: newData.rightTab || "overview",
              };
              
              setSheetsMap({ [liveViewId]: liveSheet });
              setBillData(liveSheet.billData);
              setMembers(liveSheet.members);
              setSelectedQR(liveSheet.selectedQR);
              setPayerMemberId(liveSheet.payerMemberId);
              setShowUnpaidOnly(liveSheet.showUnpaidOnly);
              setRightTab(liveSheet.rightTab);
              setLastUpdateTime(newData.timestamp || Date.now());
              
              // Automatically refresh data without notification
              setIsDataLoading(false);
              hideNotification();
            }
          });
          
          const crossTabUnsub = syncService.setupCrossTabSync(liveParam, (newData) => {
            if (newData && newData.lastUpdate && (newData.billData || newData.members)) {
              const liveSheet = {
                ...defaultSheetState(newData.name || "Live Sheet"),
                billData: newData.billData || defaultSheetState().billData,
                members: (newData.members || []).map((m) => ({
                  ...m,
                  finalPrice: Number(m.finalPrice) || 0,
                })),
                selectedQR: newData.selectedQR || defaultSheetState().selectedQR,
                payerMemberId: newData.payerMemberId ?? null,
                showUnpaidOnly: !!newData.showUnpaidOnly,
                rightTab: newData.rightTab || "overview",
              };
              
              setSheetsMap({ [liveViewId]: liveSheet });
              setBillData(liveSheet.billData);
              setMembers(liveSheet.members);
              setSelectedQR(liveSheet.selectedQR);
              setPayerMemberId(liveSheet.payerMemberId);
              setShowUnpaidOnly(liveSheet.showUnpaidOnly);
              setRightTab(liveSheet.rightTab);
              setLastUpdateTime(newData.lastUpdate);
            }
          });
          
          unsubscribeRef.current = () => {
            unsubscribe();
            crossTabUnsub();
          };
          
          setIsLoaded(true);
          setIsDataLoading(false);
          hideNotification();
          // Show notification for collaborative editing
          setTimeout(() => {
            showNotification('success', '✅ Bạn có thể bắt đầu nhập dữ liệu và cộng tác!', 4000);
          }, 1000);
          return;
        }
      }

      // 3) Check for legacy shared data in URL
      const sharedData = params.get("data");
      if (sharedData) {
        try {
          const decoded = JSON.parse(atob(sharedData));
          const sharedId = "shared_" + Date.now();
          const sharedSheet = {
            ...defaultSheetState(decoded.name || "Shared Sheet"),
            billData: decoded.billData || defaultSheetState().billData,
            members: (decoded.members || []).map((m) => ({
              ...m,
              finalPrice: Number(m.finalPrice) || 0,
            })),
            selectedQR: decoded.selectedQR || defaultSheetState().selectedQR,
            payerMemberId: decoded.payerMemberId ?? null,
            showUnpaidOnly: !!decoded.showUnpaidOnly,
            rightTab: decoded.rightTab || "overview",
          };
          
          setSheetsMap({ [sharedId]: sharedSheet });
          setActiveSheetId(sharedId);
          setBillData(sharedSheet.billData);
          setMembers(sharedSheet.members);
          setSelectedQR(sharedSheet.selectedQR);
          setPayerMemberId(sharedSheet.payerMemberId);
          setShowUnpaidOnly(sharedSheet.showUnpaidOnly);
          setRightTab(sharedSheet.rightTab);
          setIsLoaded(true);
          return;
        } catch (e) {
          console.warn("Failed to decode shared data:", e);
        }
      }

      // 4) Nạp từ localStorage
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
      // Reset unsaved changes after initial load
      setTimeout(() => {
        setHasUnsavedChanges(false);
        setJustSaved(false); // Ensure justSaved is reset
      }, 200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Persist changes per sheet ---------- */
  useEffect(() => {
    if (!isLoaded || !activeSheetId || activeSheetId.startsWith("shared_")) return;
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

  /* ---------- Live sync: update shared data when changes occur ---------- */
  /* AUTO-SYNC DISABLED - Now using manual Save button
  useEffect(() => {
    if (!isLoaded || !isLiveMode || !liveId || activeSheetId === "live_view") return;
    
    const updateTime = Date.now();
    if (updateTime - lastUpdateTime < 1000) return; // Debounce updates
    
    const sheet = sheetsMap[activeSheetId];
    if (!sheet) return;

    const liveData = {
      name: sheet.name,
      billData,
      members,
      selectedQR,
      payerMemberId,
      showUnpaidOnly,
      rightTab,
      liveId,
      lastUpdate: updateTime,
    };

    setSyncStatus('syncing');
    
    try {
      // Publish to real-time sync service
      syncService.publish(liveId, liveData);
      setLastUpdateTime(updateTime);
      setSyncStatus('idle');
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus('error');
      // Fallback to localStorage
      localStorage.setItem(`live_${liveId}`, JSON.stringify(liveData));
    }
  }, [
    billData,
    members,
    selectedQR,
    payerMemberId,
    showUnpaidOnly,
    rightTab,
    isLoaded,
    isLiveMode,
    liveId,
    activeSheetId,
    sheetsMap,
    lastUpdateTime,
  ]);
  */

  /* ---------- Track unsaved changes ---------- */
  useEffect(() => {
    if (!isLoaded || !isLiveMode || justSaved) return;
    
    // Allow changes tracking for live_view mode too (enable editing for shared sheet recipients)
    // Mark as unsaved for changes in live mode
    const timeoutId = setTimeout(() => {
      setHasUnsavedChanges(true);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [billData, members, selectedQR, payerMemberId, showUnpaidOnly, rightTab, isLoaded, isLiveMode, justSaved]);

  /* ---------- Reset justSaved when new changes are detected ---------- */
  useEffect(() => {
    if (justSaved && (hasUnsavedChanges || isLoaded)) {
      // If we detect the user is making new changes, allow unsaved tracking again
      const resetTimer = setTimeout(() => {
        setJustSaved(false);
      }, 2000);
      
      return () => clearTimeout(resetTimer);
    }
  }, [billData, members, selectedQR, payerMemberId, showUnpaidOnly, rightTab, justSaved, hasUnsavedChanges, isLoaded]);

  /* ---------- Cleanup on unmount ---------- */
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

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

  const renameSheet = async () => {
    if (!activeSheetId) return;
    const current = sheetsMap[activeSheetId];
    const name = window.prompt("Đổi tên sheet:", current?.name || "");
    if (!name) return;
    
    // Update local state
    setSheetsMap((prev) => {
      const next = {
        ...prev,
        [activeSheetId]: { ...(prev[activeSheetId] || defaultSheetState()), name },
      };
      localStorage.setItem(STORAGE_SHEETS, JSON.stringify(next));
      return next;
    });

    // Update database if in live mode
    if (isLiveMode && liveId) {
      try {
        const success = await syncService.renameSheet(liveId, name);
        if (success) {
          showNotification('success', '✅ Đã cập nhật tên sheet trong database', 2000);
        } else {
          showNotification('error', '❌ Lỗi cập nhật database (chỉ cập nhật local)', 3000);
        }
      } catch (error) {
        console.error('Rename sheet error:', error);
        showNotification('error', '❌ Lỗi cập nhật database (chỉ cập nhật local)', 3000);
      }
    }
  };

  const deleteSheet = async () => {
    if (!activeSheetId) return;
    const current = sheetsMap[activeSheetId];
    if (!window.confirm(`Xoá sheet "${current?.name}"?`)) return;
    
    // Store the current live ID before deletion
    const currentLiveId = isLiveMode ? liveId : null;
    
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

    // Delete from database if it was a live sheet
    if (currentLiveId) {
      try {
        const success = await syncService.deleteSheet(currentLiveId);
        if (success) {
          showNotification('success', '✅ Đã xóa sheet khỏi database', 2000);
        } else {
          showNotification('error', '❌ Lỗi xóa database (đã xóa local)', 3000);
        }
        
        // Clean up live mode state
        setIsLiveMode(false);
        setLiveId(null);
        setSyncStatus('idle');
        
        // Clean up subscription
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      } catch (error) {
        console.error('Delete sheet error:', error);
        showNotification('error', '❌ Lỗi xóa database (đã xóa local)', 3000);
      }
    }
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

  /* ---------- Manual Save Function ---------- */
  const saveToLive = async () => {
    if (!hasUnsavedChanges) return;
    
    // Allow saving from live_view mode (shared sheet recipients can now edit)
    if (!isLiveMode || !liveId) return;
    
    setIsSaving(true);
    setSyncStatus('syncing');
    
    try {
      // For live_view mode, use the sheet name from current data or a default
      const sheetName = activeSheetId === "live_view" 
        ? (sheetsMap[activeSheetId]?.name || "Live Sheet")
        : (sheetsMap[activeSheetId]?.name || "Live Sheet");
      
      const updateTime = Date.now();
      
      const liveData = {
        name: sheetName,
        billData,
        members,
        selectedQR,
        payerMemberId,
        showUnpaidOnly,
        rightTab,
        liveId,
        lastUpdate: updateTime,
      };

      // Use optimized update method instead of publish
      const success = await syncService.updateSheet(liveId, liveData);
      
      if (success) {
        setLastUpdateTime(updateTime);
        setJustSaved(true); // Prevent immediate unsaved marking
        setHasUnsavedChanges(false); // This will hide the save button
        setSyncStatus('idle');
        showNotification('success', '✅ Đã lưu thay đổi', 2000);
        
        // Reset justSaved flag after a short delay
        setTimeout(() => {
          setJustSaved(false);
        }, 1000);
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      console.error('Save failed:', error);
      setSyncStatus('error');
      showNotification('error', '❌ Lỗi lưu dữ liệu', 3000);
      // Fallback to localStorage
      const liveData = {
        name: activeSheetId === "live_view" 
          ? (sheetsMap[activeSheetId]?.name || "Live Sheet")
          : (sheetsMap[activeSheetId]?.name || "Live Sheet"),
        billData,
        members,
        selectedQR,
        payerMemberId,
        showUnpaidOnly,
        rightTab,
        liveId,
        lastUpdate: Date.now(),
      };
      localStorage.setItem(`live_${liveId}`, JSON.stringify(liveData));
      setJustSaved(true); // Prevent immediate unsaved marking
      setHasUnsavedChanges(false); // This will hide the save button
      
      // Reset justSaved flag after a short delay
      setTimeout(() => {
        setJustSaved(false);
      }, 1000);
    } finally {
      setIsSaving(false);
    }
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
      showNotification('success', '📋 Đã sao chép nội dung', 2000);
    } catch {
      showNotification('error', '❌ Không thể sao chép. Hãy thử trên HTTPS', 3000);
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

  /* ---------- Sharing functions ---------- */
  const shareSheet = async () => {
    try {
      const sheet = sheetsMap[activeSheetId];
    if (!sheet) {
      showNotification('error', '⚠️ Chưa chọn sheet', 2000);
      return;
    }

      // Generate a unique live ID for this sheet
      const newLiveId = "live_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      
      const shareData = {
        name: sheet.name,
        billData,
        members,
        selectedQR,
        payerMemberId,
        showUnpaidOnly,
        rightTab,
        liveId: newLiveId,
        lastUpdate: Date.now(),
      };

      // Use optimized update method for initial creation
      setSyncStatus('syncing');
      try {
        const success = await syncService.updateSheet(newLiveId, shareData);
        if (success) {
          setSyncStatus('idle');
          showNotification('success', '✅ Đã tạo sheet trong database', 2000);
        } else {
          throw new Error('Database creation failed');
        }
      } catch (error) {
        console.error('Database creation failed:', error);
        setSyncStatus('error');
        // Fallback to localStorage
        localStorage.setItem(`live_${newLiveId}`, JSON.stringify(shareData));
        showNotification('warning', '⚠️ Dùng localStorage (demo mode)', 2000);
      }
      
      const url = `${window.location.origin}${window.location.pathname}?live=${newLiveId}`;
      
      await navigator.clipboard.writeText(url);
      showNotification('success', '🔗 Đã copy link chia sẻ!', 3000);
      
      // Enable live mode for current user
      setLiveId(newLiveId);
      setIsLiveMode(true);
    } catch (err) {
      console.error("Share failed:", err);
      setSyncStatus('error');
      showNotification('error', '❌ Không thể chia sẻ: ' + (err?.message || err), 4000);
    }
  };

  const stopLiveSharing = async () => {
    if (liveId) {
      // Clean up subscription
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      
      // Remove from database
      try {
        const success = await syncService.deleteSheet(liveId);
        if (success) {
          showNotification('success', '✅ Đã tắt chia sẻ và xóa khỏi database', 2000);
        } else {
          showNotification('warning', '⚠️ Đã tắt chia sẻ (lỗi xóa database)', 2000);
        }
      } catch (error) {
        console.error('Error cleaning up database:', error);
        showNotification('warning', '⚠️ Đã tắt chia sẻ (lỗi xóa database)', 2000);
      }
      
      // Remove live data from localStorage
      localStorage.removeItem(`live_${liveId}`);
      localStorage.removeItem(`sync_${liveId}`);
      
      setIsLiveMode(false);
      setLiveId(null);
      setSyncStatus('idle');
    }
  };

  /* ================= UI ================= */
  return (
    <div className="app">
      {/* Data Loading Overlay */}
      {isDataLoading && (
        <div className="data-loading-overlay">
          <div className="data-loading-content">
            <div className="loading-spinner"></div>
            <div>Đang tải dữ liệu chia sẻ...</div>
          </div>
        </div>
      )}

      {/* Notification System */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <div className="notification-content">
            <span>{notification.message}</span>
            {notification.type !== 'loading' && (
              <button onClick={hideNotification} className="notification-close">×</button>
            )}
          </div>
          {notification.type === 'loading' && (
            <div className="loading-bar">
              <div className="loading-progress"></div>
            </div>
          )}
        </div>
      )}

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
            <Copy size={16} /> Copy tóm tắt
          </button>
          <button className="ghost" onClick={shareSheet} disabled={syncStatus === 'syncing'}>
            <Share2 size={16} /> 
            {syncStatus === 'syncing' ? 'Đang sync...' : 'Chia sẻ live'}
            {!isOnline && <WifiOff size={14} style={{ marginLeft: '4px', color: '#ef4444' }} />}
          </button>
          
          {/* Save Button - Only show when there are unsaved changes */}
          {hasUnsavedChanges && isLiveMode && (
            <button 
              className="primary"
              onClick={saveToLive} 
              disabled={isSaving}
              style={{ 
                backgroundColor: '#22c55e',
                color: 'white',
                fontWeight: 'bold'
              }}
            >
              {isSaving ? '💾 Đang lưu...' : '💾 Lưu thay đổi'}
            </button>
          )}
          
          {isLiveMode && activeSheetId !== "live_view" && (
            <button className="danger" onClick={stopLiveSharing}>
              Tắt live
            </button>
          )}
        </div>
      </header>

      <main className="shell">
        <div className="main-grid responsive-grid">
          {/* LEFT */}
          <section className="stack">
            {/* Bill */}
            <div className="card">
              <div className="card-header">
                <Calculator className="card-icon" />
                <h2>
                  Thông tin đơn hàng — {sheetsMap[activeSheetId]?.name || ""}
                  {activeSheetId.startsWith("shared_") ? " (chia sẻ)" : ""}
                  {activeSheetId === "live_view" ? " (live 🔴 - có thể chỉnh sửa)" : ""}
                  {isLiveMode && activeSheetId !== "live_view" ? " (đang chia sẻ live ⚡)" : ""}
                  {isLiveMode && (
                    <span style={{ marginLeft: '8px', fontSize: '12px' }}>
                      {isOnline ? <Wifi size={14} style={{ color: '#22c55e' }} /> : <WifiOff size={14} style={{ color: '#ef4444' }} />}
                      {syncStatus === 'syncing' && " ⏳"}
                      {syncStatus === 'error' && " ❌"}
                    </span>
                  )}
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
                            <CheckCircle size={14} />
                          ) : (
                            <CreditCard size={14} />
                          )}
                        </button>
                        <button
                          className="btn-remove"
                          onClick={() => removeMember(m.id)}
                          disabled={members.length === 1}
                          title="Xóa thành viên"
                        >
                          <Minus size={14} />
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
                        <button
                          className="primary"
                          onClick={() => setShowQR(!showQR)}
                        >
                          {showQR ? <EyeOff size={14} /> : <Eye size={14} />}
                          {showQR ? 'Ẩn QR' : 'Hiện QR'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Khung QR */}
                  {showQR && (
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
                  )}

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
                              className="btn-remove-small"
                              onClick={() => removeCustomQR(q.id)}
                              title="Xóa QR"
                            >
                              <X size={10} />
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
