"use client";

/**
 * Sufra QR Ordering — mobile customer flow (table QR).
 * Imported from the "Sufra QR Ordering" Claude Design prototype (mobile only).
 * Lands on the MENU (the table is identified by the QR), with: Menu → Item →
 * Cart → Track. Self-contained demo data, so it always renders with no backend
 * dependency. The scan screen is kept and reachable via the table chip.
 */

import { useMemo, useState, type CSSProperties } from "react";

// ─── palette ────────────────────────────────────────────────────────────────
const GREEN = "#1f8a5b";
const DARK = "#16201a";
const FONT = "'IBM Plex Sans Arabic', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', monospace";

type Lang = "en" | "ar";
type Screen = "scan" | "menu" | "item" | "cart" | "track";
interface Loc { en: string; ar: string }

const CATS: { id: string; name: Loc }[] = [
  { id: "burgers", name: { en: "Burgers", ar: "برغر" } },
  { id: "pizza", name: { en: "Pizza", ar: "بيتزا" } },
  { id: "drinks", name: { en: "Drinks", ar: "مشروبات" } },
  { id: "desserts", name: { en: "Desserts", ar: "حلويات" } },
];

interface Product { id: string; cat: string; price: number; tint: string; avail?: boolean; name: Loc; desc: Loc }
const PRODUCTS: Product[] = [
  { id: "smash", cat: "burgers", price: 34, tint: "#efe3cf", name: { en: "Classic Smash", ar: "سماش كلاسيك" }, desc: { en: "Double beef, cheddar, house sauce", ar: "لحم مزدوج، شيدر، صوص البيت" } },
  { id: "chicken", cat: "burgers", price: 30, tint: "#f0e8d2", name: { en: "Crispy Chicken", ar: "دجاج مقرمش" }, desc: { en: "Buttermilk chicken, pickles, slaw", ar: "دجاج باللبن، مخلل، سلو" } },
  { id: "mushroom", cat: "burgers", price: 36, tint: "#e6e0d3", avail: false, name: { en: "Mushroom Swiss", ar: "مشروم سويس" }, desc: { en: "Beef, sautéed mushrooms, swiss", ar: "لحم، مشروم سوتيه، جبن سويسري" } },
  { id: "margherita", cat: "pizza", price: 42, tint: "#e9efd9", name: { en: "Margherita", ar: "مارغريتا" }, desc: { en: "San Marzano, mozzarella, basil", ar: "صلصة، موزاريلا، ريحان" } },
  { id: "pepperoni", cat: "pizza", price: 46, tint: "#f0ddd2", name: { en: "Pepperoni", ar: "بيبروني" }, desc: { en: "Double pepperoni, mozzarella", ar: "بيبروني مزدوج، موزاريلا" } },
  { id: "lemonade", cat: "drinks", price: 14, tint: "#e6f0e2", name: { en: "Fresh Lemonade", ar: "ليموناضة طازجة" }, desc: { en: "Mint, lemon, soda", ar: "نعناع، ليمون، صودا" } },
  { id: "latte", cat: "drinks", price: 18, tint: "#ece2d6", name: { en: "Iced Latte", ar: "لاتيه مثلج" }, desc: { en: "Double shot, oat milk", ar: "جرعة مزدوجة، حليب شوفان" } },
  { id: "cola", cat: "drinks", price: 8, tint: "#dfe6ef", name: { en: "Cola", ar: "كولا" }, desc: { en: "Chilled can", ar: "علبة مثلجة" } },
  { id: "lava", cat: "desserts", price: 24, tint: "#e8ddd6", name: { en: "Chocolate Lava", ar: "كيكة الشوكولاتة" }, desc: { en: "Warm, molten center, vanilla", ar: "دافئة، حشوة سائلة، فانيلا" } },
  { id: "cheesecake", cat: "desserts", price: 22, tint: "#f1e9da", name: { en: "Cheesecake", ar: "تشيز كيك" }, desc: { en: "New York style, berry coulis", ar: "نيويورك، صوص توت" } },
];

