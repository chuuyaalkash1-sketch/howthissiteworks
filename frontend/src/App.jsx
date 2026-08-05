import { useEffect, useMemo, useRef, useState } from "react";
import { articles } from "./articles";
import "./styles.css";
import WebGLFluid from "./WebGLFluid";

const projects = [
  { id: 1, title: "Knowledge base: programmer basics", path: "/knowledge", description: "Articles about the site, evaluation, registration, personal files.", accent: "#cfe8dc" },
  { id: 2, title: "WWM", path: "/shop", description: "List of outfits.", accent: "#f2dfd5" },
  { id: 3, title: "Set of simulations", path: "/simulations", description: "Ripple, parallax and mouse physics.", accent: "#dedcf2" },
];

const products = [
  ["青鳞拂雨", "Distinct", 2580, "snake", "An elegant ceremonial outfit with flowing green-blue layers and scale-inspired accents. The silhouette combines calm refinement with a mysterious, water-like mood."],
  ["紫萸香慢", "Base", 60, "flower", "A soft everyday set with floral details and a restrained palette. Light fabrics and delicate ornaments make it suitable for a calm, graceful wanderer style."],
  ["探梅逢春", "Delicate", 1280, "delicate", "A shadowed warrior set in black and gold, combining layered armor, a high scarf, and ornate details for a sharp, stealth-focused look."],
  ["银浦流云", "Resound", 8590, "butterfly", "A luxurious silver-toned ensemble with cloud and butterfly motifs. Long flowing elements create a dramatic effect in movement."],
  ["青锋映雪", "Battlepass", 1520, "current", "A cool battle-ready look built around sharp lines, pale tones and snow-inspired details. It balances practical structure with a refined finish."],
  ["风吟彼岸", "Harmony", 14400, "hands", "A theatrical outfit with layered fabric and expressive accessories. Its composition evokes wind, distant shores and a sense of ritual motion."],
  ["鬼手焚莲", "Harmony", 14400, "ghost", "A dark fantasy costume with strong contrast and lotus-inspired decoration. The look is designed to feel intense, mystical and slightly dangerous."],
  ["青霄掠影", "Distinct", 2580, "crimson", "A vivid martial outfit with crimson accents and a fast, sharp silhouette. Decorative elements emphasize speed and confidence."],
  ["明河载雪", "Distinct", 2580, "posy", "A pale, poetic ensemble inspired by starlight and fresh snow. Soft layers and floral ornaments create a serene appearance."],
  ["翰墨丹青", "Battlepass", 1520, "springs", "An artistic costume influenced by ink painting and classical color studies. Structured details are softened by flowing fabric and natural motifs."],
].map(([name, category, price, image, description], index) => ({
  id: index + 1,
  name,
  category,
  price,
  image,
  description,
}));

