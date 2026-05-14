import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBEdataNVwjVShvSjRWXpHAOkLTAvtYKEc",
  authDomain: "baking-inventory-a6955.firebaseapp.com",
  projectId: "baking-inventory-a6955",
  storageBucket: "baking-inventory-a6955.firebasestorage.app",
  messagingSenderId: "743396766798",
  appId: "1:743396766798:web:1f3b1e7c0061c00d587f1f"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const UNITS = ["g", "kg", "ml", "L", "개", "tsp", "tbsp", "컵"];

const EMOJI_PALETTE = [
  "🌾","🍬","🥛","🥚","🫧","🌿","🌰","📦","🍫","🍋","🫐","🍓",
  "🧂","🧈","🍯","🥜","🌸","🍵","☕","🧁","🎂","🍰","🫙","❄️",
  "🔴","🟠","🟡","🟢","🔵","🟣","⚪","⚫",
];

const DEFAULT_COLORS = [
  "#c8a882","#e8b4b8","#f5deb3","#f0d080",
  "#a8d8b9","#d4a8c8","#c4a882","#b8c8d8",
  "#f4b8a0","#b8d4f0","#d0e8b8","#e8d0f0",
];

const DEFAULT_CATEGORIES = [
  { name: "밀가루류",      icon: "🌾", color: "#c8a882" },
  { name: "당류",          icon: "🍬", color: "#e8b4b8" },
  { name: "유제품",        icon: "🥛", color: "#f5deb3" },
  { name: "달걀/유지",    icon: "🥚", color: "#f0d080" },
  { name: "팽창제",        icon: "🫧", color: "#a8d8b9" },
  { name: "향신료",        icon: "🌿", color: "#d4a8c8" },
  { name: "초콜릿류",      icon: "🍫", color: "#c8906a" },
  { name: "견과류/건과일", icon: "🌰", color: "#c4a882" },
  { name: "기타",          icon: "📦", color: "#b8c8d8" },
];

const DEFAULT_ITEMS = [];

const STATUS_CONFIG = {
  ok:      { label: "정상",      color: "#6dbb8a", bg: "#f0faf4" },
  low:     { label: "부족",      color: "#e07b54", bg: "#fff4f0" },
  expiring:{ label: "임박",      color: "#e0a854", bg: "#fffbf0" },
  expired: { label: "만료",      color: "#c45c5c", bg: "#fff0f0" },
  unknown: { label: "수량미입력", color: "#9a8878", bg: "#f8f4f0" },
};