const T: Record<Lang, Record<string, string>> = {
  en: {
    restaurant: "Sufra Kitchen", openNow: "Open now", tableX: "Table",
    scanTitle: "Scan to order", scanHint: "Point your camera at the QR code on your table", tapScan: "Tap to simulate scan",
    all: "All", unavail: "Sold out", viewCart: "View order", cart: "Your order", addToCart: "Add to order",
    notes: "Notes for the kitchen", notePh: "e.g. no onions, extra sauce…", total: "Total", send: "Send order to kitchen",
    empty: "Your cart is empty", browseMenu: "Browse the menu", sent: "Order sent!",
    sentSub: "The kitchen is preparing your order. Track it live below.", est: "Estimated ready in ~15 min", backMenu: "Back to menu",
    s1: "Received", s2: "Preparing", s3: "Ready", s4: "Served",
  },
  ar: {
    restaurant: "مطبخ سفرة", openNow: "مفتوح الآن", tableX: "طاولة",
    scanTitle: "امسح لتطلب", scanHint: "وجّه كاميرتك إلى رمز QR على طاولتك", tapScan: "اضغط لمحاكاة المسح",
    all: "الكل", unavail: "نفد", viewCart: "عرض الطلب", cart: "طلبك", addToCart: "أضف للطلب",
    notes: "ملاحظات للمطبخ", notePh: "مثال: بدون بصل، صوص إضافي…", total: "الإجمالي", send: "أرسل الطلب للمطبخ",
    empty: "سلتك فارغة", browseMenu: "تصفّح المنيو", sent: "تم إرسال الطلب!",
    sentSub: "المطبخ يحضّر طلبك. تابع حالته مباشرة بالأسفل.", est: "الوقت المتوقع للتجهيز ~15 دقيقة", backMenu: "العودة للمنيو",
    s1: "استُلم", s2: "قيد التحضير", s3: "جاهز", s4: "تم التقديم",
  },
};

interface Line { id: string; qty: number; note: string }

const stripe = (tint: string): CSSProperties => ({
  position: "absolute", inset: 0,
  background: `repeating-linear-gradient(45deg, ${tint} 0 12px, ${tint}bb 12px 24px)`,
});