function useRoute() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = (next) => {
    window.history.pushState({}, "", next);
    setPath(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return [path, navigate];
}

function App() {
  const [path, navigate] = useRoute();
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem("demo_cart") || "[]"));
  const [wishlist, setWishlist] = useState(() => JSON.parse(localStorage.getItem("demo_wishlist") || "[]"));
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("access_token") || "");
  useEffect(() => {
    const syncAuth = () => setAuthToken(localStorage.getItem("access_token") || "");
    window.addEventListener("storage", syncAuth);
    window.addEventListener("auth-changed", syncAuth);
    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("auth-changed", syncAuth);
    };
  }, []);
  useEffect(() => localStorage.setItem("demo_cart", JSON.stringify(cart)), [cart]);
  useEffect(() => localStorage.setItem("demo_wishlist", JSON.stringify(wishlist)), [wishlist]);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="app-shell">
      <header className="global-header">
        <button className="logo-button" onClick={() => navigate("/")}>3 / S</button>
        <nav className="main-navigation">
          <button onClick={() => navigate("/")}>Catalog</button>
          <button onClick={() => navigate("/knowledge")}>Knowledge base</button>
          <button onClick={() => navigate("/shop")}>Shop</button>
          <button onClick={() => navigate("/simulations")}>Simulations</button>
          <button onClick={() => navigate("/files")}>Files</button>
          <button onClick={() => navigate("/shop/wishlist")}>♡ {wishlist.length}</button>
          <button className="cart-chip" onClick={() => navigate("/shop/cart")}>Cart · {cartCount}</button>
        </nav>
        <div className="auth-navigation">
          {!authToken ? <>
            <button className="sign-in-button" onClick={() => navigate("/account/signin")}>Sign In</button>
            <button className="sign-up-button" onClick={() => navigate("/account/signup")}>Sign Up</button>
          </> : <>
            <button className="profile-button" onClick={() => navigate("/account")}><span className="profile-dot">3S</span>My Profile</button>
            <button className="header-logout" onClick={() => { localStorage.removeItem("access_token"); window.dispatchEvent(new Event("auth-changed")); navigate("/"); }}>Log Out</button>
          </>}
        </div>
      </header>

      {path === "/" && <Home navigate={navigate} />}
      {path.startsWith("/knowledge") && <KnowledgeBase />}
      {path.startsWith("/account") && <AccountPage initialMode={path.endsWith("signup") ? "register" : "login"} onSuccess={() => navigate("/account")} />}
      {path === "/files" && <FileManager />}
      {path === "/shop" && <ShopHome navigate={navigate} />}
      {path === "/shop/catalog" && <Catalog navigate={navigate} setCart={setCart} wishlist={wishlist} setWishlist={setWishlist} />}
      {path.startsWith("/shop/product/") && <ProductPage id={Number(path.split("/").pop())} navigate={navigate} setCart={setCart} wishlist={wishlist} setWishlist={setWishlist} />}
      {path === "/shop/wishlist" && <Wishlist wishlist={wishlist} setWishlist={setWishlist} setCart={setCart} navigate={navigate} />}
      {path === "/shop/cart" && <Cart cart={cart} setCart={setCart} navigate={navigate} />}
      {path === "/shop/checkout" && <Checkout cart={cart} setCart={setCart} navigate={navigate} />}
      {path === "/simulations" && <SimulationHub navigate={navigate} />}
      {path === "/simulations/ripple" && <RipplePage />}
      {path === "/simulations/parallax" && <ParallaxPage />}
      {path === "/simulations/mouse-physics" && <MousePhysicsPage />}
    </div>
  );
}

function Home({ navigate }) {
  return <main className="portfolio-home">
    <section className="hero-panel">
      <p className="eyebrow">3/S - digital collection</p>
      <h1>Educational project</h1>
      <p>Knowledge basics, collections, interactive simulations in one space.</p>
    </section>
    <section className="project-grid">
      {projects.map((project) => <button key={project.id} className={`project-card ${project.path ? "ready" : "locked"}`} style={{ "--card-accent": project.accent }} onClick={() => project.path && navigate(project.path)}>
        <span className="project-number">{String(project.id).padStart(2, "0")}</span>
        <div><h2>{project.title}</h2><p>{project.description}</p></div>
        <span className="project-arrow">↗</span>
      </button>)}
    </section>
  </main>;
}

