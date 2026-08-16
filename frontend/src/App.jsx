import { useEffect, useMemo, useRef, useState } from "react";
import { articles } from "./articles";
import "./styles.css";
import WebGLFluid from "./WebGLFluid";

const OBSERVABILITY_URL = "https://threes-observability.onrender.com";
const KIBANA_URL = "https://threes-kibana-6ul4.onrender.com";

const projects = [
  { id: 1, title: "Knowledge base", path: "/knowledge", description: "Programmer basics, architecture notes and project documentation.", image: "/project-covers/knowledge.svg", accent: "#cfe8dc" },
  { id: 2, title: "WWM wardrobe", path: "/shop", description: "A demo storefront with outfits, wishlist, cart and authenticated checkout.", image: "/project-covers/shop.svg", accent: "#f2dfd5" },
  { id: 3, title: "Simulation lab", path: "/simulations", description: "Parallax, ripple, physics, constellation, kaleidoscope and orbit scenes.", image: "/project-covers/simulations.svg", accent: "#dedcf2" },
];

const products = [
  ["青鳞拂雨", "Distinct", 2580, "snake", "An elegant ceremonial outfit with flowing green-blue layers and scale-inspired accents. The silhouette combines calm refinement with a mysterious, water-like mood."],
  ["紫萸香慢", "Base", 60, "flower", "A soft everyday set with floral details and a restrained palette. Light fabrics and delicate ornaments make it suitable for a calm, graceful wanderer style."],
  ["探梅逢春", "Delicate", 1280, "delicate", "A spring-inspired costume with fine embroidery and airy layers. The design suggests plum blossoms, renewal and quiet elegance."],
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

function ResilientImage({ sources, alt, className = "", fallbackLabel = "Image unavailable" }) {
  const list = Array.isArray(sources) ? sources : [sources];
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => { setIndex(0); setFailed(false); }, [JSON.stringify(list)]);

  if (failed || !list[index]) {
    return <div className={`image-fallback ${className}`} role="img" aria-label={alt}><span>{fallbackLabel}</span></div>;
  }

  return <img className={className} src={list[index]} alt={alt} loading="lazy" onError={() => {
    if (index < list.length - 1) setIndex((current) => current + 1);
    else setFailed(true);
  }} />;
}

function productSources(image) {
  return [
    `/shop/outfits/${image}.png`,
    `/shop/outfits/${image}.webp`,
    `/shop/outfits/${image}.jpg`,
    `/shop/outfits/${image}.jpeg`,
  ];
}

function emitBrowserEvent(event, fields = {}) {
  const payload = {
    service: "frontend",
    event,
    level: "INFO",
    path: window.location.pathname,
    href: window.location.href,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    ...fields,
  };

  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  };

  fetch("/api/observability/events", options)
    .then((response) => {
      if (!response.ok) throw new Error(`gateway observability ${response.status}`);
    })
    .catch(() => {
      fetch(`${OBSERVABILITY_URL}/events`, options).catch(() => {});
    });
}

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


function getPageName(path) {
  if (path.startsWith("/knowledge")) return "knowledge";
  if (path.startsWith("/shop")) return "shop";
  if (path.startsWith("/simulations")) return "simulations";
  if (path.startsWith("/account")) return "account";
  if (path.startsWith("/files")) return "files";
  return "home";
}