export default function QrOrderingPage() {
  const TABLE = 12;
  const [lang, setLang] = useState<Lang>("ar");
  const [screen, setScreen] = useState<Screen>("menu");
  const [cat, setCat] = useState<string>("all");
  const [sel, setSel] = useState<string | null>(null);
  const [itemQty, setItemQty] = useState(1);
  const [itemNote, setItemNote] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [track, setTrack] = useState<{ id: number; items: Line[]; total: number } | null>(null);

  const ar = lang === "ar";
  const t = T[lang];
  const prod = (id: string) => PRODUCTS.find((p) => p.id === id)!;
  const money = (n: number) => {
    const s = n.toLocaleString("en-US");
    return ar ? `${s} ر.س` : `SAR ${s}`;
  };

  const shown = useMemo(
    () => (cat === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.cat === cat)),
    [cat],
  );
  const cartCount = cart.reduce((a, c) => a + c.qty, 0);
  const cartTotal = cart.reduce((a, c) => a + c.qty * prod(c.id).price, 0);

  const addLine = (id: string, qty: number, note: string) =>
    setCart((cur) => {
      const i = cur.findIndex((c) => c.id === id && c.note === note);
      if (i >= 0) return cur.map((c, j) => (j === i ? { ...c, qty: c.qty + qty } : c));
      return [...cur, { id, qty, note }];
    });
  const setQty = (idx: number, d: number) =>
    setCart((cur) => cur.flatMap((c, j) => (j === idx ? (c.qty + d <= 0 ? [] : [{ ...c, qty: c.qty + d }]) : [c])));
  const openItem = (id: string) => { setSel(id); setItemQty(1); setItemNote(""); setScreen("item"); };
  const placeOrder = () => {
    setTrack({ id: Math.floor(1044 + Math.random() * 50), items: cart, total: cartTotal });
    setCart([]);
    setScreen("track");
  };

  const selP = sel ? prod(sel) : null;

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        minHeight: "100dvh", maxWidth: 460, margin: "0 auto", position: "relative",
        background: "#f7f8f5", color: DARK, fontFamily: FONT, overflow: "hidden",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <style>{`@keyframes sufpulse{0%{box-shadow:0 0 0 0 rgba(31,138,91,.45)}70%{box-shadow:0 0 0 12px rgba(31,138,91,0)}100%{box-shadow:0 0 0 0 rgba(31,138,91,0)}}@keyframes sufslide{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* language toggle (floats over every screen) */}
      <button
        onClick={() => setLang(ar ? "en" : "ar")}
        style={{
          position: "absolute", top: 14, insetInlineEnd: 14, zIndex: 40,
          background: "rgba(22,32,27,.72)", color: "#fff", border: "none",
          padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit", backdropFilter: "blur(6px)",
        }}
      >
        {ar ? "EN" : "ع"}
      </button>

      {/* ─── SCAN ─── */}
      {screen === "scan" && (
        <div style={{ minHeight: "100dvh", background: "#12161a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 28px 40px", textAlign: "center" }}>
          <div style={{ position: "relative", width: 230, height: 230, borderRadius: 26, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <div style={{ width: 172, height: 172, backgroundColor: "#fff", backgroundImage: "repeating-linear-gradient(0deg,#15201a 0 9px,transparent 9px 18px),repeating-linear-gradient(90deg,#15201a 0 9px,transparent 9px 18px)", opacity: 0.92 }} />
            <div style={{ position: "absolute", top: 30, left: 30, width: 34, height: 34, border: "7px solid #15201a", background: "#fff" }} />
            <div style={{ position: "absolute", top: 30, right: 30, width: 34, height: 34, border: "7px solid #15201a", background: "#fff" }} />
            <div style={{ position: "absolute", bottom: 30, left: 30, width: 34, height: 34, border: "7px solid #15201a", background: "#fff" }} />
            <div style={{ position: "absolute", inset: 0, border: `2.5px solid ${GREEN}`, borderRadius: 26 }} />
          </div>
          <h2 style={{ color: "#fff", fontSize: 21, fontWeight: 700, margin: "34px 0 8px" }}>{t.scanTitle}</h2>
          <p style={{ color: "rgba(255,255,255,.55)", fontSize: 13.5, lineHeight: 1.5, margin: "0 0 28px", maxWidth: 240 }}>{t.scanHint}</p>
          <button onClick={() => { setScreen("menu"); setCat("all"); }} style={{ background: GREEN, color: "#fff", border: "none", padding: "15px 30px", borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 22px rgba(31,138,91,.35)" }}>{t.tapScan}</button>
          <div style={{ marginTop: 24, fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,.32)" }}>sufra.app/menu/table-{TABLE}</div>
        </div>
      )}

      {/* ─── MENU ─── */}
      {screen === "menu" && (
        <div style={{ minHeight: "100dvh", background: "#f7f8f5" }}>
          <div style={{ position: "sticky", top: 0, zIndex: 6, background: "rgba(247,248,245,.93)", backdropFilter: "blur(12px)", padding: "18px 18px 0", borderBottom: "1px solid #e8ece4" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.01em", color: DARK }}>{t.restaurant}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8a917f", marginTop: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, display: "inline-block" }} />
                  {t.tableX} {TABLE} · {t.openNow}
                </div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "#fff", border: "1px solid #e8ece4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><circle cx="7" cy="7" r="5.3" stroke="#7c847a" strokeWidth="1.7" /><path d="M11 11l3.5 3.5" stroke="#7c847a" strokeWidth="1.7" strokeLinecap="round" /></svg>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "14px 0 13px" }}>
              {[{ id: "all", name: { en: t.all, ar: t.all } }, ...CATS].map((c) => {
                const on = cat === c.id;
                return (
                  <button key={c.id} onClick={() => setCat(c.id)} style={{ flexShrink: 0, padding: "9px 16px", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, background: on ? DARK : "#fff", color: on ? "#fff" : "#5e665c", boxShadow: on ? "none" : "inset 0 0 0 1px #e8ece4" }}>
                    {c.name[lang]}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ padding: "16px 16px 130px", display: "flex", flexDirection: "column", gap: 12 }}>
            {shown.map((p) => (
              <div key={p.id} onClick={() => openItem(p.id)} style={{ display: "flex", gap: 14, padding: 13, background: "#fff", border: "1px solid #ebeee8", borderRadius: 17, cursor: "pointer", alignItems: "center" }}>
                <div style={{ position: "relative", width: 84, height: 84, borderRadius: 13, overflow: "hidden", flexShrink: 0, background: "#eef0ed" }}>
                  <div style={stripe(p.tint)} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: "#1b231d" }}>{p.name[lang]}</div>
                  <p style={{ margin: "3px 0 0", fontSize: 12.5, lineHeight: 1.45, color: "#868d82" }}>{p.desc[lang]}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: GREEN }}>{money(p.price)}</span>
                    {p.avail === false ? (
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#b0463e", background: "#f7e7e5", padding: "5px 10px", borderRadius: 8 }}>{t.unavail}</span>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); addLine(p.id, 1, ""); }} style={{ width: 31, height: 31, borderRadius: 9, border: "none", background: "#e7f2ec", color: GREEN, fontSize: 20, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 0, flexShrink: 0 }}>+</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {cartCount > 0 && (
            <div style={{ position: "sticky", bottom: 0, padding: "14px 16px 26px", background: "linear-gradient(to top,#f7f8f5 62%,rgba(247,248,245,0))" }}>
              <button onClick={() => setScreen("cart")} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 18px", borderRadius: 16, background: GREEN, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 10px 26px rgba(31,138,91,.32)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 600 }}>
                  <span style={{ background: "rgba(255,255,255,.22)", minWidth: 24, height: 24, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, padding: "0 6px" }}>{cartCount}</span>
                  {t.viewCart}
                </span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{money(cartTotal)}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── ITEM ─── */}
      {screen === "item" && selP && (
        <div style={{ minHeight: "100dvh", background: "#fff", display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", height: 296, background: "#eef0ed", flexShrink: 0 }}>
            <div style={stripe(selP.tint)} />
            <button onClick={() => setScreen("menu")} style={{ position: "absolute", top: 18, insetInlineStart: 16, width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.9)", backdropFilter: "blur(6px)", cursor: "pointer", fontSize: 22, color: "#1b231d", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 0, boxShadow: "0 2px 8px rgba(0,0,0,.1)" }}>{ar ? "›" : "‹"}</button>
          </div>
          <div style={{ padding: "22px 20px 16px", flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: DARK, lineHeight: 1.2 }}>{selP.name[lang]}</h2>
              <span style={{ fontSize: 18, fontWeight: 700, color: GREEN, whiteSpace: "nowrap" }}>{money(selP.price)}</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "#727a6e", margin: "12px 0 22px" }}>{selP.desc[lang]}</p>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#9aa097", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>{t.notes}</div>
            <textarea value={itemNote} onChange={(e) => setItemNote(e.target.value)} placeholder={t.notePh} style={{ width: "100%", minHeight: 62, resize: "none", border: "1px solid #e4e8e0", borderRadius: 12, padding: 12, fontSize: 14, fontFamily: "inherit", color: DARK, background: "#f7f8f5", outline: "none" }} />
          </div>
          <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid #eef0ea", padding: "14px 18px 28px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#f1f3ee", borderRadius: 12, padding: 4, flexShrink: 0 }}>
              <button onClick={() => setItemQty((q) => Math.max(1, q - 1))} style={qtyBtn}>−</button>
              <span style={{ minWidth: 34, textAlign: "center", fontSize: 16, fontWeight: 700, color: DARK }}>{itemQty}</span>
              <button onClick={() => setItemQty((q) => q + 1)} style={qtyBtn}>+</button>
            </div>
            <button onClick={() => { addLine(selP.id, itemQty, itemNote); setScreen("menu"); }} style={{ flex: 1, background: GREEN, color: "#fff", border: "none", padding: 15, borderRadius: 13, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t.addToCart} · {money(selP.price * itemQty)}</button>
          </div>
        </div>
      )}

      {/* ─── CART ─── */}
      {screen === "cart" && (
        <div style={{ minHeight: "100dvh", background: "#f7f8f5", display: "flex", flexDirection: "column" }}>
          <div style={{ position: "sticky", top: 0, zIndex: 5, background: "#fff", padding: "16px 18px 15px", borderBottom: "1px solid #eef0ea", display: "flex", alignItems: "center", gap: 13 }}>
            <button onClick={() => setScreen("menu")} style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid #e8ece4", background: "#fff", cursor: "pointer", fontSize: 22, color: "#1b231d", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 0 }}>{ar ? "›" : "‹"}</button>
            <div><div style={{ fontSize: 18, fontWeight: 700, color: DARK }}>{t.cart}</div><div style={{ fontSize: 12, color: "#8a917f", marginTop: 1 }}>{t.tableX} {TABLE}</div></div>
          </div>

          {cart.length > 0 ? (
            <>
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 11, flex: 1 }}>
                {cart.map((ci, idx) => {
                  const p = prod(ci.id);
                  return (
                    <div key={`${ci.id}-${idx}`} style={{ display: "flex", gap: 13, alignItems: "center", padding: 13, background: "#fff", border: "1px solid #ebeee8", borderRadius: 15 }}>
                      <div style={{ position: "relative", width: 56, height: 56, borderRadius: 11, overflow: "hidden", flexShrink: 0, background: "#eef0ed" }}><div style={stripe(p.tint)} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 600, color: "#1b231d" }}>{p.name[lang]}</div>
                        {ci.note && <div style={{ fontSize: 11.5, color: "#9aa097", marginTop: 2, fontStyle: "italic" }}>“{ci.note}”</div>}
                        <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, marginTop: 5 }}>{money(p.price * ci.qty)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#f1f3ee", borderRadius: 10, padding: 3, flexShrink: 0 }}>
                        <button onClick={() => setQty(idx, -1)} style={miniBtn}>−</button>
                        <span style={{ minWidth: 24, textAlign: "center", fontSize: 14, fontWeight: 700 }}>{ci.qty}</span>
                        <button onClick={() => setQty(idx, 1)} style={miniBtn}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: "1px solid #eef0ea", padding: "16px 20px 28px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><span style={{ fontSize: 14, color: "#727a6e" }}>{t.total}</span><span style={{ fontSize: 20, fontWeight: 700, color: DARK }}>{money(cartTotal)}</span></div>
                <button onClick={placeOrder} style={{ width: "100%", background: GREEN, color: "#fff", border: "none", padding: 16, borderRadius: 14, fontSize: 15.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 22px rgba(31,138,91,.3)" }}>{t.send}</button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40 }}>
              <div style={{ width: 62, height: 62, borderRadius: "50%", background: "#eef0ea", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M3 4h3l2.5 13h11l2.5-9H7" stroke="#9aa097" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="10" cy="22" r="1.6" fill="#9aa097" /><circle cx="19" cy="22" r="1.6" fill="#9aa097" /></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: DARK }}>{t.empty}</div>
              <button onClick={() => setScreen("menu")} style={{ marginTop: 18, background: "#e7f2ec", color: GREEN, border: "none", padding: "12px 22px", borderRadius: 11, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t.browseMenu}</button>
            </div>
          )}
        </div>
      )}

      {/* ─── TRACK ─── */}
      {screen === "track" && track && (
        <div style={{ minHeight: "100dvh", background: "#fff", display: "flex", flexDirection: "column", padding: "44px 22px 30px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 66, height: 66, borderRadius: "50%", background: "#e7f2ec", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none"><path d="M7 15.5l5 5L23 9" stroke={GREEN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h2 style={{ fontSize: 23, fontWeight: 700, margin: "18px 0 6px", color: DARK }}>{t.sent}</h2>
            <p style={{ fontSize: 13.5, color: "#727a6e", margin: "0 auto", maxWidth: 250, lineHeight: 1.5 }}>{t.sentSub}</p>
            <div style={{ display: "flex", gap: 9, justifyContent: "center", marginTop: 16 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: GREEN, background: "#e7f2ec", padding: "6px 12px", borderRadius: 9 }}>#{track.id}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#5e665c", background: "#f1f3ee", padding: "6px 12px", borderRadius: 9 }}>{t.tableX} {TABLE}</span>
            </div>
          </div>

          <div style={{ marginTop: 30, padding: "22px 16px", background: "#f7f8f5", borderRadius: 17 }}>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              {[t.s1, t.s2, t.s3, t.s4].map((label, i) => {
                const done = i === 0;
                const active = i === 1;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", alignItems: "flex-start" }}>
                    {i > 0 && <div style={{ flex: 1, height: 2, marginTop: 14, background: i <= 1 ? GREEN : "#dfe4d9" }} />}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 62 }}>
                      <div style={{
                        width: 29, height: 29, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12.5, fontWeight: 700,
                        background: done || active ? GREEN : "#e6e9e1",
                        color: done || active ? "#fff" : "#9aa097",
                        animation: active ? "sufpulse 2s infinite" : undefined,
                      }}>{done ? "✓" : i + 1}</div>
                      <span style={{ fontSize: 11, fontWeight: 600, marginTop: 8, textAlign: "center", color: done || active ? DARK : "#9aa097" }}>{label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: "center", marginTop: 18, fontSize: 12.5, color: GREEN, fontWeight: 600 }}>{t.est}</div>
          </div>

          <div style={{ marginTop: 18, border: "1px solid #eef0ea", borderRadius: 15, padding: "6px 16px" }}>
            {track.items.map((it, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid #f2f4ef", fontSize: 14 }}>
                <span style={{ color: "#3a423b" }}><span style={{ color: GREEN, fontWeight: 700 }}>{it.qty}×</span> {prod(it.id).name[lang]}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", fontSize: 15, fontWeight: 700, color: DARK }}><span>{t.total}</span><span>{money(track.total)}</span></div>
          </div>

          <button onClick={() => setScreen("menu")} style={{ marginTop: 20, width: "100%", background: DARK, color: "#fff", border: "none", padding: 15, borderRadius: 13, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t.backMenu}</button>
        </div>
      )}
    </div>
  );
}

const qtyBtn: CSSProperties = { width: 38, height: 38, border: "none", background: "#fff", borderRadius: 9, fontSize: 21, color: "#1b231d", cursor: "pointer", lineHeight: 0, boxShadow: "0 1px 2px rgba(0,0,0,.06)" };
const miniBtn: CSSProperties = { width: 30, height: 30, border: "none", background: "#fff", borderRadius: 8, fontSize: 18, color: "#1b231d", cursor: "pointer", lineHeight: 0 };
