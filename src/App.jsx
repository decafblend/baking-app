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
const EMOJI_PALETTE = ["🌾","🍬","🥛","🥚","🫧","🌿","🌰","📦","🍫","🍋","🫐","🍓","🧂","🧈","🍯","🥜","🌸","🍵","☕","🧁","🎂","🍰","🫙","❄️","🔴","🟠","🟡","🟢","🔵","🟣","⚪","⚫"];
const DEFAULT_COLORS = ["#d4a8a8","#d4c4a8","#a8c4a8","#a8b8d4","#c4a8d4","#a8d4c4","#d4b8a8","#b8b8b8","#d4d4a8","#a8d4d4","#d4a8c4","#c4d4a8"];
const DEFAULT_CATEGORIES = [
  { name: "밀가루류",      icon: "🌾", color: "#d4c4a8" },
  { name: "당류",          icon: "🍬", color: "#d4a8a8" },
  { name: "유제품",        icon: "🥛", color: "#a8c4d4" },
  { name: "달걀/유지",    icon: "🥚", color: "#d4d4a8" },
  { name: "팽창제",        icon: "🫧", color: "#a8c4a8" },
  { name: "향신료",        icon: "🌿", color: "#c4a8d4" },
  { name: "초콜릿류",      icon: "🍫", color: "#d4b8a8" },
  { name: "견과류/건과일", icon: "🌰", color: "#c4b8a8" },
  { name: "기타",          icon: "📦", color: "#b8b8b8" },
];
const DEFAULT_ITEMS = [];
const STATUS_CONFIG = {
  ok:      { label: "정상",      color: "#4caf7d", bg: "#f0faf4", dot: "#4caf7d" },
  low:     { label: "부족",      color: "#e07b54", bg: "#fff4f0", dot: "#e07b54" },
  expiring:{ label: "임박",      color: "#e0a030", bg: "#fffbf0", dot: "#e0a030" },
  expired: { label: "만료",      color: "#e05050", bg: "#fff0f0", dot: "#e05050" },
  unknown: { label: "미입력",    color: "#aaaaaa", bg: "#f8f8f8", dot: "#aaaaaa" },
};

const T = {
  bg: "#ffffff",
  bg2: "#f7f7f5",
  bg3: "#f0efed",
  border: "#e8e6e3",
  border2: "#d8d6d3",
  text: "#1a1a1a",
  text2: "#666666",
  text3: "#999999",
  accent: "#1a1a1a",
  accentText: "#ffffff",
};

const Btn = ({ children, onClick, variant = "default", style = {}, ...rest }) => {
  const base = { fontFamily: "inherit", cursor: "pointer", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, transition: "opacity 0.15s", ...style };
  if (variant === "primary") return <button onClick={onClick} style={{ ...base, background: T.accent, color: T.accentText, padding: "11px 20px", ...style }} {...rest}>{children}</button>;
  if (variant === "ghost") return <button onClick={onClick} style={{ ...base, background: "none", border: `1px solid ${T.border}`, color: T.text2, padding: "9px 16px", ...style }} {...rest}>{children}</button>;
  return <button onClick={onClick} style={{ ...base, background: T.bg3, color: T.text, padding: "9px 16px", ...style }} {...rest}>{children}</button>;
};