export default function BakingInventory() {
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [catForm, setCatForm] = useState({ name: "", icon: "📦", color: "#b8c8d8" });
  const [editCatIdx, setEditCatIdx] = useState(null);
  const [showCatForm, setShowCatForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("전체");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [activeTab, setActiveTab] = useState("재고");
  const [form, setForm] = useState({ name: "", category: "", quantity: "", unit: "g", minStock: "", expiry: "" });
  const [notification, setNotification] = useState(null);

  const [dismissedBanners, setDismissedBanners] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);
  const [shopInput, setShopInput] = useState("");

  // ── Firebase 저장/불러오기 ──────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "baking", "data"));
        if (snap.exists()) {
          const data = snap.data();
          if (data.items) setItems(data.items);
          if (data.categories) {
            const parsed = data.categories;
            if (Array.isArray(parsed) && typeof parsed[0] === "string") {
              setCategories(parsed.map(name => DEFAULT_CATEGORIES.find(c => c.name === name) || { name, icon: "📦", color: "#b8c8d8" }));
            } else { setCategories(parsed); }
          }
          if (data.shoppingList) setShoppingList(data.shoppingList);
        }
      } catch (e) { console.error("불러오기 실패:", e); }
      setLoaded(true);
    })();
  }, []);

  const saveToFirebase = async (newItems, newCats, newShopping) => {
    try {
      await setDoc(doc(db, "baking", "data"), {
        items: newItems,
        categories: newCats,
        shoppingList: newShopping,
      });
    } catch (e) { console.error("저장 실패:", e); }
  };

  useEffect(() => { if (!loaded) return; saveToFirebase(items, categories, shoppingList); }, [items, loaded]);
  useEffect(() => { if (!loaded) return; saveToFirebase(items, categories, shoppingList); }, [categories, loaded]);
  useEffect(() => { if (!loaded) return; saveToFirebase(items, categories, shoppingList); }, [shoppingList, loaded]);

  // ── 헬퍼 ──────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const getCatObj = (name) => categories.find(c => c.name === name) || { name, icon: "📦", color: "#b8c8d8" };
  const showNotif = (msg, type = "success") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 2500); };

  const getStatus = (item) => {
    const daysLeft = Math.ceil((new Date(item.expiry) - today) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) return "expired";
    if (daysLeft <= 7) return "expiring";
    if (item.quantity === null) return "unknown";
    if ((item.minStock ?? 0) > 0 && item.quantity <= item.minStock) return "low";
    return "ok";
  };

  const filtered = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "전체" || item.category === filterCategory;
    const matchStatus = filterStatus === "전체" || getStatus(item) === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const alerts = items.filter(i => ["low","expiring","expired","unknown"].includes(getStatus(i)));
  const urgentAlerts = items.filter(i => ["expiring","expired"].includes(getStatus(i)));

  // ── 재료 CRUD ─────────────────────────────────────────────
  const openAdd = () => {
    setEditItem(null);
    setForm({ name: "", category: categories[0]?.name || "기타", quantity: "", unit: "g", minStock: "", expiry: "" });
    setShowModal(true);
  };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({ name: item.name, category: item.category, quantity: item.quantity === null ? "" : item.quantity, unit: item.unit, minStock: item.minStock, expiry: item.expiry });
    setShowModal(true);
  };
  const handleSave = () => {
    if (!form.name || !form.expiry) { showNotif("재료명과 유통기한은 필수입니다.", "error"); return; }
    const qty = form.quantity === "" ? null : Number(form.quantity);
    if (editItem) {
      setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, ...form, quantity: qty, minStock: Number(form.minStock) } : i));
      showNotif(`'${form.name}' 수정 완료!`);
    } else {
      setItems(prev => [...prev, { id: Date.now(), ...form, quantity: qty, minStock: Number(form.minStock) }]);
      showNotif(`'${form.name}' 추가 완료!`);
    }
    setShowModal(false);
  };
  const handleDelete = (id, name) => { setItems(prev => prev.filter(i => i.id !== id)); showNotif(`'${name}' 삭제됨`, "error"); };

  // ── 카테고리 CRUD ─────────────────────────────────────────
  const saveCat = () => {
    const trimmed = catForm.name.trim();
    if (!trimmed) { showNotif("카테고리명을 입력해주세요.", "error"); return; }
    if (editCatIdx === null) {
      if (categories.find(c => c.name === trimmed)) { showNotif("이미 있는 카테고리예요.", "error"); return; }
      setCategories(prev => [...prev, { ...catForm, name: trimmed }]);
      showNotif(`'${trimmed}' 추가 완료!`);
    } else {
      const oldName = categories[editCatIdx].name;
      setCategories(prev => prev.map((c, i) => i === editCatIdx ? { ...catForm, name: trimmed } : c));
      if (oldName !== trimmed) setItems(prev => prev.map(item => item.category === oldName ? { ...item, category: trimmed } : item));
      showNotif("카테고리 수정 완료!");
    }
    setShowCatForm(false);
    setEditCatIdx(null);
  };

  // ── 로딩 화면 ─────────────────────────────────────────────
  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: "#fdf8f3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🥐</div>
      <div style={{ fontSize: 14, color: "#9a8878" }}>재고 불러오는 중...</div>
    </div>
  );

  // ── 렌더 ──────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#fdf8f3", fontFamily: "'Noto Sans KR', sans-serif", color: "#3a2e24" }}>

      {/* 알림 토스트 */}
      {notification && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: notification.type === "error" ? "#c45c5c" : "#6dbb8a", color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "fadeIn 0.3s ease" }}>
          {notification.msg}
        </div>
      )}

      {/* 헤더 */}
      <div style={{ background: "linear-gradient(135deg, #3a2e24 0%, #5c4a36 100%)", padding: "28px 20px 20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 28 }}>🥐</span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#f5ede0" }}>베이킹 재고 관리</div>
            <div style={{ fontSize: 11, color: "#c4a882", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
              {todayStr}
              <span style={{ background: "#6dbb8a44", color: "#a8e8b8", fontSize: 10, padding: "1px 7px", borderRadius: 8, fontWeight: 600 }}>💾 자동저장</span>
            </div>
          </div>
        </div>

        {/* 유통기한 임박 긴급 배너 (확인하면 다시 안 뜸) */}
        {urgentAlerts.filter(item => !dismissedBanners.includes(item.id)).map(item => {
          const daysLeft = Math.ceil((new Date(item.expiry) - today) / (1000 * 60 * 60 * 24));
          return (
            <div key={item.id} style={{ background: "#c45c5c22", border: "1px solid #c45c5c66", borderRadius: 10, padding: "10px 14px", marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#ffbcbc", fontWeight: 700 }}>⚡ 긴급 사용 필요</div>
                <div style={{ fontSize: 12, color: "#ffeaea", marginTop: 2 }}>
                  {item.name} — {daysLeft > 0 ? `${daysLeft}일 남음` : "오늘 만료!"}
                </div>
              </div>
              <button onClick={() => setDismissedBanners(prev => [...prev, item.id])}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#ffeaea", borderRadius: 7, padding: "5px 10px", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", marginLeft: 10 }}>
                확인 ✕
              </button>
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          {[
            { label: "전체 재료", value: items.length, icon: "📦" },
            { label: "긴급/만료", value: urgentAlerts.length, icon: "⚡" },
            { label: "수량미입력", value: items.filter(i => i.quantity === null).length, icon: "✏️" },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 16 }}>{s.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f5ede0" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#c4a882" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", background: "#fff", borderBottom: "2px solid #f0e8de" }}>
        {["재고", "알림", "쇼핑", "카테고리"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: "13px 0", border: "none", cursor: "pointer",
            background: activeTab === tab ? "#fdf8f3" : "#fff",
            color: activeTab === tab ? "#5c4a36" : "#9a8878",
            fontWeight: activeTab === tab ? 700 : 400, fontSize: 13,
            borderBottom: activeTab === tab ? "2px solid #c8a882" : "2px solid transparent",
            marginBottom: -2, fontFamily: "inherit",
          }}>
            {tab}
            {tab === "알림" && alerts.length > 0 && (
              <span style={{ background: "#e07b54", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 11, marginLeft: 4 }}>{alerts.length}</span>
            )}
            {tab === "쇼핑" && shoppingList.filter(i => !i.done).length > 0 && (
              <span style={{ background: "#6dbb8a", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 11, marginLeft: 4 }}>{shoppingList.filter(i => !i.done).length}</span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div style={{ padding: "14px 14px 120px" }}>

        {/* ── 재고 탭 ── */}
        {activeTab === "재고" && (
          <>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  재료 검색..."
              style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: "1.5px solid #e8ddd4", fontSize: 14, background: "#fff", fontFamily: "inherit", boxSizing: "border-box", outline: "none", color: "#3a2e24", marginBottom: 12 }} />

            <div style={{ display: "flex", gap: 7, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
              {[{ name: "전체", icon: "" }, ...categories].map(cat => (
                <button key={cat.name} onClick={() => setFilterCategory(cat.name)} style={{
                  whiteSpace: "nowrap", padding: "5px 12px", borderRadius: 20,
                  border: filterCategory === cat.name ? "2px solid #c8a882" : "1.5px solid #e8ddd4",
                  background: filterCategory === cat.name ? "#5c4a36" : "#fff",
                  color: filterCategory === cat.name ? "#f5ede0" : "#7a6858",
                  fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  {cat.icon && <span>{cat.icon}</span>}{cat.name}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
              {["전체", "ok", "low", "expiring", "expired", "unknown"].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{
                  padding: "5px 11px", borderRadius: 16,
                  border: filterStatus === s ? "2px solid #c8a882" : "1.5px solid #e8ddd4",
                  background: filterStatus === s ? (s === "전체" ? "#5c4a36" : STATUS_CONFIG[s]?.color) : "#fff",
                  color: filterStatus === s ? "#fff" : "#7a6858",
                  fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
                }}>
                  {s === "전체" ? "전체" : STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: "#b0a090", fontSize: 14 }}>검색 결과가 없습니다</div>}
              {filtered.map(item => {
                const st = getStatus(item);
                const cfg = STATUS_CONFIG[st];
                const catObj = getCatObj(item.category);
                const pct = item.quantity !== null && item.minStock > 0 ? Math.min(100, Math.round((item.quantity / (item.minStock * 3)) * 100)) : null;
                const daysLeft = Math.ceil((new Date(item.expiry) - today) / (1000 * 60 * 60 * 24));
                return (
                  <div key={item.id} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", boxShadow: "0 2px 12px rgba(58,46,36,0.06)", borderLeft: `4px solid ${catObj.color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 16 }}>{catObj.icon}</span>
                          <span style={{ fontWeight: 700, fontSize: 14, color: "#3a2e24" }}>{item.name}</span>
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: cfg.bg, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#9a8878", marginTop: 3 }}>{item.category}</div>
                      </div>
                      <div style={{ textAlign: "right", minWidth: 70 }}>
                        {item.quantity !== null
                          ? <div style={{ fontWeight: 700, fontSize: 15, color: "#5c4a36" }}>{item.quantity}<span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2 }}>{item.unit}</span></div>
                          : <div style={{ fontSize: 12, color: "#c8a882", fontStyle: "italic" }}>미입력</div>}
                        {item.minStock > 0 && <div style={{ fontSize: 10, color: "#9a8878" }}>최소 {item.minStock}{item.unit}</div>}
                      </div>
                    </div>
                    {pct !== null && (
                      <div style={{ margin: "10px 0 6px", height: 4, background: "#f0e8de", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: st === "ok" ? "#6dbb8a" : st === "low" ? "#e07b54" : "#e0a854" }} />
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: pct === null ? 10 : 2 }}>
                      <div style={{ fontSize: 10, color: daysLeft <= 7 ? "#c45c5c" : "#9a8878" }}>
                        {item.expiry} ({daysLeft > 0 ? `${daysLeft}일 남음` : "만료됨"})
                      </div>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button onClick={() => openEdit(item)} style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #e8ddd4", background: "#fdf8f3", color: "#7a6858", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>수정</button>
                        <button onClick={() => handleDelete(item.id, item.name)} style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #f5d0c8", background: "#fff8f6", color: "#c45c5c", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>삭제</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── 알림 탭 ── */}
        {activeTab === "알림" && (
          <div>
            {alerts.length === 0
              ? <div style={{ textAlign: "center", padding: "60px 0" }}><div style={{ fontSize: 48, marginBottom: 12 }}>✨</div><div style={{ fontSize: 16, color: "#6dbb8a", fontWeight: 600 }}>모든 재료가 정상입니다!</div></div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { type: "expired",  title: "⛔ 만료된 재료" },
                    { type: "expiring", title: "⚡ 유통기한 임박 (7일 이내)" },
                    { type: "low",      title: "📉 재고 부족" },
                    { type: "unknown",  title: "✏️ 수량 미입력" },
                  ].map(({ type, title }) => {
                    const group = alerts.filter(i => getStatus(i) === type);
                    if (!group.length) return null;
                    const cfg = STATUS_CONFIG[type];
                    return (
                      <div key={type}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: cfg.color, marginBottom: 8, marginTop: 4 }}>{title}</div>
                        {group.map(item => {
                          const daysLeft = Math.ceil((new Date(item.expiry) - today) / (1000 * 60 * 60 * 24));
                          return (
                            <div key={item.id} style={{ background: cfg.bg, borderRadius: 12, padding: "11px 13px", border: `1.5px solid ${cfg.color}30`, marginBottom: 7 }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{item.quantity !== null ? `${item.quantity}${item.unit}` : "미입력"}</span>
                              </div>
                              <div style={{ fontSize: 11, color: "#9a8878", marginTop: 3 }}>
                                {type === "unknown" ? "수정 버튼에서 수량을 입력해주세요"
                                 : type === "low" ? `최소 재고: ${item.minStock}${item.unit}`
                                 : `유통기한: ${item.expiry} (${daysLeft > 0 ? `${daysLeft}일 남음` : "만료"})`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        )}

        {/* ── 쇼핑 탭 ── */}
        {activeTab === "쇼핑" && (() => {
          const lowItems = items.filter(i => getStatus(i) === "low");
          const addItem = (name, auto = false) => {
            if (!name.trim()) return;
            if (shoppingList.find(i => i.name === name.trim() && !i.done)) return;
            setShoppingList(prev => [...prev, { id: Date.now(), name: name.trim(), done: false, auto }]);
          };
          const toggle = (id) => setShoppingList(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
          const remove = (id) => setShoppingList(prev => prev.filter(i => i.id !== id));
          const clearDone = () => setShoppingList(prev => prev.filter(i => !i.done));
          const pending = shoppingList.filter(i => !i.done);
          const done = shoppingList.filter(i => i.done);

          return (
            <div>
              {/* 직접 입력 */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input value={shopInput} onChange={e => setShopInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { addItem(shopInput); setShopInput(""); } }}
                  placeholder="살 재료 입력..."
                  style={{ flex: 1, padding: "11px 13px", borderRadius: 10, border: "1.5px solid #e8ddd4", fontSize: 14, background: "#fff", fontFamily: "inherit", outline: "none", color: "#3a2e24" }} />
                <button onClick={() => { addItem(shopInput); setShopInput(""); }}
                  style={{ padding: "0 16px", borderRadius: 10, border: "none", background: "#5c4a36", color: "#f5ede0", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>추가</button>
              </div>

              {/* 재고 부족 자동 추천 */}
              {lowItems.length > 0 && (
                <div style={{ background: "#fff8f4", borderRadius: 12, padding: "12px 14px", marginBottom: 16, border: "1.5px solid #f0ddd4" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e07b54", marginBottom: 8 }}>📉 재고 부족 — 빠르게 추가</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {lowItems.map(item => {
                      const already = shoppingList.find(i => i.name === item.name && !i.done);
                      return (
                        <button key={item.id} onClick={() => addItem(item.name, true)}
                          disabled={!!already}
                          style={{ padding: "5px 12px", borderRadius: 16, border: "1.5px solid #e8ddd4", background: already ? "#f0f0f0" : "#fff", color: already ? "#b0a090" : "#5c4a36", fontSize: 12, cursor: already ? "default" : "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                          {already ? "✓ " : "+ "}{item.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 목록 */}
              {shoppingList.length === 0
                ? <div style={{ textAlign: "center", padding: "50px 0", color: "#b0a090", fontSize: 14 }}>🛒 살 재료를 추가해보세요!</div>
                : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {pending.map(item => (
                      <div key={item.id} style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", boxShadow: "0 2px 8px rgba(58,46,36,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
                        <button onClick={() => toggle(item.id)} style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #c8a882", background: "#fff", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }} />
                        <span style={{ flex: 1, fontSize: 14, color: "#3a2e24", fontWeight: 500 }}>{item.name}</span>
                        {item.auto && <span style={{ fontSize: 10, color: "#e07b54", background: "#fff4f0", padding: "2px 7px", borderRadius: 8, fontWeight: 600 }}>부족</span>}
                        <button onClick={() => remove(item.id)} style={{ color: "#c8b8a8", background: "none", border: "none", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
                      </div>
                    ))}

                    {done.length > 0 && (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                          <div style={{ fontSize: 12, color: "#b0a090", fontWeight: 600 }}>완료 {done.length}개</div>
                          <button onClick={clearDone} style={{ fontSize: 11, color: "#c45c5c", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>전체 삭제</button>
                        </div>
                        {done.map(item => (
                          <div key={item.id} style={{ background: "#f8f8f8", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, opacity: 0.6 }}>
                            <button onClick={() => toggle(item.id)} style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: "#6dbb8a", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13 }}>✓</button>
                            <span style={{ flex: 1, fontSize: 14, color: "#9a8878", textDecoration: "line-through" }}>{item.name}</span>
                            <button onClick={() => remove(item.id)} style={{ color: "#c8b8a8", background: "none", border: "none", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
              }
            </div>
          );
        })()}

        {/* ── 카테고리 탭 ── */}
        {activeTab === "카테고리" && (
          <div>
            {showCatForm ? (
              <div style={{ background: "#fff", borderRadius: 14, padding: "16px", boxShadow: "0 2px 12px rgba(58,46,36,0.08)", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#5c4a36", marginBottom: 12 }}>
                  {editCatIdx === null ? "새 카테고리" : "카테고리 수정"}
                </div>
                {/* 미리보기 */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fdf8f3", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: catForm.color + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{catForm.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#3a2e24" }}>{catForm.name || "카테고리명"}</div>
                </div>
                {/* 이름 */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#7a6858", marginBottom: 5 }}>카테고리명</div>
                  <input value={catForm.name} onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))} placeholder="예: 초콜릿류"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e8ddd4", fontSize: 14, background: "#fdf8f3", fontFamily: "inherit", color: "#3a2e24", outline: "none", boxSizing: "border-box" }} />
                </div>
                {/* 이모티콘 */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#7a6858", marginBottom: 6 }}>이모티콘</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {EMOJI_PALETTE.map(e => (
                      <button key={e} onClick={() => setCatForm(p => ({ ...p, icon: e }))} style={{
                        width: 36, height: 36, borderRadius: 8, fontSize: 18,
                        border: catForm.icon === e ? "2px solid #5c4a36" : "1.5px solid #e8ddd4",
                        background: catForm.icon === e ? "#f0e8de" : "#fff",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{e}</button>
                    ))}
                  </div>
                </div>
                {/* 색상 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#7a6858", marginBottom: 6 }}>색상</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {DEFAULT_COLORS.map(c => (
                      <button key={c} onClick={() => setCatForm(p => ({ ...p, color: c }))} style={{
                        width: 28, height: 28, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                        outline: catForm.color === c ? "3px solid #5c4a36" : "none", outlineOffset: 2,
                      }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setShowCatForm(false); setEditCatIdx(null); }} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1.5px solid #e8ddd4", background: "#fff", color: "#7a6858", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>취소</button>
                  <button onClick={saveCat} style={{ flex: 2, padding: "11px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #5c4a36, #3a2e24)", color: "#f5ede0", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>저장</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setCatForm({ name: "", icon: "📦", color: "#b8c8d8" }); setEditCatIdx(null); setShowCatForm(true); }}
                style={{ width: "100%", padding: "13px", borderRadius: 12, border: "2px dashed #c8a882", background: "#fdf8f3", color: "#8a7060", fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, marginBottom: 12 }}>
                + 새 카테고리 추가
              </button>
            )}

            {!showCatForm && <div style={{ fontSize: 11, color: "#b0a090", textAlign: "center", marginBottom: 10 }}>☰ 드래그로 순서 변경 &nbsp;|&nbsp; ✏️ 수정 버튼으로 이모티콘 변경</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {categories.map((cat, idx) => {
                const count = items.filter(i => i.category === cat.name).length;
                const alertCount = items.filter(i => i.category === cat.name && ["low","expiring","expired","unknown"].includes(getStatus(i))).length;
                return (
                  <div key={cat.name} draggable
                    onDragStart={e => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(idx)); }}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.opacity = "0.5"; }}
                    onDragLeave={e => { e.currentTarget.style.opacity = "1"; }}
                    onDrop={e => {
                      e.preventDefault(); e.currentTarget.style.opacity = "1";
                      const from = parseInt(e.dataTransfer.getData("text/plain"));
                      if (from === idx) return;
                      setCategories(prev => { const next = [...prev]; const [m] = next.splice(from, 1); next.splice(idx, 0, m); return next; });
                    }}
                    onDragEnd={e => { e.currentTarget.style.opacity = "1"; }}
                    style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", boxShadow: "0 2px 10px rgba(58,46,36,0.06)", borderLeft: `4px solid ${cat.color}`, display: "flex", alignItems: "center", gap: 11, cursor: "grab", userSelect: "none" }}
                  >
                    <div style={{ color: "#c8b8a8", fontSize: 16, flexShrink: 0 }}>☰</div>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: cat.color + "35", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cat.icon}</div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#3a2e24" }}>{cat.name}</div>
                      <div style={{ fontSize: 11, color: "#9a8878", marginTop: 1 }}>재료 {count}종</div>
                    </div>
                    {alertCount > 0 && <div style={{ background: "#e07b54", color: "#fff", borderRadius: 10, padding: "2px 9px", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>주의 {alertCount}</div>}
                    <button onClick={() => { setCatForm({ name: cat.name, icon: cat.icon, color: cat.color }); setEditCatIdx(idx); setShowCatForm(true); }}
                      style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #e8ddd4", background: "#fdf8f3", color: "#7a6858", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>수정</button>
                    {count === 0 && (
                      <button onClick={() => { setCategories(prev => prev.filter((_, i) => i !== idx)); showNotif(`'${cat.name}' 삭제됨`, "error"); }}
                        style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #f5d0c8", background: "#fff8f6", color: "#c45c5c", fontSize: 11, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>삭제</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={openAdd} style={{
        position: "fixed", bottom: 24, right: 20, width: 54, height: 54,
        borderRadius: "50%", background: "linear-gradient(135deg, #5c4a36, #3a2e24)",
        color: "#f5ede0", fontSize: 26, border: "none", cursor: "pointer",
        boxShadow: "0 4px 20px rgba(58,46,36,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      }}>+</button>

      {/* 재료 추가/수정 모달 */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(58,46,36,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-end" }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={{ background: "#fdf8f3", borderRadius: "20px 20px 0 0", width: "100%", padding: "24px 20px 40px", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 18, color: "#3a2e24" }}>
              {editItem ? "재료 수정" : "새 재료 추가"}
            </div>
            {[
              { label: "재료명 *", key: "name", type: "text", placeholder: "예: 박력분" },
              { label: "수량 (모르면 빈칸)", key: "quantity", type: "number", placeholder: "예: 500" },
              { label: "최소 재고", key: "minStock", type: "number", placeholder: "예: 200" },
              { label: "유통기한 *", key: "expiry", type: "date" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 13 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#7a6858", marginBottom: 4 }}>{f.label}</div>
                <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e8ddd4", fontSize: 14, background: "#fff", fontFamily: "inherit", boxSizing: "border-box", color: "#3a2e24", outline: "none" }} />
              </div>
            ))}
            <div style={{ marginBottom: 13 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#7a6858", marginBottom: 4 }}>카테고리</div>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e8ddd4", fontSize: 14, background: "#fff", fontFamily: "inherit", color: "#3a2e24", outline: "none" }}>
                {categories.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
              </select>
              <div style={{ fontSize: 11, color: "#b0a090", marginTop: 4 }}>카테고리 관리는 '카테고리' 탭에서 하세요</div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#7a6858", marginBottom: 6 }}>단위</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {UNITS.map(u => (
                  <button key={u} onClick={() => setForm(p => ({ ...p, unit: u }))} style={{
                    padding: "6px 13px", borderRadius: 8,
                    border: form.unit === u ? "2px solid #c8a882" : "1.5px solid #e8ddd4",
                    background: form.unit === u ? "#5c4a36" : "#fff",
                    color: form.unit === u ? "#f5ede0" : "#7a6858",
                    fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  }}>{u}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #e8ddd4", background: "#fff", color: "#7a6858", fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>취소</button>
              <button onClick={handleSave} style={{ flex: 2, padding: "13px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #5c4a36, #3a2e24)", color: "#f5ede0", fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>저장</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap'); @keyframes fadeIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}