function App() {
  const [path, navigate] = useRoute();
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem("demo_cart") || "[]"));
  const [wishlist, setWishlist] = useState(() => JSON.parse(localStorage.getItem("demo_wishlist") || "[]"));
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("access_token") || "");
  const [cartNotice, setCartNotice] = useState(null);
  const cartNoticeTimer = useRef(null);

  function showCartNotice(product) {
    window.clearTimeout(cartNoticeTimer.current);
    setCartNotice(product);
    cartNoticeTimer.current = window.setTimeout(() => setCartNotice(null), 2400);
  }

  const pageName = getPageName(path);
  useEffect(() => () => window.clearTimeout(cartNoticeTimer.current), []);

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

  useEffect(() => {
    emitBrowserEvent("route_changed", { route: path, page: pageName });
  }, [path, pageName]);

  useEffect(() => {
    const onClick = (event) => {
      const control = event.target?.closest?.("button, a, [data-track]");
      if (!control) return;
      const label = (control.getAttribute("aria-label") || control.dataset.track || control.textContent || control.tagName)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      emitBrowserEvent("ui_click", {
        page: getPageName(window.location.pathname),
        control: label || "control",
        element: control.tagName.toLowerCase(),
      });
    };

    const onSubmit = (event) => {
      const form = event.target;
      const formName = form?.dataset?.track || form?.className || form?.getAttribute?.("name") || "form";
      emitBrowserEvent("form_submit", {
        page: getPageName(window.location.pathname),
        form: String(formName).slice(0, 120),
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  useEffect(() => {
    const onError = (event) => emitBrowserEvent("browser_error", {
      level: "ERROR",
      message: event.message || "Unknown browser error",
    });
    const onUnhandled = (event) => emitBrowserEvent("unhandled_rejection", {
      level: "ERROR",
      message: String(event.reason || "Unhandled promise rejection"),
    });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className={`app-shell page-${pageName}`} data-page={pageName} data-route={path}>
      <header className="global-header">
        <button className="logo-button" onClick={() => navigate("/")}>3 / S</button>
        <nav className="main-navigation">
          <button onClick={() => navigate("/")}>Catalog</button>
          <button onClick={() => navigate("/knowledge")}>Knowledge base</button>
          <button onClick={() => navigate("/shop")}>Shop</button>
          <button onClick={() => navigate("/simulations")}>Simulations</button>
          <button onClick={() => navigate("/files")}>Files</button>
          {authToken && <button onClick={() => navigate("/shop/wishlist")}>♡ {wishlist.length}</button>}
          {authToken && <button className="cart-chip" onClick={() => navigate("/shop/cart")}>Cart · {cartCount}</button>}
        </nav>
        <div className="auth-navigation">
          {!authToken ? <>
            <button className="sign-in-button" onClick={() => navigate("/account/signin")}>Sign In</button>
            <button className="sign-up-button" onClick={() => navigate("/account/signup")}>Sign Up</button>
          </> : <>
            <button className="profile-button" onClick={() => navigate("/account")}><span className="profile-dot">3S</span>My Profile</button>
            <button className="header-logout" onClick={() => { localStorage.removeItem("access_token"); localStorage.removeItem("current_user"); window.dispatchEvent(new Event("auth-changed")); navigate("/"); }}>Log Out</button>
          </>}
        </div>
      </header>

      {path === "/" && <ObservabilityStrip currentPath={path} />}

      {path === "/" && <Home navigate={navigate} />}
      {path.startsWith("/knowledge") && <KnowledgeBase navigate={navigate} />}
      {path.startsWith("/account") && <AccountPage initialMode={path.endsWith("signup") ? "register" : "login"} onSuccess={() => navigate("/account")} />}
      {path === "/files" && <FileManager />}
      {path === "/shop" && <ShopHome navigate={navigate} />}
      {path === "/shop/catalog" && <Catalog navigate={navigate} setCart={setCart} wishlist={wishlist} setWishlist={setWishlist} authToken={authToken} onCartAdded={showCartNotice} />}
      {path.startsWith("/shop/product/") && <ProductPage id={Number(path.split("/").pop())} navigate={navigate} setCart={setCart} wishlist={wishlist} setWishlist={setWishlist} authToken={authToken} onCartAdded={showCartNotice} />}
      {path === "/shop/wishlist" && <Wishlist wishlist={wishlist} setWishlist={setWishlist} setCart={setCart} navigate={navigate} authToken={authToken} onCartAdded={showCartNotice} />}
      {path === "/shop/cart" && <Cart cart={cart} setCart={setCart} navigate={navigate} authToken={authToken} />}
      {path === "/shop/checkout" && <Checkout cart={cart} setCart={setCart} navigate={navigate} authToken={authToken} />}
      {path === "/simulations" && <SimulationHub navigate={navigate} />}
      {path === "/simulations/ripple" && <RipplePage />}
      {path === "/simulations/parallax" && <ParallaxPage />}
      {path === "/simulations/mouse-physics" && <MousePhysicsPage />}
      {path === "/simulations/constellation" && <ConstellationPage />}
      {path === "/simulations/kaleidoscope" && <KaleidoscopePage />}
      {path === "/simulations/orbits" && <OrbitPage />}
      {path === "/simulations/fluid-lab" && <FluidLab />}

      {cartNotice && <div className="cart-toast" role="status" aria-live="polite">
        <div className="cart-toast-icon">✓</div>
        <div className="cart-toast-copy">
          <small>ADDED TO CART</small>
          <strong>{cartNotice.name}</strong>
          <span>{cartNotice.price} ₽</span>
        </div>
        <button type="button" onClick={() => navigate("/shop/cart")}>View cart</button>
      </div>}
    </div>
  );
}

function Home({ navigate }) {
  return <main className="portfolio-home">
    <section className="hero-panel">
      <p className="eyebrow">3/S · educational collection</p>
      <h1>Educational project.</h1>
    </section>
    <section className="project-grid project-grid-with-images">
      {projects.map((project) => <button key={project.id} className="project-card project-card-visual ready" style={{ "--card-accent": project.accent }} onClick={() => navigate(project.path)}>
        <div className="project-cover">
          <ResilientImage sources={project.image} alt={`${project.title} preview`} fallbackLabel={project.title} />
          <span className="project-number">{String(project.id).padStart(2, "0")}</span>
        </div>
        <div className="project-copy"><h2>{project.title}</h2><p>{project.description}</p></div>
        <span className="project-arrow">↗</span>
      </button>)}
    </section>
  </main>;
}

function KnowledgeBase({ navigate }) {
  const [selectedArticleId, setSelectedArticleId] = useState("overview");
  const [rating, setRating] = useState(389);
  const [statistics, setStatistics] = useState({ count: 0, average: null, minimum: 1, maximum: 777 });
  const [ratingMessage, setRatingMessage] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);
  const selectedArticle = useMemo(() => articles.find((article) => article.id === selectedArticleId) ?? articles[0], [selectedArticleId]);

  async function read(response) { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.detail || "Request failed"); return data; }
  async function loadRatings() { try { setStatistics(await read(await fetch("/api/ratings"))); } catch { setRatingMessage("Could not load rating statistics."); } }
  useEffect(() => { loadRatings(); }, []);
  async function submitRating(event) { event.preventDefault(); const value = Number(rating); if (!Number.isInteger(value) || value < 1 || value > 777) { setRatingMessage("Enter a whole number from 1 to 777."); return; } setRatingLoading(true); setRatingMessage(""); try { const data = await read(await fetch("/api/ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) })); setStatistics(data.statistics || statistics); setRatingMessage(`Thank you. Your rating of ${value} / 777 was saved.`); } catch (error) { setRatingMessage(error.message); } finally { setRatingLoading(false); } }

  return <main className="knowledge-page">
    <div className="knowledge-layout">
      <aside className="knowledge-sidebar"><p className="eyebrow">KNOWLEDGE BASE</p>{articles.map((article) => <button key={article.id} className={article.id === selectedArticleId ? "active" : ""} onClick={() => setSelectedArticleId(article.id)}>{article.shortTitle}</button>)}</aside>
      <article className="knowledge-article"><h1>{selectedArticle.title}</h1><p className="lead">{selectedArticle.description}</p>{selectedArticle.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2>{section.image && <img src={section.image} alt={section.imageAlt ?? section.heading} />}{section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>)}</article>
    </div>
    <section className="knowledge-tools">
      <section className="rating-card"><p className="eyebrow">RATE THE SITE</p><h2>Site rating</h2><form onSubmit={submitRating}><label htmlFor="rating-range">Your rating: <strong>{rating}</strong> / 777</label><input id="rating-range" type="range" min="1" max="777" value={rating} onChange={(e) => setRating(e.target.value)} /><input type="number" min="1" max="777" value={rating} onChange={(e) => setRating(e.target.value)} /><button className="primary" disabled={ratingLoading}>{ratingLoading ? "Saving..." : "Submit rating"}</button></form><div className="rating-stats"><div><span>Average</span><strong>{statistics.average ?? "—"}</strong></div><div><span>Ratings</span><strong>{statistics.count}</strong></div></div>{ratingMessage && <p className="status-message">{ratingMessage}</p>}</section>
      <section className="knowledge-file-shortcut"><p className="eyebrow">PERSONAL FILES</p><h2>Upload files</h2><p>File upload is available after sign in.</p><button className="primary" onClick={() => navigate("/files")}>Open file upload</button></section>
    </section>
  </main>;
}

function AccountPage({ onSuccess, embedded = false, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(() => localStorage.getItem("access_token") || "");
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("current_user") || "null");
    } catch {
      return null;
    }
  });
  const [message, setMessage] = useState("");

  useEffect(() => setMode(initialMode), [initialMode]);

  async function read(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  }

  useEffect(() => {
    if (!token) return;

    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(read)
      .then((data) => {
        const currentUser = data?.user || data;
        if (currentUser?.username) {
          setUser(currentUser);
          localStorage.setItem("current_user", JSON.stringify(currentUser));
        }
      })
      .catch(() => {
        // Keep the authenticated UI usable if /me is temporarily unavailable.
      });
  }, [token]);

  async function submitAuth(event) {
    event.preventDefault();
    setMessage("");

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";

      const data = await read(await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      }));

      const accessToken =
        data.access_token ||
        data.token ||
        data.jwt ||
        "";

      if (!accessToken) {
        console.error("Auth response:", data);
        throw new Error("Auth service returned no token.");
      }

      const currentUser =
        data.user?.username
          ? data.user
          : { username: username.trim() };

      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("current_user", JSON.stringify(currentUser));

      setToken(accessToken);
      setUser(currentUser);

      window.dispatchEvent(new Event("auth-changed"));
      onSuccess();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("current_user");
    setToken("");
    setUser(null);
    window.dispatchEvent(new Event("auth-changed"));
  }

  if (embedded) return <section className="embedded-account"><div className="account-card"><p className="eyebrow">PERSONAL ACCOUNT</p>{!user ? <><h1>{mode === "login" ? "Sign In" : "Sign Up"}</h1><div className="segmented"><button onClick={() => setMode("login")}>Sign In</button><button onClick={() => setMode("register")}>Sign Up</button></div><form onSubmit={submitAuth}><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" minLength="3" required /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" minLength="8" required /><button className="primary">Continue</button></form></> : <div className="account-title"><div><h1>{user.username}</h1><p>Your account is ready.</p></div><button onClick={logout}>Log Out</button></div>}{message && <p className="message">{message}</p>}</div></section>;

  return <main className="art-account-page">
    <section className="art-account-showcase">
      <div className="art-account-overlay">
        <button className="account-brand" onClick={() => window.history.back()}>3 / S</button>
        <span>Portfolio · Marketplace · Simulations</span>
      </div>
    </section>
    <section className="art-account-panel">
      {!user ? <div className="auth-card-modern">
        <div className="auth-card-heading"><p className="eyebrow">PERSONAL ACCOUNT</p><h2>{mode === "login" ? "Sign in to 3 / S" : "Create your account"}</h2><p>{mode === "login" ? "Welcome back. Enter your details to continue." : "Create a profile to save your activity and manage files."}</p></div>
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
  const [selectedFileName, setSelectedFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  async function read(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Request failed");
    return data;
  }

  async function loadFiles() {
    if (!token) return;
    try {
      const data = await read(await fetch("/api/my-files", {
        headers: { Authorization: `Bearer ${token}` },
      }));
      setFiles(data.files || []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => { loadFiles(); }, [token]);

  async function upload(event) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const inputElement = fileInputRef.current;
    const file = inputElement?.files?.[0];

    if (!file || uploading) return;

    const body = new FormData();
    body.append("file", file);

    setUploading(true);
    setMessage("");

    try {
      await read(await fetch("/api/uploads", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      }));

      formElement?.reset();
      if (inputElement) inputElement.value = "";
      setSelectedFileName("");
      setMessage("File uploaded.");

      await loadFiles();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  }

  async function remove(id) {
    try {
      await read(await fetch(`/api/my-files/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }));
      setMessage("File deleted.");
      await loadFiles();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function download(file) {
    try {
      const response = await fetch(`/api/my-files/${file.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.original_name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return <section className={embedded ? "embedded-files" : "account-page"}>
    <div className="account-card file-manager-card">
      <p className="eyebrow">MY FILES</p>
      <h1>Upload files</h1>

      {!token ? <p>Sign in to upload and manage files.</p> : <>
        <form className="upload-bar file-upload-form" onSubmit={upload}>
          <input
            ref={fileInputRef}
            id="personal-file-input"
            name="file"
            type="file"
            className="native-file-input"
            required
            onChange={(event) => setSelectedFileName(event.target.files?.[0]?.name || "")}
          />

          <label className="file-picker-button" htmlFor="personal-file-input">
            Choose file
          </label>

          <span className={`selected-file-name ${selectedFileName ? "has-file" : ""}`}>
            {selectedFileName || "No file selected"}
          </span>

          <button className="primary upload-file-button" disabled={!selectedFileName || uploading}>
            {uploading ? "Uploading..." : "Upload file"}
          </button>
        </form>

        <div className="file-gallery">
          {files.map((file) => {
            const isImage = /\.(png|jpe?g|gif|webp)$/i.test(file.original_name);
            return <article key={file.id} className="file-card">
              <div className="file-preview">
                <span>{isImage ? "IMAGE" : "FILE"}</span>
              </div>

              <h3>{file.original_name}</h3>
              <p>{Math.max(1, Math.round(file.size / 1024))} KB</p>

              <div className="file-card-actions">
                <button className="file-action-button" type="button" onClick={() => download(file)}>
                  Download
                </button>
                <button className="file-action-button danger" type="button" onClick={() => remove(file.id)}>
                  Delete
                </button>
              </div>
            </article>;
          })}
        </div>

        {!files.length && <p className="empty-files">Your uploaded files will appear here.</p>}
      </>}

      {message && <p className="status-message">{message}</p>}
    </div>
  </section>;
}

function ShopHome({ navigate }) { return <main className="shop-home"><section className="shop-hero"><div><p className="eyebrow">WWM</p><h1>Wardrobe catalog</h1><p>Outfits, wishlist, cart and protected checkout.</p><button className="primary" onClick={() => navigate("/shop/catalog")}>Open catalog</button></div><div className="hero-silhouette">風</div></section><section className="shop-features"><div><span>01</span><h3>Catalog</h3><p>A collection of outfits for those who turn the path into their own style.</p></div><div><span>02</span><h3>Wishlist</h3><p>Add to the wishlist and quickly return to the outfits that you've hooked.</p></div><div><span>03</span><h3>Checkout</h3><p>From inspiration to an order. Orders are available only after sign in.</p></div></section></main>; }

function Catalog({ navigate, setCart, wishlist, setWishlist, authToken, onCartAdded }) {
  const [query, setQuery] = useState(""); const [category, setCategory] = useState("All");
  const categories = ["All", ...new Set(products.map((p) => p.category))];
  const visible = products.filter((p) => (category === "All" || p.category === category) && p.name.toLowerCase().includes(query.toLowerCase()));
  const add = (product) => { setCart((current) => { const found = current.find((item) => item.id === product.id); return found ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }]; }); onCartAdded?.(product); };
  const toggleWishlist = (product) => setWishlist((current) => current.some((item) => item.id === product.id) ? current.filter((item) => item.id !== product.id) : [...current, product]);
  return <main className="catalog-page"><section className="catalog-head"><div><p className="eyebrow">WARDROBE</p><h1>Outfit catalog</h1></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search outfits" /></section><div className="filters">{categories.map((item) => <button className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div><section className="product-grid">{visible.map((product) => <article className="product-card" key={product.id}><div className={`product-visual ${product.image}`}><ResilientImage sources={productSources(product.image)} alt={product.name} className="product-card-image" fallbackLabel={product.name} /><button className="wishlist-button" aria-label="Add to favorites" onClick={() => toggleWishlist(product)}>{wishlist.some((item) => item.id === product.id) ? "♥" : "♡"}</button><button className="product-open" onClick={() => navigate(`/shop/product/${product.id}`)}><span>{product.name}</span></button></div><div className="product-meta"><div><p>{product.category}</p><h2>{product.name}</h2></div><strong>{product.price} ₽</strong></div>{authToken && <button className="add-button" onClick={() => add(product)}>Add to cart</button>}</article>)}</section></main>;
}

function ProductPage({ id, navigate, setCart, wishlist, setWishlist, authToken, onCartAdded }) {
  const product = products.find((item) => item.id === id) || products[0];
  const wished = wishlist.some((item) => item.id === product.id);

  const add = () => {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found
        ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { ...product, quantity: 1 }];
    });
    onCartAdded?.(product);
  };

  const toggleWishlist = () => setWishlist((current) =>
    wished ? current.filter((item) => item.id !== product.id) : [...current, product]
  );

  return <main className="product-page">
    <div className="product-detail-visual">
      <ResilientImage sources={productSources(product.image)} alt={product.name} className="product-detail-full-image" fallbackLabel={product.name} />
      <span>{product.name}</span>
    </div>
    <section>
      <p className="eyebrow">{product.category}</p>
      <h1>{product.name}</h1>
      <p className="product-price">{product.price} ₽</p>
      <p>{product.description}</p>
      <label>Option<select><option>Original</option><option>Dark</option><option>Light</option></select></label>
      {authToken && <button className="primary" onClick={add}>Add to cart</button>}
      <button className="soft-button" onClick={toggleWishlist}>{wished ? "♥ Favorites" : "♡ To wishlist"}</button>
      <button className="secondary-button" onClick={() => navigate("/shop/catalog")}>Back to catalog</button>
    </section>
  </main>;
}

function Wishlist({ wishlist, setWishlist, setCart, navigate, authToken, onCartAdded }) { const add = (product) => { setCart((current) => { const found = current.find((item) => item.id === product.id); return found ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { ...product, quantity: 1 }]; }); onCartAdded?.(product); }; return <main className="catalog-page"><section className="catalog-head"><div><p className="eyebrow">WISHLIST</p><h1>Selected outfits.</h1></div></section>{wishlist.length === 0 ? <section className="empty-state"><h2>Wishlist is empty.</h2><p>Click on the heart in the catalog to save your favorites.</p><button className="primary" onClick={() => navigate("/shop/catalog")}>Go to the catalog</button></section> : <section className="product-grid wishlist-grid">{wishlist.map((product) => <article className="product-card" key={product.id}><div className={`product-visual ${product.image}`}><ResilientImage sources={productSources(product.image)} alt={product.name} className="product-card-image" fallbackLabel={product.name} /><button className="wishlist-button" onClick={() => setWishlist((current) => current.filter((item) => item.id !== product.id))}>♥</button><button className="product-open" onClick={() => navigate(`/shop/product/${product.id}`)}><span>{product.name}</span></button></div><div className="product-meta"><div><p>{product.category}</p><h2>{product.name}</h2></div><strong>{product.price} ₽</strong></div>{authToken && <button className="add-button" onClick={() => add(product)}>Add to cart</button>}</article>)}</section>}</main>; }

function Cart({ cart, setCart, navigate, authToken }) { const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0); return <main className="cart-page"><h1>Cart</h1>{cart.length === 0 ? <p>Cart is empty.</p> : <>{cart.map((item) => <article key={item.id}><div className={`cart-thumb ${item.image}`}><ResilientImage sources={productSources(item.image)} alt={item.name} fallbackLabel={item.name} /></div><div><h2>{item.name}</h2><p>{item.price} ₽</p></div><input type="number" min="1" value={item.quantity} onChange={(e) => setCart((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity: Number(e.target.value) } : entry))} /><button className="secondary-button" onClick={() => setCart((current) => current.filter((entry) => entry.id !== item.id))}>Delete</button></article>)}<div className="cart-total"><span>Total:</span><strong>{total} ₽</strong></div>{authToken && <button className="primary" onClick={() => navigate("/shop/checkout")}>Place an order</button>}</>}</main>; }

function Checkout({ cart, setCart, navigate, authToken }) {
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");

  if (!authToken) return <main className="checkout-page"><section className="auth-required"><p className="eyebrow">ACCOUNT REQUIRED</p><h1>Sign in to continue</h1><p>Checkout is available only for registered users.</p><button className="primary" onClick={() => navigate("/account/signin")}>Sign In</button></section></main>;

  async function submitOrder(event) {
    event.preventDefault();
    if (!cart.length || processing) return;
    setError("");
    setProcessing(true);
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    try {
      const response = await fetch("/api/commerce/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ items: cart, total }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Order service is unavailable.");
      setOrderId(data.order_id || "accepted");
      window.setTimeout(() => { setCart([]); setProcessing(false); setDone(true); }, 2600);
    } catch (requestError) {
      setProcessing(false);
      setError(requestError.message);
    }
  }

  if (done) return <main className="checkout-page checkout-success"><section className="checkout-result-card"><p className="eyebrow">ORDER ACCEPTED</p><h1>The order has been placed</h1><p>Order ID: <strong>{orderId}</strong></p><button className="primary" onClick={() => navigate("/")}>Go to the main page</button></section></main>;

  if (processing) return <main className="payment-loading-page">
    <div className="payment-smoke-background"><WebGLFluid compact quality="high" /></div>
    <section className="payment-loading-card"><div className="payment-loading-copy"><p className="eyebrow">ORDER PROCESSING</p><h1>Processing your order</h1><p>The order is being validated.</p><div className="payment-progress"><span /></div></div></section>
  </main>;

  return <main className="checkout-page"><h1>Making an order</h1><form onSubmit={submitOrder}><input placeholder="Name" required /><input type="email" placeholder="Email" required /><input placeholder="Promo code" />{error && <p className="message">{error}</p>}<button className="primary" disabled={!cart.length || processing}>Confirm the order</button></form></main>;
}

function SimulationHub({ navigate }) {
  const sims = [
    ["Ripple", "/simulations/ripple", "Waves that bloom from every movement"],
    ["Parallax Garden", "/simulations/parallax", "A layered luminous scene that follows your cursor"],
    ["Mouse Physics", "/simulations/mouse-physics", "Springy objects with momentum"],
    ["Constellation", "/simulations/constellation", "Connect a living field of stars"],
    ["Kaleidoscope", "/simulations/kaleidoscope", "Paint mirrored light patterns"],
    ["Orbit Playground", "/simulations/orbits", "Pull planets into changing paths"],
    ["Fluid Lab", "/simulations/fluid-lab", "WebGL smoke with adjustable brightness, force, swirl and lifetime"],
      ];
  return <main className="sim-hub"><p className="eyebrow">LAB / INTERACTION</p><h1>Interactive simulations</h1><section>{sims.map(([name, route, text], index) => <button key={name} onClick={() => navigate(route)}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{name}</h2><p>{text}</p></div><b>↗</b></button>)}</section></main>;
}

function RipplePage() { const [ripples, setRipples] = useState([]); const add = (e) => { const rect = e.currentTarget.getBoundingClientRect(); const ripple = { id: `${Date.now()}-${Math.random()}`, x: e.clientX - rect.left, y: e.clientY - rect.top }; setRipples((r) => [...r.slice(-18), ripple]); }; return <main className="effect-page ripple-stage" onPointerMove={add} onPointerDown={add}><div><p className="eyebrow">RIPPLE</p><h1>Move the mouse</h1></div>{ripples.map((r) => <span key={r.id} style={{ left: r.x, top: r.y }} />)}</main>; }

function ParallaxPage() {
  const ref = useRef(null);
  const move = (e) => { const rect = ref.current.getBoundingClientRect(); const x = (e.clientX - rect.left) / rect.width - .5; const y = (e.clientY - rect.top) / rect.height - .5; ref.current.style.setProperty("--mx", x); ref.current.style.setProperty("--my", y); };
  return <main className="effect-page parallax-stage" ref={ref} onPointerMove={move} onPointerLeave={() => { ref.current.style.setProperty("--mx", 0); ref.current.style.setProperty("--my", 0); }}>
    <div className="parallax-aurora aurora-a" /><div className="parallax-aurora aurora-b" />
    <div className="parallax-stars">{Array.from({ length: 34 }, (_, i) => <i key={i} style={{ "--x": `${(i * 37) % 100}%`, "--y": `${(i * 61) % 100}%`, "--d": `${20 + (i % 7) * 10}px` }} />)}</div>
    <div className="parallax-card card-back"><span>DEPTH</span></div>
    <div className="parallax-card card-mid"><span>LIGHT</span></div>
    <div className="parallax-card card-front"><p className="eyebrow">PARALLAX GARDEN</p><h1>Follow the light</h1><p>Move slowly. Every layer responds at a different depth.</p></div>
  </main>;
}

function MousePhysicsPage() { const [target, setTarget] = useState({ x: innerWidth / 2, y: innerHeight / 2 }); const [pos, setPos] = useState(target); useEffect(() => { let frame; let current = { ...pos }; let velocity = { x: 0, y: 0 }; const tick = () => { velocity.x += (target.x - current.x) * .025; velocity.y += (target.y - current.y) * .025; velocity.x *= .82; velocity.y *= .82; current.x += velocity.x; current.y += velocity.y; setPos({ ...current }); frame = requestAnimationFrame(tick); }; tick(); return () => cancelAnimationFrame(frame); }, [target]); return <main className="effect-page physics-stage" onPointerMove={(e) => setTarget({ x: e.clientX, y: e.clientY })}><h1>ДЭНЧИК</h1><div className="physics-ball" style={{ transform: `translate(${pos.x - 45}px, ${pos.y - 90}px)` }} /></main>; }

function ConstellationPage() {
  const canvasRef = useRef(null);
  useEffect(() => { const canvas = canvasRef.current, ctx = canvas.getContext("2d"); let frame; const pointer={x:-9999,y:-9999}; const stars=Array.from({length:90},()=>({x:Math.random(),y:Math.random(),vx:(Math.random()-.5)*.0004,vy:(Math.random()-.5)*.0004})); const resize=()=>{const d=Math.min(devicePixelRatio||1,2); canvas.width=innerWidth*d; canvas.height=(innerHeight-72)*d; canvas.style.width=innerWidth+'px'; canvas.style.height=(innerHeight-72)+'px'; ctx.setTransform(d,0,0,d,0,0)}; const move=e=>{const r=canvas.getBoundingClientRect();pointer.x=e.clientX-r.left;pointer.y=e.clientY-r.top}; const draw=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;ctx.fillStyle='rgba(3,18,12,.2)';ctx.fillRect(0,0,w,h);stars.forEach(a=>{a.x=(a.x+a.vx+1)%1;a.y=(a.y+a.vy+1)%1;const x=a.x*w,y=a.y*h;const dx=pointer.x-x,dy=pointer.y-y,dist=Math.hypot(dx,dy);if(dist<180){ctx.strokeStyle=`rgba(170,255,210,${1-dist/180})`;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(pointer.x,pointer.y);ctx.stroke()}ctx.fillStyle='#d9ffe8';ctx.beginPath();ctx.arc(x,y,1.6,0,Math.PI*2);ctx.fill()});frame=requestAnimationFrame(draw)}; resize();canvas.addEventListener('pointermove',move);window.addEventListener('resize',resize);draw();return()=>{cancelAnimationFrame(frame);canvas.removeEventListener('pointermove',move);window.removeEventListener('resize',resize)}} ,[]);
  return <main className="canvas-sim"><canvas ref={canvasRef}/><div className="sim-caption"><p className="eyebrow">CONSTELLATION</p><h1>Connect the field</h1></div></main>;
}

function KaleidoscopePage() {
  const canvasRef=useRef(null);
  useEffect(()=>{const c=canvasRef.current,ctx=c.getContext('2d');let hue=120;const resize=()=>{const d=Math.min(devicePixelRatio||1,2);c.width=innerWidth*d;c.height=(innerHeight-72)*d;c.style.width=innerWidth+'px';c.style.height=(innerHeight-72)+'px';ctx.setTransform(d,0,0,d,0,0)};const draw=e=>{const r=c.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;hue=(hue+2)%360;for(let i=0;i<12;i++){ctx.save();ctx.translate(r.width/2,r.height/2);ctx.rotate(i*Math.PI/6);if(i%2)ctx.scale(-1,1);ctx.fillStyle=`hsla(${hue+i*8},75%,70%,.12)`;ctx.beginPath();ctx.arc(x,y,18+Math.abs(x+y)%55,0,Math.PI*2);ctx.fill();ctx.restore()}};resize();c.addEventListener('pointermove',draw);window.addEventListener('resize',resize);return()=>{c.removeEventListener('pointermove',draw);window.removeEventListener('resize',resize)}},[]);
  return <main className="canvas-sim kaleidoscope-sim"><canvas ref={canvasRef}/><div className="sim-caption"><p className="eyebrow">KALEIDOSCOPE</p><h1>Paint mirrored light</h1></div></main>;
}

function OrbitPage(){const ref=useRef(null);const [pull,setPull]=useState({x:50,y:50});return <main className="orbit-stage" ref={ref} onPointerMove={e=>{const r=ref.current.getBoundingClientRect();setPull({x:(e.clientX-r.left)/r.width*100,y:(e.clientY-r.top)/r.height*100})}} style={{"--px":`${pull.x}%`,"--py":`${pull.y}%`}}><div className="orbit-core"/>{Array.from({length:6},(_,i)=><div className={`orbit-ring orbit-${i+1}`} key={i}><span/></div>)}<div className="sim-caption"><p className="eyebrow">ORBIT PLAYGROUND</p><h1>Bend the paths</h1></div></main>}

function FluidLab() {
  return <main className="fluid-lab-standalone">
    <WebGLFluid quality="high" />
  </main>;
}


function displayValue(value, fallback = "") {
  if (value == null) return fallback;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => displayValue(item)).join(", ");
  if (typeof value === "object") {
    if ("original" in value) return displayValue(value.original, fallback);
    if ("name" in value) return displayValue(value.name, fallback);
    if ("value" in value) return displayValue(value.value, fallback);
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return String(value);
}

function ObservabilityStrip({ currentPath }) {
  const [events, setEvents] = useState([]);
  const [health, setHealth] = useState({});
  const [stack, setStack] = useState({});
  const [expanded, setExpanded] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const [state, setState] = useState("connecting");
  const services = ["gateway", "auth", "commerce", "content", "files", "observability"];

  useEffect(() => {
    let alive = true;

    async function request(path) {
      try {
        const response = await fetch(`/api/observability${path}`, {
          cache: "no-store",
        });
        if (response.ok) return response;
      } catch {
        // Try the public observability service below.
      }

      return fetch(`${OBSERVABILITY_URL}${path}`, {
        cache: "no-store",
      });
    }

    const load = async () => {
      try {
        const [eventsResponse, healthResponse, stackResponse, servicesResponse] = await Promise.all([
          request("/events?limit=18"),
          request("/health"),
          request("/stack-health"),
          request("/services"),
        ]);

        if (!eventsResponse.ok || !healthResponse.ok) {
          throw new Error("observability unavailable");
        }

        const eventData = await eventsResponse.json();
        const healthData = await healthResponse.json();
        const stackData = stackResponse.ok ? await stackResponse.json() : {};
        const serviceData = servicesResponse.ok ? await servicesResponse.json() : {};

        if (!alive) return;

        setEvents(eventData.events || []);
        setHealth({
          ...(serviceData || {}),
          observability: healthData.status === "online" ? "online" : "offline",
        });
        setStack(stackData || {});
        setState("online");
      } catch (error) {
        if (!alive) return;
        setState("offline");
        setHealth((current) => ({ ...current, observability: "offline" }));
      }
    };

    load();
    const timer = window.setInterval(load, 5000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [currentPath]);

  const online = services.filter((name) => health[name] === "online").length;
  const latest = events[0];

  return <section className={`obs-rail ${expanded ? "is-expanded" : ""}`} aria-label="Educational observability panel">
    <div className="obs-rail-main">
      <div className="obs-rail-title">
        <span className="obs-live-dot" />
        <div><small>EDUCATIONAL PROJECT · LIVE LOGS</small><strong>Observability</strong></div>
      </div>

      <div className="obs-rail-metric"><small>ROUTE</small><strong>{currentPath}</strong></div>
      <div className="obs-rail-metric"><small>SERVICES</small><strong>{online}/{services.length}</strong></div>
      <div className="obs-rail-metric"><small>ELASTICSEARCH</small><strong>{displayValue(stack.elasticsearch, state === "offline" ? "offline" : "checking")}</strong></div>
      <div className="obs-rail-metric obs-latest">
        <small>LATEST EVENT</small>
        <strong>{displayValue(latest?.event, state === "offline" ? "collector offline" : "waiting for activity")}</strong>
        <span>{displayValue(latest?.service, "frontend")}</span>
      </div>

      <button className="obs-expand-button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? "Hide logs" : "Live logs"}
      </button>

      <button className="obs-how-button" onClick={() => setShowHow((value) => !value)}>
        {showHow ? "Hide info" : "How it works"}
      </button>

      <a href={KIBANA_URL} target="_blank" rel="noreferrer">
        Kibana
      </a>
    </div>

    {showHow && <div className="obs-how-panel">
      <p className="eyebrow">как я это сделала</p>
      <h3>как появляются логи</h3>
      <p>реакт отправляет события о переходах, кликах и ошибках прямо в отдельный сервис observability остальные микросервисы тоже могут отправлять туда свои структурированные события</p>
      <p>оbservability сразу показывает свежие события через api и сохраняет их в elasticsearch, поэтому встроенные live logs могут работать независимо от интерфейса кибаны</p>
      <div className="obs-how-flow">
        <span>browser / services</span><b>→</b><span>observability</span><b>→</b><span>elasticsearch</span><b>→</b><span>kibana</span>
      </div>
      <p>gateway остаётся диспетчером обычных api-запросов сайта, кибана отдельный полный интерфейс для данных elasticsearch, а эта панель показывает последние события прямо на сайте</p>
    </div>}

    {expanded && <div className="obs-rail-drawer">
      <div className="obs-service-mini-grid">
        {services.map((name) => <div key={name}>
          <span className={`mini-status ${health[name] === "online" ? "online" : "offline"}`} />
          <b>{name}</b>
          <small>{health[name] || "waiting"}</small>
        </div>)}
      </div>

      <div className="obs-inline-events">
        {events.length ? events.slice(0, 10).map((item, index) => <article key={`${item["@timestamp"] || index}-${index}`}>
          <time>{String(item["@timestamp"] || item.timestamp || "").slice(11, 19) || "now"}</time>
          <b>{displayValue(item.service, "unknown")}</b>
          <span>{displayValue(item.event ?? item.message, "event")}</span>
          <em>{displayValue(item.level, "INFO")}</em>
        </article>) : <p>
          {state === "offline"
            ? "The collector cannot reach the observability service."
            : "No events yet. Open a project or click a control."}
        </p>}
      </div>

      <p className="obs-pipeline-note">
        Browser/services → Observability collector → Elasticsearch. Kibana is an optional full log explorer.
      </p>
    </div>}
  </section>;
}


export default App;