export default function BakingInventory() {
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState(DEFAULT_ITEMS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [recipes, setRecipes] = useState([]);
  const [shoppingList, setShoppingList] = useState([]);

  const [activeTab, setActiveTab] = useState("재고");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("전체");
  const [filterStatus, setFilterStatus] = useState("전체");
  const [sortBy, setSortBy] = useState("default");

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", category: "", quantity: "", unit: "g", minStock: "", expiry: "" });

  const [showCatForm, setShowCatForm] = useState(false);
  const [editCatIdx, setEditCatIdx] = useState(null);
  const [catForm, setCatForm] = useState({ name: "", icon: "📦", color: "#b8b8b8" });

  const [bakingMode, setBakingMode] = useState("recipe");
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [recipeForm, setRecipeForm] = useState({ name: "", servings: 1, ingredients: [] });
  const [recipeIngInput, setRecipeIngInput] = useState({ name: "", amount: "", unit: "g" });
  const [manualDeduct, setManualDeduct] = useState([]);

  const [shopInput, setShopInput] = useState("");
  const [dismissedBanners, setDismissedBanners] = useState([]);
  const [notification, setNotification] = useState(null);

  // Firebase
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "baking", "data"));
        if (snap.exists()) {
          const d = snap.data();
          if (d.items) setItems(d.items);
          if (d.categories) {
            const p = d.categories;
            if (Array.isArray(p) && typeof p[0] === "string") setCategories(p.map(n => DEFAULT_CATEGORIES.find(c => c.name === n) || { name: n, icon: "📦", color: "#b8b8b8" }));
            else setCategories(p);
          }
          if (d.shoppingList) setShoppingList(d.shoppingList);
          if (d.recipes) setRecipes(d.recipes);
        }
      } catch (e) { console.error(e); }
      setLoaded(true);
    })();
  }, []);

  const save = async (i, c, s, r) => {
    try { await setDoc(doc(db, "baking", "data"), { items: i, categories: c, shoppingList: s, recipes: r }); } catch (e) { console.error(e); }
  };
  useEffect(() => { if (loaded) save(items, categories, shoppingList, recipes); }, [items, categories, shoppingList, recipes, loaded]);

  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = today.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const getCat = (name) => categories.find(c => c.name === name) || { name, icon: "📦", color: "#b8b8b8" };
  const showNotif = (msg, type = "success") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 2500); };

  const getStatus = (item) => {
    const d = Math.ceil((new Date(item.expiry) - today) / 86400000);
    if (d <= 0) return "expired";
    if (d <= 7) return "expiring";
    if (item.quantity === null) return "unknown";
    if ((item.minStock ?? 0) > 0 && item.quantity <= item.minStock) return "low";
    return "ok";
  };

  const filtered = (() => {
    const base = items.filter(i => {
      const ms = i.name.toLowerCase().includes(search.toLowerCase());
      const mc = filterCategory === "전체" || i.category === filterCategory;
      const mst = filterStatus === "전체" || getStatus(i) === filterStatus;
      return ms && mc && mst;
    });
    if (sortBy === "name") return [...base].sort((a,b) => a.name.localeCompare(b.name,"ko"));
    if (sortBy === "expiry") return [...base].sort((a,b) => new Date(a.expiry)-new Date(b.expiry));
    if (sortBy === "quantity") return [...base].sort((a,b) => (a.quantity??-1)-(b.quantity??-1));
    if (sortBy === "category") return [...base].sort((a,b) => a.category.localeCompare(b.category,"ko"));
    return base;
  })();

  const alerts = items.filter(i => ["low","expiring","expired","unknown"].includes(getStatus(i)));
  const urgentAlerts = items.filter(i => ["expiring","expired"].includes(getStatus(i)));

  const openAdd = () => { setEditItem(null); setForm({ name: "", category: categories[0]?.name || "", quantity: "", unit: "g", minStock: "", expiry: "" }); setShowModal(true); };
  const openEdit = (item) => { setEditItem(item); setForm({ name: item.name, category: item.category, quantity: item.quantity === null ? "" : item.quantity, unit: item.unit, minStock: item.minStock, expiry: item.expiry }); setShowModal(true); };
  const handleSave = () => {
    if (!form.name || !form.expiry) { showNotif("재료명과 유통기한은 필수입니다.", "error"); return; }
    const qty = form.quantity === "" ? null : Number(form.quantity);
    if (editItem) { setItems(p => p.map(i => i.id === editItem.id ? { ...i, ...form, quantity: qty, minStock: Number(form.minStock) } : i)); showNotif(`'${form.name}' 수정 완료`); }
    else { setItems(p => [...p, { id: Date.now(), ...form, quantity: qty, minStock: Number(form.minStock) }]); showNotif(`'${form.name}' 추가 완료`); }
    setShowModal(false);
  };
  const handleDelete = (id, name) => { setItems(p => p.filter(i => i.id !== id)); showNotif(`'${name}' 삭제됨`, "error"); };

  const saveCat = () => {
    const t = catForm.name.trim();
    if (!t) { showNotif("이름을 입력해주세요.", "error"); return; }
    if (editCatIdx === null) {
      if (categories.find(c => c.name === t)) { showNotif("이미 있는 카테고리예요.", "error"); return; }
      setCategories(p => [...p, { ...catForm, name: t }]); showNotif(`'${t}' 추가 완료`);
    } else {
      const old = categories[editCatIdx].name;
      setCategories(p => p.map((c,i) => i === editCatIdx ? { ...catForm, name: t } : c));
      if (old !== t) setItems(p => p.map(i => i.category === old ? { ...i, category: t } : i));
      showNotif("수정 완료");
    }
    setShowCatForm(false); setEditCatIdx(null);
  };

  if (!loaded) return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Noto Sans KR', sans-serif" }}>
      <div style={{ fontSize:36, marginBottom:12 }}>🥐</div>
      <div style={{ fontSize:13, color:T.text3 }}>불러오는 중...</div>
    </div>
  );

  const TABS = ["재고","알림","베이킹","쇼핑","카테고리"];

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"'Noto Sans KR', sans-serif", color:T.text, maxWidth:480, margin:"0 auto" }}>

      {/* 알림 토스트 */}
      {notification && (
        <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", zIndex:9999, background: notification.type==="error" ? "#e05050" : "#1a1a1a", color:"#fff", padding:"10px 20px", borderRadius:24, fontSize:13, fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.15)", whiteSpace:"nowrap" }}>
          {notification.msg}
        </div>
      )}

      {/* 헤더 */}
      <div style={{ padding:"24px 20px 0", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, letterSpacing:"-0.5px" }}>🥐 베이킹 재고</div>
            <div style={{ fontSize:11, color:T.text3, marginTop:3 }}>{todayStr}</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {urgentAlerts.filter(i => !dismissedBanners.includes(i.id)).length > 0 && (
              <div style={{ background:"#fff0f0", border:"1px solid #ffd0d0", borderRadius:20, padding:"5px 12px", fontSize:11, color:"#e05050", fontWeight:600 }}>
                ⚡ {urgentAlerts.filter(i => !dismissedBanners.includes(i.id)).length}개 긴급
              </div>
            )}
          </div>
        </div>

        {/* 긴급 배너 */}
        {urgentAlerts.filter(i => !dismissedBanners.includes(i.id)).map(item => {
          const d = Math.ceil((new Date(item.expiry) - today) / 86400000);
          return (
            <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fff8f0", border:"1px solid #ffe0c0", borderRadius:10, padding:"10px 14px", marginBottom:8 }}>
              <div>
                <div style={{ fontSize:11, color:"#e07020", fontWeight:700, marginBottom:2 }}>유통기한 임박</div>
                <div style={{ fontSize:13, color:T.text, fontWeight:500 }}>{item.name} · {d > 0 ? `${d}일 남음` : "오늘 만료"}</div>
              </div>
              <button onClick={() => setDismissedBanners(p => [...p, item.id])}
                style={{ background:"none", border:"none", color:T.text3, fontSize:18, cursor:"pointer", padding:"0 4px" }}>×</button>
            </div>
          );
        })}

        {/* 요약 카드 */}
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {[
            { label:"전체", value:items.length },
            { label:"주의", value:alerts.length, warn:true },
            { label:"미입력", value:items.filter(i=>i.quantity===null).length },
          ].map(s => (
            <div key={s.label} style={{ flex:1, background: s.warn && s.value > 0 ? "#fff4f0" : T.bg2, borderRadius:10, padding:"10px 12px", border:`1px solid ${s.warn && s.value > 0 ? "#ffd0c0" : T.border}` }}>
              <div style={{ fontSize:18, fontWeight:700, color: s.warn && s.value > 0 ? "#e07b54" : T.text }}>{s.value}</div>
              <div style={{ fontSize:11, color:T.text3, marginTop:1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div style={{ display:"flex", gap:0, marginBottom:-1 }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex:1, padding:"10px 4px", border:"none", background:"none", cursor:"pointer",
              color: activeTab===tab ? T.text : T.text3,
              fontWeight: activeTab===tab ? 700 : 400,
              fontSize:12, fontFamily:"inherit",
              borderBottom: activeTab===tab ? `2px solid ${T.text}` : "2px solid transparent",
              position:"relative",
            }}>
              {tab}
              {tab==="알림" && alerts.length > 0 && <span style={{ position:"absolute", top:6, right:4, width:6, height:6, borderRadius:"50%", background:"#e05050" }} />}
              {tab==="쇼핑" && shoppingList.filter(i=>!i.done).length > 0 && <span style={{ position:"absolute", top:6, right:4, width:6, height:6, borderRadius:"50%", background:"#4caf7d" }} />}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div style={{ padding:"16px 20px 100px" }}>

        {/* ── 재고 탭 ── */}
        {activeTab==="재고" && (
          <>
            {/* 검색 */}
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="검색..."
              style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:`1px solid ${T.border}`, fontSize:14, background:T.bg2, fontFamily:"inherit", boxSizing:"border-box", outline:"none", color:T.text, marginBottom:12 }} />

            {/* 정렬 */}
            <div style={{ display:"flex", gap:6, marginBottom:10, overflowX:"auto", paddingBottom:4 }}>
              {[{k:"default",l:"기본"},{k:"name",l:"이름"},{k:"expiry",l:"유통기한"},{k:"quantity",l:"수량"},{k:"category",l:"카테고리"}].map(s => (
                <button key={s.k} onClick={()=>setSortBy(s.k)} style={{ whiteSpace:"nowrap", padding:"5px 12px", borderRadius:20, border:`1px solid ${sortBy===s.k ? T.text : T.border}`, background:sortBy===s.k ? T.text : T.bg, color:sortBy===s.k ? T.accentText : T.text2, fontSize:11, cursor:"pointer", fontFamily:"inherit", fontWeight:500 }}>{s.l}</button>
              ))}
            </div>

            {/* 카테고리 필터 */}
            <div style={{ display:"flex", gap:6, marginBottom:10, overflowX:"auto", paddingBottom:4 }}>
              {[{name:"전체",icon:""}, ...categories].map(c => (
                <button key={c.name} onClick={()=>setFilterCategory(c.name)} style={{ whiteSpace:"nowrap", padding:"5px 12px", borderRadius:20, border:`1px solid ${filterCategory===c.name ? T.text : T.border}`, background:filterCategory===c.name ? T.text : T.bg, color:filterCategory===c.name ? T.accentText : T.text2, fontSize:11, cursor:"pointer", fontFamily:"inherit", fontWeight:500, display:"flex", alignItems:"center", gap:4 }}>
                  {c.icon && <span>{c.icon}</span>}{c.name}
                </button>
              ))}
            </div>

            {/* 상태 필터 */}
            <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
              {["전체","ok","low","expiring","expired","unknown"].map(s => (
                <button key={s} onClick={()=>setFilterStatus(s)} style={{ padding:"4px 10px", borderRadius:20, border:`1px solid ${filterStatus===s ? T.text : T.border}`, background:filterStatus===s ? T.text : T.bg, color:filterStatus===s ? T.accentText : T.text2, fontSize:11, cursor:"pointer", fontFamily:"inherit", fontWeight:500 }}>
                  {s==="전체"?"전체":STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>

            {/* 목록 */}
            {filtered.length===0 && <div style={{ textAlign:"center", padding:"40px 0", color:T.text3, fontSize:14 }}>검색 결과가 없어요</div>}
            <div style={{ display:"flex", flexDirection:"column" }}>
              {filtered.map((item, idx) => {
                const st = getStatus(item);
                const cfg = STATUS_CONFIG[st];
                const cat = getCat(item.category);
                const daysLeft = Math.ceil((new Date(item.expiry) - today) / 86400000);
                return (
                  <div key={item.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:`1px solid ${T.border}` }}>
                    {/* 상태 dot */}
                    <div style={{ width:8, height:8, borderRadius:"50%", background:cfg.dot, flexShrink:0 }} />

                    {/* 이모지 */}
                    <div style={{ fontSize:20, flexShrink:0, width:28, textAlign:"center" }}>{cat.icon}</div>

                    {/* 이름 + 카테고리 */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
                      <div style={{ fontSize:11, color:T.text3, marginTop:1 }}>{item.category} · {daysLeft > 0 ? `${daysLeft}일 남음` : "만료"}</div>
                    </div>

                    {/* 수량 + +/- */}
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                      {item.quantity !== null ? (
                        <>
                          <button onClick={() => setItems(p => p.map(i => i.id===item.id ? {...i, quantity: Math.max(0, i.quantity-(item.unit==="개"?1:10))} : i))}
                            style={{ width:24, height:24, borderRadius:6, border:`1px solid ${T.border}`, background:T.bg2, color:T.text, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, flexShrink:0 }}>−</button>
                          <div style={{ minWidth:52, textAlign:"center" }}>
                            <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{item.quantity}<span style={{ fontSize:10, fontWeight:400, marginLeft:1 }}>{item.unit}</span></div>
                          </div>
                          <button onClick={() => setItems(p => p.map(i => i.id===item.id ? {...i, quantity: i.quantity+(item.unit==="개"?1:10)} : i))}
                            style={{ width:24, height:24, borderRadius:6, border:`1px solid ${T.border}`, background:T.bg2, color:T.text, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, flexShrink:0 }}>+</button>
                        </>
                      ) : (
                        <div style={{ fontSize:11, color:T.text3, fontStyle:"italic", minWidth:52, textAlign:"center" }}>미입력</div>
                      )}
                    </div>

                    {/* 액션 */}
                    <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                      <button onClick={()=>openEdit(item)} style={{ padding:"5px 10px", borderRadius:7, border:`1px solid ${T.border}`, background:T.bg, color:T.text2, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>수정</button>
                      <button onClick={()=>handleDelete(item.id, item.name)} style={{ padding:"5px 8px", borderRadius:7, border:"1px solid #ffd0d0", background:"#fff8f8", color:"#e05050", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── 알림 탭 ── */}
        {activeTab==="알림" && (
          <div>
            {alerts.length===0
              ? <div style={{ textAlign:"center", padding:"60px 0" }}><div style={{ fontSize:36, marginBottom:12 }}>✓</div><div style={{ fontSize:14, color:T.text3 }}>모든 재료가 정상이에요</div></div>
              : <div>
                  {[{type:"expired",title:"만료됨"},{type:"expiring",title:"유통기한 임박"},{type:"low",title:"재고 부족"},{type:"unknown",title:"수량 미입력"}].map(({type,title}) => {
                    const group = alerts.filter(i => getStatus(i)===type);
                    if (!group.length) return null;
                    const cfg = STATUS_CONFIG[type];
                    return (
                      <div key={type} style={{ marginBottom:20 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:cfg.color, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.5px" }}>{title} {group.length}</div>
                        {group.map(item => {
                          const d = Math.ceil((new Date(item.expiry)-today)/86400000);
                          return (
                            <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
                              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                <div style={{ width:6, height:6, borderRadius:"50%", background:cfg.dot, flexShrink:0 }} />
                                <div>
                                  <div style={{ fontSize:13, fontWeight:600 }}>{item.name}</div>
                                  <div style={{ fontSize:11, color:T.text3, marginTop:1 }}>
                                    {type==="unknown"?"수량을 입력해주세요":type==="low"?`최소 ${item.minStock}${item.unit} 필요`:`${item.expiry} · ${d>0?`${d}일 남음`:"만료"}`}
                                  </div>
                                </div>
                              </div>
                              <span style={{ fontSize:12, fontWeight:700, color:cfg.color }}>{item.quantity!==null?`${item.quantity}${item.unit}`:"-"}</span>
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

        {/* ── 베이킹 탭 ── */}
        {activeTab==="베이킹" && (
          <div>
            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              <button onClick={()=>setBakingMode("recipe")} style={{ flex:1, padding:"10px", borderRadius:10, border:`1px solid ${bakingMode==="recipe"?T.text:T.border}`, background:bakingMode==="recipe"?T.text:T.bg, color:bakingMode==="recipe"?T.accentText:T.text2, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>레시피</button>
              <button onClick={()=>setBakingMode("manual")} style={{ flex:1, padding:"10px", borderRadius:10, border:`1px solid ${bakingMode==="manual"?T.text:T.border}`, background:bakingMode==="manual"?T.text:T.bg, color:bakingMode==="manual"?T.accentText:T.text2, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>직접 입력</button>
            </div>

            {bakingMode==="recipe" && (
              <div>
                {showRecipeForm ? (
                  <div style={{ background:T.bg2, borderRadius:14, padding:16, marginBottom:16, border:`1px solid ${T.border}` }}>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>새 레시피</div>
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11, color:T.text2, marginBottom:4 }}>이름</div>
                      <input value={recipeForm.name} onChange={e=>setRecipeForm(p=>({...p,name:e.target.value}))} placeholder="예: 휘낭시에"
                        style={{ width:"100%", padding:"9px 12px", borderRadius:9, border:`1px solid ${T.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box", background:T.bg }} />
                    </div>
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:11, color:T.text2, marginBottom:4 }}>기준 개수</div>
                      <input type="number" value={recipeForm.servings} onChange={e=>setRecipeForm(p=>({...p,servings:Number(e.target.value)}))}
                        style={{ width:"100%", padding:"9px 12px", borderRadius:9, border:`1px solid ${T.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box", background:T.bg }} />
                    </div>
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:11, color:T.text2, marginBottom:6 }}>재료</div>
                      <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                        <select value={recipeIngInput.name} onChange={e=>setRecipeIngInput(p=>({...p,name:e.target.value}))}
                          style={{ flex:2, padding:"8px", borderRadius:8, border:`1px solid ${T.border}`, fontSize:12, fontFamily:"inherit", outline:"none", background:T.bg }}>
                          <option value="">재료 선택</option>
                          {items.map(i=><option key={i.id} value={i.name}>{i.name}</option>)}
                        </select>
                        <input type="number" value={recipeIngInput.amount} onChange={e=>setRecipeIngInput(p=>({...p,amount:e.target.value}))} placeholder="양"
                          style={{ flex:1, padding:"8px", borderRadius:8, border:`1px solid ${T.border}`, fontSize:12, fontFamily:"inherit", outline:"none", background:T.bg }} />
                        <select value={recipeIngInput.unit} onChange={e=>setRecipeIngInput(p=>({...p,unit:e.target.value}))}
                          style={{ flex:1, padding:"8px 4px", borderRadius:8, border:`1px solid ${T.border}`, fontSize:12, fontFamily:"inherit", outline:"none", background:T.bg }}>
                          {UNITS.map(u=><option key={u}>{u}</option>)}
                        </select>
                        <button onClick={()=>{
                          if(!recipeIngInput.name||!recipeIngInput.amount) return;
                          setRecipeForm(p=>({...p,ingredients:[...p.ingredients,{...recipeIngInput,amount:Number(recipeIngInput.amount)}]}));
                          setRecipeIngInput(p=>({...p,name:"",amount:""}));
                        }} style={{ padding:"8px 12px", borderRadius:8, border:"none", background:T.accent, color:T.accentText, fontSize:13, cursor:"pointer", fontWeight:700 }}>+</button>
                      </div>
                      {recipeForm.ingredients.map((ing,idx)=>(
                        <div key={idx} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 10px", background:T.bg, borderRadius:8, marginBottom:4 }}>
                          <span style={{ fontSize:13 }}>{ing.name}</span>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:12, color:T.text2 }}>{ing.amount}{ing.unit}</span>
                            <button onClick={()=>setRecipeForm(p=>({...p,ingredients:p.ingredients.filter((_,i)=>i!==idx)}))}
                              style={{ background:"none", border:"none", color:"#e05050", fontSize:16, cursor:"pointer" }}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <Btn onClick={()=>{setShowRecipeForm(false);setRecipeForm({name:"",servings:1,ingredients:[]});}} variant="ghost" style={{ flex:1 }}>취소</Btn>
                      <Btn onClick={()=>{
                        if(!recipeForm.name||recipeForm.ingredients.length===0) return;
                        setRecipes(p=>[...p,{id:Date.now(),...recipeForm}]);
                        setShowRecipeForm(false); setRecipeForm({name:"",servings:1,ingredients:[]});
                        showNotif(`'${recipeForm.name}' 저장`);
                      }} variant="primary" style={{ flex:2 }}>저장</Btn>
                    </div>
                  </div>
                ) : (
                  <button onClick={()=>setShowRecipeForm(true)} style={{ width:"100%", padding:"12px", borderRadius:12, border:`1.5px dashed ${T.border2}`, background:T.bg, color:T.text2, fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight:600, marginBottom:12 }}>+ 레시피 추가</button>
                )}

                {recipes.length===0 && !showRecipeForm && <div style={{ textAlign:"center", padding:"40px 0", color:T.text3, fontSize:13 }}>등록된 레시피가 없어요</div>}
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {recipes.map(recipe=>(
                    <div key={recipe.id} style={{ border:`1px solid ${T.border}`, borderRadius:14, padding:14, background:T.bg }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                        <div>
                          <div style={{ fontWeight:700, fontSize:15 }}>{recipe.name}</div>
                          <div style={{ fontSize:11, color:T.text3, marginTop:2 }}>기준 {recipe.servings}개</div>
                        </div>
                        <button onClick={()=>setRecipes(p=>p.filter(r=>r.id!==recipe.id))} style={{ background:"none", border:"none", color:T.text3, fontSize:18, cursor:"pointer" }}>×</button>
                      </div>
                      <div style={{ marginBottom:12 }}>
                        {recipe.ingredients.map((ing,idx)=>(
                          <div key={idx} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:T.text2, padding:"4px 0", borderBottom:`1px solid ${T.border}` }}>
                            <span>{ing.name}</span><span>{ing.amount}{ing.unit}</span>
                          </div>
                        ))}
                      </div>
                      <Btn onClick={()=>{
                        const missing = recipe.ingredients.find(ing=>{ const it=items.find(i=>i.name===ing.name); return !it||it.quantity===null; });
                        if(missing){showNotif("수량 미입력 재료가 있어요.","error");return;}
                        setItems(p=>p.map(it=>{ const ing=recipe.ingredients.find(i=>i.name===it.name); if(!ing)return it; return{...it,quantity:Math.max(0,it.quantity-ing.amount)};}));
                        showNotif(`${recipe.name} 차감 완료`);
                      }} variant="primary" style={{ width:"100%", borderRadius:10 }}>차감하기</Btn>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {bakingMode==="manual" && (
              <div>
                <div style={{ fontSize:12, color:T.text3, marginBottom:12 }}>사용한 양을 입력하면 재고에서 차감돼요</div>
                <div style={{ display:"flex", flexDirection:"column" }}>
                  {items.filter(i=>i.quantity!==null).map(item=>{
                    const entry=manualDeduct.find(d=>d.itemId===item.id);
                    const cat=getCat(item.category);
                    return(
                      <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:`1px solid ${T.border}` }}>
                        <span style={{ fontSize:18, width:24, textAlign:"center" }}>{cat.icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600 }}>{item.name}</div>
                          <div style={{ fontSize:11, color:T.text3 }}>현재 {item.quantity}{item.unit}</div>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                          <input type="number" value={entry?.amount||""} onChange={e=>{
                            const val=e.target.value;
                            setManualDeduct(p=>{ const ex=p.find(d=>d.itemId===item.id); if(!val)return p.filter(d=>d.itemId!==item.id); if(ex)return p.map(d=>d.itemId===item.id?{...d,amount:Number(val)}:d); return[...p,{itemId:item.id,amount:Number(val)}]; });
                          }} placeholder="0"
                            style={{ width:56, padding:"6px 8px", borderRadius:8, border:`1px solid ${T.border}`, fontSize:13, textAlign:"right", fontFamily:"inherit", outline:"none", background:T.bg2 }} />
                          <span style={{ fontSize:11, color:T.text3 }}>{item.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Btn onClick={()=>{
                  if(!manualDeduct.length){showNotif("차감할 양을 입력해주세요.","error");return;}
                  setItems(p=>p.map(it=>{ const e=manualDeduct.find(d=>d.itemId===it.id); if(!e)return it; return{...it,quantity:Math.max(0,it.quantity-e.amount)};}));
                  setManualDeduct([]); showNotif("차감 완료");
                }} variant="primary" style={{ width:"100%", borderRadius:12, marginTop:16 }}>재고에서 차감하기</Btn>
              </div>
            )}
          </div>
        )}

        {/* ── 쇼핑 탭 ── */}
        {activeTab==="쇼핑" && (()=>{
          const lowItems=items.filter(i=>getStatus(i)==="low");
          const addItem=(name,auto=false)=>{
            if(!name.trim())return;
            if(shoppingList.find(i=>i.name===name.trim()&&!i.done))return;
            setShoppingList(p=>[...p,{id:Date.now(),name:name.trim(),done:false,auto}]);
          };
          const toggle=(id)=>setShoppingList(p=>p.map(i=>i.id===id?{...i,done:!i.done}:i));
          const remove=(id)=>setShoppingList(p=>p.filter(i=>i.id!==id));
          const pending=shoppingList.filter(i=>!i.done);
          const done=shoppingList.filter(i=>i.done);
          return(
            <div>
              <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                <input value={shopInput} onChange={e=>setShopInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){addItem(shopInput);setShopInput("");}}} placeholder="살 재료 입력..."
                  style={{ flex:1, padding:"10px 14px", borderRadius:10, border:`1px solid ${T.border}`, fontSize:14, background:T.bg2, fontFamily:"inherit", outline:"none", color:T.text }} />
                <Btn onClick={()=>{addItem(shopInput);setShopInput("");}} variant="primary" style={{ borderRadius:10 }}>추가</Btn>
              </div>

              {lowItems.length>0&&(
                <div style={{ background:T.bg2, borderRadius:12, padding:"12px 14px", marginBottom:16, border:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#e07b54", marginBottom:8 }}>재고 부족 — 빠르게 추가</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {lowItems.map(item=>{
                      const already=shoppingList.find(i=>i.name===item.name&&!i.done);
                      return(
                        <button key={item.id} onClick={()=>addItem(item.name,true)} disabled={!!already}
                          style={{ padding:"5px 12px", borderRadius:16, border:`1px solid ${already?"#e8e6e3":"#1a1a1a"}`, background:already?"#f7f7f5":"#1a1a1a", color:already?T.text3:"#fff", fontSize:12, cursor:already?"default":"pointer", fontFamily:"inherit", fontWeight:500 }}>
                          {already?"✓ ":"+ "}{item.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {shoppingList.length===0
                ? <div style={{ textAlign:"center", padding:"50px 0", color:T.text3, fontSize:13 }}>살 재료를 추가해보세요</div>
                : <div>
                    {pending.map(item=>(
                      <div key={item.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 0", borderBottom:`1px solid ${T.border}` }}>
                        <button onClick={()=>toggle(item.id)} style={{ width:22, height:22, borderRadius:"50%", border:`1.5px solid ${T.border2}`, background:T.bg, cursor:"pointer", flexShrink:0 }} />
                        <span style={{ flex:1, fontSize:14, color:T.text }}>{item.name}</span>
                        {item.auto&&<span style={{ fontSize:10, color:"#e07b54", background:"#fff4f0", padding:"2px 7px", borderRadius:8 }}>부족</span>}
                        <button onClick={()=>remove(item.id)} style={{ color:T.text3, background:"none", border:"none", fontSize:18, cursor:"pointer" }}>×</button>
                      </div>
                    ))}
                    {done.length>0&&(
                      <>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16, marginBottom:8 }}>
                          <div style={{ fontSize:11, color:T.text3, fontWeight:600 }}>완료 {done.length}</div>
                          <button onClick={()=>setShoppingList(p=>p.filter(i=>!i.done))} style={{ fontSize:11, color:"#e05050", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>전체 삭제</button>
                        </div>
                        {done.map(item=>(
                          <div key={item.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${T.border}`, opacity:0.5 }}>
                            <button onClick={()=>toggle(item.id)} style={{ width:22, height:22, borderRadius:"50%", border:"none", background:"#4caf7d", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:12 }}>✓</button>
                            <span style={{ flex:1, fontSize:14, color:T.text2, textDecoration:"line-through" }}>{item.name}</span>
                            <button onClick={()=>remove(item.id)} style={{ color:T.text3, background:"none", border:"none", fontSize:18, cursor:"pointer" }}>×</button>
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
        {activeTab==="카테고리" && (
          <div>
            {showCatForm ? (
              <div style={{ background:T.bg2, borderRadius:14, padding:16, marginBottom:14, border:`1px solid ${T.border}` }}>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>{editCatIdx===null?"새 카테고리":"카테고리 수정"}</div>
                <div style={{ display:"flex", alignItems:"center", gap:10, background:T.bg, borderRadius:10, padding:"10px 14px", marginBottom:14, border:`1px solid ${T.border}` }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:catForm.color+"40", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{catForm.icon}</div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{catForm.name||"이름 입력"}</div>
                </div>
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, color:T.text2, marginBottom:4 }}>이름</div>
                  <input value={catForm.name} onChange={e=>setCatForm(p=>({...p,name:e.target.value}))} placeholder="예: 초콜릿류"
                    style={{ width:"100%", padding:"9px 12px", borderRadius:9, border:`1px solid ${T.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box", background:T.bg }} />
                </div>
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, color:T.text2, marginBottom:6 }}>이모티콘</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {EMOJI_PALETTE.map(e=>(
                      <button key={e} onClick={()=>setCatForm(p=>({...p,icon:e}))} style={{ width:34, height:34, borderRadius:8, fontSize:17, border:`1px solid ${catForm.icon===e?T.text:T.border}`, background:catForm.icon===e?T.bg3:T.bg, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>{e}</button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, color:T.text2, marginBottom:6 }}>색상</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                    {DEFAULT_COLORS.map(c=>(
                      <button key={c} onClick={()=>setCatForm(p=>({...p,color:c}))} style={{ width:26, height:26, borderRadius:"50%", background:c, border:"none", cursor:"pointer", outline:catForm.color===c?`2.5px solid ${T.text}`:"none", outlineOffset:2 }} />
                    ))}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <Btn onClick={()=>{setShowCatForm(false);setEditCatIdx(null);}} variant="ghost" style={{ flex:1 }}>취소</Btn>
                  <Btn onClick={saveCat} variant="primary" style={{ flex:2 }}>저장</Btn>
                </div>
              </div>
            ) : (
              <button onClick={()=>{setCatForm({name:"",icon:"📦",color:"#b8b8b8"});setEditCatIdx(null);setShowCatForm(true);}}
                style={{ width:"100%", padding:"12px", borderRadius:12, border:`1.5px dashed ${T.border2}`, background:T.bg, color:T.text2, fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight:600, marginBottom:12 }}>+ 카테고리 추가</button>
            )}

            {!showCatForm&&<div style={{ fontSize:11, color:T.text3, textAlign:"center", marginBottom:10 }}>☰ 드래그로 순서 변경 · 수정 버튼으로 편집</div>}

            <div style={{ display:"flex", flexDirection:"column" }}>
              {categories.map((cat,idx)=>{
                const count=items.filter(i=>i.category===cat.name).length;
                const alertCount=items.filter(i=>i.category===cat.name&&["low","expiring","expired","unknown"].includes(getStatus(i))).length;
                return(
                  <div key={cat.name} draggable
                    onDragStart={e=>{e.dataTransfer.setData("text/plain",String(idx));}}
                    onDragOver={e=>{e.preventDefault();e.currentTarget.style.opacity="0.5";}}
                    onDragLeave={e=>{e.currentTarget.style.opacity="1";}}
                    onDrop={e=>{e.preventDefault();e.currentTarget.style.opacity="1";const from=parseInt(e.dataTransfer.getData("text/plain"));if(from===idx)return;setCategories(p=>{const n=[...p];const[m]=n.splice(from,1);n.splice(idx,0,m);return n;});}}
                    onDragEnd={e=>{e.currentTarget.style.opacity="1";}}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:`1px solid ${T.border}`, cursor:"grab", userSelect:"none" }}
                  >
                    <span style={{ color:T.text3, fontSize:14 }}>☰</span>
                    <div style={{ width:32, height:32, borderRadius:8, background:cat.color+"40", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0 }}>{cat.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:600 }}>{cat.name}</div>
                      <div style={{ fontSize:11, color:T.text3, marginTop:1 }}>재료 {count}종</div>
                    </div>
                    {alertCount>0&&<div style={{ fontSize:11, color:"#e07b54", background:"#fff4f0", borderRadius:20, padding:"2px 8px", fontWeight:600 }}>주의 {alertCount}</div>}
                    <button onClick={()=>{setCatForm({name:cat.name,icon:cat.icon,color:cat.color});setEditCatIdx(idx);setShowCatForm(true);}}
                      style={{ padding:"4px 10px", borderRadius:7, border:`1px solid ${T.border}`, background:T.bg, color:T.text2, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>수정</button>
                    {count===0&&<button onClick={()=>{setCategories(p=>p.filter((_,i)=>i!==idx));showNotif(`'${cat.name}' 삭제됨`,"error");}}
                      style={{ padding:"4px 8px", borderRadius:7, border:"1px solid #ffd0d0", background:"#fff8f8", color:"#e05050", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>삭제</button>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      {activeTab==="재고"&&(
        <button onClick={openAdd} style={{ position:"fixed", bottom:28, right:20, width:52, height:52, borderRadius:"50%", background:T.accent, color:T.accentText, fontSize:24, border:"none", cursor:"pointer", boxShadow:"0 4px 20px rgba(0,0,0,0.2)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>+</button>
      )}

      {/* 재료 모달 */}
      {showModal&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:1000, display:"flex", alignItems:"flex-end" }} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={{ background:T.bg, borderRadius:"20px 20px 0 0", width:"100%", padding:"24px 20px 40px", maxHeight:"85vh", overflowY:"auto" }}>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:20 }}>{editItem?"재료 수정":"새 재료 추가"}</div>
            {[{label:"재료명 *",key:"name",type:"text",ph:"예: 박력분"},{label:"수량 (모르면 빈칸)",key:"quantity",type:"number",ph:"예: 500"},{label:"최소 재고",key:"minStock",type:"number",ph:"예: 200"},{label:"유통기한 *",key:"expiry",type:"date"}].map(f=>(
              <div key={f.key} style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:T.text2, marginBottom:4 }}>{f.label}</div>
                <input type={f.type} value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}
                  style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1px solid ${T.border}`, fontSize:14, background:T.bg2, fontFamily:"inherit", boxSizing:"border-box", color:T.text, outline:"none" }} />
              </div>
            ))}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, color:T.text2, marginBottom:4 }}>카테고리</div>
              <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}
                style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1px solid ${T.border}`, fontSize:14, background:T.bg2, fontFamily:"inherit", color:T.text, outline:"none" }}>
                {categories.map(c=><option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, color:T.text2, marginBottom:6 }}>단위</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                {UNITS.map(u=>(
                  <button key={u} onClick={()=>setForm(p=>({...p,unit:u}))} style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${form.unit===u?T.text:T.border}`, background:form.unit===u?T.text:T.bg, color:form.unit===u?T.accentText:T.text2, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>{u}</button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:9 }}>
              <Btn onClick={()=>setShowModal(false)} variant="ghost" style={{ flex:1 }}>취소</Btn>
              <Btn onClick={handleSave} variant="primary" style={{ flex:2 }}>저장</Btn>
            </div>
          </div>
        </div>
      )}

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap'); * { -webkit-tap-highlight-color: transparent; } @keyframes fadeIn { from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}