function KnowledgeBase() {
  const [selectedArticleId, setSelectedArticleId] = useState("overview");
  const [rating, setRating] = useState(389);
  const [statistics, setStatistics] = useState({ count: 0, average: null, minimum: 1, maximum: 777 });
  const [ratingMessage, setRatingMessage] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);
  const selectedArticle = useMemo(() => articles.find((article) => article.id === selectedArticleId) ?? articles[0], [selectedArticleId]);

  async function read(response) { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.detail || "Ошибка запроса"); return data; }
  async function loadRatings() { try { setStatistics(await read(await fetch("/api/ratings"))); } catch { setRatingMessage("Не удалось получить рейтинг."); } }
  useEffect(() => { loadRatings(); }, []);
  async function submitRating(event) { event.preventDefault(); const value = Number(rating); if (!Number.isInteger(value) || value < 1 || value > 777) { setRatingMessage("Введите целое число от 1 до 777."); return; } setRatingLoading(true); setRatingMessage(""); try { const data = await read(await fetch("/api/ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) })); setStatistics(data.statistics || statistics); setRatingMessage(`Спасибо. Оценка ${value} из 777 сохранена.`); } catch (error) { setRatingMessage(error.message); } finally { setRatingLoading(false); } }

  return <main className="knowledge-page">
    <div className="knowledge-layout">
      <aside className="knowledge-sidebar"><p className="eyebrow">KNOWLEDGE BASE</p>{articles.map((article) => <button key={article.id} className={article.id === selectedArticleId ? "active" : ""} onClick={() => setSelectedArticleId(article.id)}>{article.shortTitle}</button>)}</aside>
      <article className="knowledge-article"><h1>{selectedArticle.title}</h1><p className="lead">{selectedArticle.description}</p>{selectedArticle.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2>{section.image && <img src={section.image} alt={section.imageAlt ?? section.heading} />}{section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>)}</article>
    </div>
    <section className="knowledge-tools">
      <section className="rating-card"><p className="eyebrow">RATE THE SITE</p><h2>honest reaction</h2><form onSubmit={submitRating}><label htmlFor="rating-range">Your rating: <strong>{rating}</strong> / 777</label><input id="rating-range" type="range" min="1" max="777" value={rating} onChange={(e) => setRating(e.target.value)} /><input type="number" min="1" max="777" value={rating} onChange={(e) => setRating(e.target.value)} /><button className="primary" disabled={ratingLoading}>{ratingLoading ? "Saving…" : "Send the rating"}</button></form><div className="rating-stats"><div><span>Average</span><strong>{statistics.average ?? "—"}</strong></div><div><span>Ratings</span><strong>{statistics.count}</strong></div></div>{ratingMessage && <p className="status-message">{ratingMessage}</p>}</section>
      <div id="files"><FileManager embedded /></div>
    </section>
  </main>;
}

function AccountPage({ onSuccess, embedded = false, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem("access_token") || "");
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => setMode(initialMode), [initialMode]);
  async function read(response) { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.detail || "Ошибка запроса"); return data; }
  useEffect(() => { if (!token) return; fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } }).then(read).then((data) => { setUser(data); }).catch(() => { localStorage.removeItem("access_token"); setToken(""); window.dispatchEvent(new Event("auth-changed")); }); }, [token]);
  async function submitAuth(event) { event.preventDefault(); setMessage(""); try { const data = await read(await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) })); localStorage.setItem("access_token", data.access_token); setToken(data.access_token); setUser(data.user); window.dispatchEvent(new Event("auth-changed")); onSuccess(); } catch (error) { setMessage(error.message); } }
  function logout() { localStorage.removeItem("access_token"); setToken(""); setUser(null); window.dispatchEvent(new Event("auth-changed")); }

  if (embedded) return <section className="embedded-account"><div className="account-card"><p className="eyebrow">PERSONAL ACCOUNT</p>{!user ? <><h1>{mode === "login" ? "Sign In" : "Sign Up"}</h1><div className="segmented"><button onClick={() => setMode("login")}>Sign In</button><button onClick={() => setMode("register")}>Sign Up</button></div><form onSubmit={submitAuth}><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" minLength="3" required /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength="8" required /><button className="primary">Continue</button></form></> : <div className="account-title"><div><h1>{user.username}</h1><p>Your account is ready.</p></div><button onClick={logout}>Log Out</button></div>}{message && <p className="message">{message}</p>}</div></section>;

  return <main className="art-account-page">
    <section className="art-account-showcase">
      <div className="art-account-overlay">
        <button className="account-brand" onClick={() => window.history.back()}>3 / S</button>
        <span>Portfolio · E-commerce · Simulations</span>
      </div>
    </section>
    <section className="art-account-panel">
      {!user ? <div className="auth-card-modern">
        <div className="auth-card-heading"><p className="eyebrow">PERSONAL ACCOUNT</p><h2>{mode === "login" ? "Sign in to 3 / S" : "Create your account"}</h2><p>{mode === "login" ? "Welcome back." : "Create a profile."}</p></div>
        <div className="auth-mode-switch"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign In</button><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Sign Up</button></div>
        <form className="modern-auth-form" onSubmit={submitAuth}>
          <label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your username" minLength="3" autoComplete="username" required /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" minLength="8" autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>
          <button className="auth-submit">{mode === "login" ? "Sign In" : "Create Account"}</button>
        </form>
        <p className="auth-alternate">{mode === "login" ? "New to 3 / S?" : "Already have an account?"} <button onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Sign Up" : "Sign In"}</button></p>
        {message && <p className="message">{message}</p>}
      </div> : <div className="profile-dashboard">
        <div className="profile-cover"><div className="profile-avatar">{user.username.slice(0, 2).toUpperCase()}</div></div>
        <div className="profile-main"><p className="eyebrow">YOUR PROFILE</p><h2>{user.username}</h2><p className="profile-role">3 / S member</p><div className="profile-stats"><div><strong>♡</strong><span>Wishlist</span></div><div><strong>↑</strong><span>My files</span></div><div><strong>◌</strong><span>Simulations</span></div></div><div className="profile-actions"><button className="auth-submit" onClick={() => { window.history.pushState({}, "", "/files"); window.dispatchEvent(new PopStateEvent("popstate")); }}>Open My Files</button><button className="profile-secondary" onClick={logout}>Log Out</button></div></div>
      </div>}
    </section>
  </main>;
}
function FileManager({ embedded = false }) {
  const [token] = useState(() => localStorage.getItem("access_token") || "");
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState("");

  async function read(response) { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.detail || "Ошибка запроса"); return data; }
  async function loadFiles() { if (!token) return; try { const data = await read(await fetch("/api/my-files", { headers: { Authorization: `Bearer ${token}` } })); setFiles(data.files || []); } catch (error) { setMessage(error.message); } }
  useEffect(() => { loadFiles(); }, [token]);
  async function upload(event) { event.preventDefault(); const file = event.currentTarget.elements.file.files[0]; if (!file) return; const form = new FormData(); form.append("file", file); try { await read(await fetch("/api/uploads", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form })); event.currentTarget.reset(); setMessage("Файл загружен."); loadFiles(); } catch (error) { setMessage(error.message); } }
  async function remove(id) { try { await read(await fetch(`/api/my-files/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })); loadFiles(); } catch (error) { setMessage(error.message); } }
  async function download(file) { const response = await fetch(`/api/my-files/${file.id}/download`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) { setMessage("Не удалось скачать файл."); return; } const blob = await response.blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.original_name; a.click(); URL.revokeObjectURL(a.href); }

  return <section className={embedded ? "embedded-files" : "account-page"}>
    <div className="account-card file-manager-card">
      <p className="eyebrow">MY FILES</p>
      <h1>Upload files</h1>
      {!token ? <p>First, log in to your personal account, then open this section again.</p> : <>
        <form className="upload-bar" onSubmit={upload}><input name="file" type="file" required /><button className="primary">Upload a file</button></form>
        <div className="file-gallery">{files.map((file) => <article key={file.id}><div className="file-preview">{/\.(png|jpe?g|gif|webp)$/i.test(file.original_name) ? "ИЗОБРАЖЕНИЕ" : "ФАЙЛ"}</div><h3>{file.original_name}</h3><p>{Math.round(file.size / 1024)} КБ</p><div><button onClick={() => download(file)}>Скачать</button><button onClick={() => remove(file.id)}>Удалить</button></div></article>)}</div>
        {!files.length && <p className="empty-files">The files you uploaded will appear here.</p>}
      </>}
      {message && <p className="status-message">{message}</p>}
    </div>
  </section>;
}

function ShopHome({ navigate }) { return <main className="shop-home"><section className="shop-hero"><div><p className="eyebrow">WWM</p><h1>Wanderer's wardrobe</h1><p>Assemble your wanderer's style.</p><button className="primary" onClick={() => navigate("/shop/catalog")}>View the collection</button></div><div className="hero-silhouette">風</div></section><section className="shop-features"><div><span>01</span><h3>Great variability of outfits</h3><p>A collection of outfits for those who turn the path into their own style.</p></div><div><span>02</span><h3>Save what you love</h3><p>Add to the wishlist and quickly return to the outfits that you've hooked.</p></div><div><span>03</span><h3>Easy choice</h3><p>From inspiration to an order.</p></div></section></main>; }

function Catalog({ navigate, setCart, wishlist, setWishlist }) {
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("Все");
  const categories = ["All", ...new Set(products.map((p) => p.category))];
  const visible = products.filter((p) => (category === "Все" || p.category === category) && p.name.toLowerCase().includes(query.toLowerCase()));
  const add = (product) => setCart((current) => { const found = current.find((item) => item.id === product.id); return found ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }]; });
  const toggleWishlist = (product) => setWishlist((current) => current.some((item) => item.id === product.id) ? current.filter((item) => item.id !== product.id) : [...current, product]);
  return <main className="catalog-page"><section className="catalog-head"><div><p className="eyebrow">CURATED DIGITAL WARDROBE</p><h1>Outfits that you would want to try on.</h1></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Choose your style" /></section><div className="filters">{categories.map((item) => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div><section className="product-grid">{visible.map((product) => <article className="product-card" key={product.id}><div className={`product-visual ${product.image}`}><img src={`/shop/outfits/${product.image}.png`} alt={product.name} onError={(event) => { event.currentTarget.style.display = "none"; }} /><button className="wishlist-button" aria-label="Add to favorites" onClick={() => toggleWishlist(product)}>{wishlist.some((item) => item.id === product.id) ? "♥" : "♡"}</button><button className="product-open" onClick={() => navigate(`/shop/product/${product.id}`)}><span>{product.name}</span></button></div><div className="product-meta"><div><p>{product.category}</p><h2>{product.name}</h2></div><strong>{product.price} ₽</strong></div><button className="add-button" onClick={() => add(product)}>Add to cart</button></article>)}</section><p className="legal-note">Demo educational fan project.</p></main>;
}

function ProductPage({ id, navigate, setCart, wishlist, setWishlist }) { const product = products.find((p) => p.id === id) || products[0]; const add = () => setCart((current) => { const found = current.find((item) => item.id === product.id); return found ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }]; }); const wished = wishlist.some((item) => item.id === product.id); const toggleWishlist = () => setWishlist((current) => wished ? current.filter((item) => item.id !== product.id) : [...current, product]); return <main className="product-page"><div className="product-detail-visual"> <img src={`/shop/outfits/${product.image}.png`} alt={product.name} className="product-detail-full-image" /><span>{product.name}</span></div><section><p className="eyebrow">{product.category}</p><h1>{product.name}</h1><p className="product-price">{product.price} ₽</p><p>{product.description}</p><label>Option<select><option>Original</option><option>Dark</option><option>Light</option></select></label><button className="primary" onClick={add}>Add to cart</button><button className="soft-button" onClick={toggleWishlist}>{wished ? "♥ Favorites" : "♡ To wishlist"}</button><button onClick={() => navigate("/shop/catalog")}>Back to catalog</button></section></main>; }

function Wishlist({ wishlist, setWishlist, setCart, navigate }) { const add = (product) => setCart((current) => { const found = current.find((item) => item.id === product.id); return found ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }]; }); return <main className="catalog-page"><section className="catalog-head"><div><p className="eyebrow">WISHLIST</p><h1>Selected outfits.</h1></div></section>{wishlist.length === 0 ? <section className="empty-state"><h2>Wishlist is empty.</h2><p>Click on the heart in the catalog to save your favorites.</p><button className="primary" onClick={() => navigate("/shop/catalog")}>Go to the catalog</button></section> : <section className="product-grid wishlist-grid">{wishlist.map((product) => <article className="product-card" key={product.id}><div className={`product-visual ${product.image}`}><img src={`/shop/outfits/${product.image}.png`} alt={product.name} onError={(event) => { event.currentTarget.style.display = "none"; }} /><button className="wishlist-button" onClick={() => setWishlist((current) => current.filter((item) => item.id !== product.id))}>♥</button><button className="product-open" onClick={() => navigate(`/shop/product/${product.id}`)}><span>{product.name}</span></button></div><div className="product-meta"><div><p>{product.category}</p><h2>{product.name}</h2></div><strong>{product.price} ₽</strong></div><button className="add-button" onClick={() => add(product)}>Add to cart</button></article>)}</section>}</main>; }

function Cart({ cart, setCart, navigate }) { const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0); return <main className="cart-page"><h1>Cart</h1>{cart.length === 0 ? <p>Cart is empty.</p> : <>{cart.map((item) => <article key={item.id}><div className={`cart-thumb ${item.image}`} /><div><h2>{item.name}</h2><p>{item.price} ₽</p></div><input type="number" min="1" value={item.quantity} onChange={(e) => setCart((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity: Number(e.target.value) } : entry))} /><button onClick={() => setCart((current) => current.filter((entry) => entry.id !== item.id))}>Delete</button></article>)}<div className="cart-total"><span>Total:</span><strong>{total} ₽</strong></div><button className="primary" onClick={() => navigate("/shop/checkout")}>Place an order</button></>}</main>; }

function Checkout({ cart, setCart, navigate }) {
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!processing) return undefined;
    const timer = window.setTimeout(() => {
      setCart([]);
      setProcessing(false);
      setDone(true);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [processing, setCart]);

  if (done) {
    return <main className="checkout-page checkout-success"><h1>The order has been placed</h1><p>хаха наебал ты не уплотиш это все уловки ловушка</p><button className="primary" onClick={() => navigate("/")}>Go to the main page</button></main>;
  }

  if (processing) {
    return <main className="checkout-page payment-loading-page">
      <section className="payment-loading-card">
        <div className="payment-loading-copy">
          <p className="eyebrow">SECURE PAYMENT</p>
          <h1>Processing your order</h1>
          <p>Move the cursor through the smoke while the payment window is loading.</p>
          <div className="payment-progress"><span /></div>
        </div>
        <div className="payment-fluid-window"><WebGLFluid compact /></div>
      </section>
    </main>;
  }

  return <main className="checkout-page"><h1>Making an order</h1><form onSubmit={(event) => { event.preventDefault(); setProcessing(true); }}><input placeholder="Name" required /><input type="email" placeholder="Email" required /><input placeholder="Promo code" /><button className="primary" disabled={!cart.length}>Confirm the order</button></form></main>;
}

function SimulationHub({ navigate }) { const sims = [["Ripple", "/simulations/ripple", "Waves from movement and clicks"], ["Parallax", "/simulations/parallax", "Layer depth and cursor movement"], ["Mouse Physics", "/simulations/mouse-physics", "Springy objects"]]; return <main className="sim-hub"><p className="eyebrow">LAB / INTERACTION</p><h1>Set of simulations</h1><section>{sims.map(([name, route, text], index) => <button key={name} onClick={() => navigate(route)}><span>0{index + 1}</span><div><h2>{name}</h2><p>{text}</p></div><b>↗</b></button>)}</section></main>; }

function RipplePage() { const [ripples, setRipples] = useState([]); const add = (e) => { const rect = e.currentTarget.getBoundingClientRect(); const ripple = { id: Date.now(), x: e.clientX - rect.left, y: e.clientY - rect.top }; setRipples((r) => [...r.slice(-12), ripple]); }; return <main className="effect-page ripple-stage" onPointerMove={add} onPointerDown={add}><div><p className="eyebrow">RIPPLE</p><h1>Move the mouse</h1></div>{ripples.map((r) => <span key={r.id} style={{ left: r.x, top: r.y }} />)}</main>; }

function ParallaxPage() { const ref = useRef(null); const move = (e) => { const rect = ref.current.getBoundingClientRect(); const x = (e.clientX - rect.left) / rect.width - .5; const y = (e.clientY - rect.top) / rect.height - .5; ref.current.style.setProperty("--mx", x); ref.current.style.setProperty("--my", y); }; return <main className="effect-page parallax-stage" ref={ref} onPointerMove={move}><div className="parallax-layer layer-one">PARALLAX</div><div className="parallax-layer layer-two">MOVE</div><div className="parallax-layer layer-three">CURSOR</div></main>; }

function MousePhysicsPage() { const [target, setTarget] = useState({ x: innerWidth / 2, y: innerHeight / 2 }); const [pos, setPos] = useState(target); useEffect(() => { let frame; let current = { ...pos }; let velocity = { x: 0, y: 0 }; const tick = () => { velocity.x += (target.x - current.x) * .025; velocity.y += (target.y - current.y) * .025; velocity.x *= .82; velocity.y *= .82; current.x += velocity.x; current.y += velocity.y; setPos({ ...current }); frame = requestAnimationFrame(tick); }; tick(); return () => cancelAnimationFrame(frame); }, [target]); return <main className="effect-page physics-stage" onPointerMove={(e) => setTarget({ x: e.clientX, y: e.clientY })}><h1>ДЭНЧИК</h1><div className="physics-ball" style={{ transform: `translate(${pos.x - 45}px, ${pos.y - 90}px)` }} /></main>; }



export default App;
