import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Listing = {
  id: string; title: string; description: string; price: number; category: string;
  condition: string; city: string; state: string; contact_phone: string;
  seller_name: string; image_urls: string[]; status: string; created_at: string;
};
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
const db: SupabaseClient | null = url && key ? createClient(url, key) : null;
const categories = ["Mobiles & Tablets", "Computers & Laptops", "Computer Accessories", "Electronics & Gadgets", "Vehicle Parts", "Cars & Bikes", "Home & Kitchen", "Furniture", "Cameras", "Fashion", "Books & Education", "Sports & Fitness", "Tools & Hardware", "Toys & Games", "Musical Instruments", "Other Products"];
const categoryTiles = [
  { name: "Computers & Laptops", icon: "💻" },
  { name: "Mobiles & Tablets", icon: "📱" },
  { name: "Computer Accessories", icon: "⌨️" },
  { name: "Electronics & Gadgets", icon: "🎧" },
  { name: "Home & Kitchen", icon: "🖨️" },
  { name: "Vehicle Parts", icon: "⚙️" },
  { name: "Other Products", icon: "📦" },
  { name: "Furniture", icon: "🪑" }
];
const demo: Listing[] = [
  {id:"demo-1",title:"iPhone 13 · 128GB",description:"Good condition, fully working. Sample listing for preview.",price:28500,category:"Mobiles & Tablets",condition:"Good",city:"Bengaluru",state:"Karnataka",contact_phone:"",seller_name:"Demo seller",image_urls:["https://images.unsplash.com/photo-1632633173522-3cbf9e4a3b9b?auto=format&fit=crop&w=900&q=80"],status:"active",created_at:new Date().toISOString()},
  {id:"demo-2",title:"Honda Activa 6G",description:"Single-owner scooter. Sample listing for preview.",price:62000,category:"Cars & Bikes",condition:"Good",city:"Mysuru",state:"Karnataka",contact_phone:"",seller_name:"Demo seller",image_urls:["https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80"],status:"active",created_at:new Date().toISOString()},
  {id:"demo-3",title:"Dell Inspiron Laptop",description:"Laptop for study and office use. Sample listing for preview.",price:22000,category:"Computers & Laptops",condition:"Fair",city:"Chennai",state:"Tamil Nadu",contact_phone:"",seller_name:"Demo seller",image_urls:["https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80"],status:"active",created_at:new Date().toISOString()}
];
const money = (n:number) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);

export default function App() {
  const [items,setItems] = useState<Listing[]>(demo);
  const [user,setUser] = useState<any>(null);
  const [query,setQuery] = useState("");
  const [place,setPlace] = useState("");
  const [category,setCategory] = useState("All");
  const [notice,setNotice] = useState("");
  const [authOpen,setAuthOpen] = useState(false);
  const [sellOpen,setSellOpen] = useState(false);
  const [mode,setMode] = useState<"login"|"signup">("login");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [title,setTitle] = useState("");
  const [description,setDescription] = useState("");
  const [price,setPrice] = useState("");
  const [condition,setCondition] = useState("Good");
  const [city,setCity] = useState("");
  const [state,setState] = useState("");
  const [phone,setPhone] = useState("");
  const [photos,setPhotos] = useState<FileList|null>(null);

  const refresh = async (sessionUser: any = user) => {
    if (!db) return;
    // Guests can browse public listing details, but never receive seller phone numbers.
    const source = sessionUser ? db.from("listings") : db.from("listings_public");
    const {data,error} = await source.select("*").eq("status","active").order("created_at",{ascending:false});
    if (!error && data) setItems(data as Listing[]);
    if (error) setNotice("Could not load live listings: " + error.message);
  };
  useEffect(() => {
    if (!db) return;
    let mounted = true;
    db.auth.getSession().then(({data}) => {
      const sessionUser = data.session?.user ?? null;
      if (mounted) {
        setUser(sessionUser);
        void refresh(sessionUser);
      }
    });
    const {data:{subscription}} = db.auth.onAuthStateChange((_event,session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      void Promise.resolve().then(() => refresh(sessionUser));
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const visible = useMemo(() => items.filter(item => {
    const text = (item.title + " " + item.description + " " + item.category).toLowerCase();
    const location = (item.city + " " + item.state).toLowerCase();
    const categoryMatches = category === "All" || item.category === category
      || (category === "Mobiles & Tablets" && item.category === "Mobiles")
      || (category === "Computers & Laptops" && item.category === "Computers");
    return item.status === "active" && (!query || text.includes(query.toLowerCase()))
      && categoryMatches
      && (!place || location.includes(place.toLowerCase()));
  }), [items,query,category,place]);

  const authenticate = async (event:FormEvent) => {
    event.preventDefault();
    if (!db) { setNotice("Connect the Supabase project settings to enable accounts."); return; }
    const result = mode === "signup"
      ? await db.auth.signUp({email,password})
      : await db.auth.signInWithPassword({email,password});
    if (result.error) setNotice(result.error.message);
    else { setNotice(mode === "signup" ? "Account created. Check your email if confirmation is enabled." : "You are signed in."); setAuthOpen(false); }
  };

  const submitListing = async (event:FormEvent) => {
    event.preventDefault();
    if (!db || !user) { setNotice("Please sign in before posting a listing."); setAuthOpen(true); return; }
    if (!title.trim() || description.trim().length < 20 || Number(price) <= 0 || !city.trim() || !state.trim() || phone.replace(/\D/g,"").length < 10) {
      setNotice("Complete all fields and enter a valid 10-digit phone number."); return;
    }
    const imageUrls:string[] = [];
    if (photos?.length) {
      for (const file of Array.from(photos).slice(0,5)) {
        if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 8*1024*1024) {
          setNotice("Use JPG, PNG or WEBP images under 8 MB each."); return;
        }
        const path = user.id + "/" + crypto.randomUUID() + "-" + file.name.replace(/[^a-zA-Z0-9.-]/g,"-");
        const {error:uploadError} = await db.storage.from("listing-images").upload(path,file);
        if (uploadError) { setNotice(uploadError.message); return; }
        imageUrls.push(db.storage.from("listing-images").getPublicUrl(path).data.publicUrl);
      }
    }
    const {error} = await db.from("listings").insert({
      seller_id:user.id,title:title.trim(),description:description.trim(),price:Number(price),
      category:formCategory,condition,city:city.trim(),state:state.trim(),contact_phone:phone.replace(/\D/g,""),
      seller_name:user.email?.split("@")[0] || "Seller",image_urls:imageUrls,status:"pending"
    });
    if (error) setNotice(error.message);
    else { setNotice("Listing submitted for review. It will appear after approval."); setSellOpen(false); setTitle(""); setDescription(""); setPrice(""); setCity(""); setState(""); setPhone(""); setPhotos(null); }
  };

  const [formCategory,setFormCategory] = useState("Mobiles & Tablets");
  const signOut = async () => { await db?.auth.signOut(); setUser(null); setNotice("Signed out."); };
  const openBuy = () => {
    if (!user) {
      setMode("login");
      setNotice("Please login or register before buying and contacting sellers.");
      setAuthOpen(true);
      return;
    }
    document.getElementById("listings")?.scrollIntoView({behavior:"smooth"});
  };
  const openSell = () => {
    if (!user) {
      setMode("login");
      setNotice("Please login or register before selling an item.");
      setAuthOpen(true);
      return;
    }
    setSellOpen(true);
  };
  const buyItem = (item:Listing) => {
    if (!user) {
      setMode("login");
      setNotice("Please login or register before buying. Sign in to contact the seller.");
      setAuthOpen(true);
      return;
    }
    if (!item.contact_phone) {
      setNotice("Seller contact is not available for this sample listing.");
      return;
    }
    const link = "https://wa.me/91" + item.contact_phone.replace(/\D/g,"").replace(/^91/,"") + "?text=" + encodeURIComponent("Hi, I am interested in buying " + item.title + " listed on VPN Products and Services.");
    window.open(link, "_blank", "noopener,noreferrer");
  };

  return <div className="site">
    <header className="header"><a className="logo" href="#top" aria-label="VPN Products and Services home"><img src="/vpn-logo.webp" alt="VPN monogram logo" /><b>VPN Products and Services</b></a><div className="header-search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products, parts, gadgets and more"/></div><div className="header-actions"><button className="btn buy-top" onClick={openBuy}>🛒 Buy</button>{user ? <button className="btn light" onClick={signOut}>Sign out</button> : <button className="btn light" onClick={()=>{setMode("login");setAuthOpen(true);}}>Login / Register</button>}<button className="btn primary" onClick={openSell}>＋ Sell item</button></div></header>
    <main id="top">
      <section className="hero"><div className="hero-copy"><span className="eyebrow">COMPUTER SHOP & MULTI-SERVICE CENTER</span><h1>Buy, Sell, Repair &<br/><em>Get IT Services</em></h1><p>Computer and laptop services, mobile services, website development, and a wide range of new and second-hand products — all in one place.</p><div className="hero-actions"><button className="btn primary" onClick={()=>document.getElementById("listings")?.scrollIntoView({behavior:"smooth"})}>🛒 Browse Products</button><button className="btn light" onClick={()=>document.getElementById("services")?.scrollIntoView({behavior:"smooth"})}>⚒ Our Services</button></div></div><div className="hero-art"><img src="/hero-devices.svg" alt="Computer, laptop, mobile phone, camera, headphones and electronics"/></div></section>
      <section className="feature-strip" aria-label="Our business areas">
        <div className="feature-item"><span>▣</span><b>Computer<br/>Services</b></div>
        <div className="feature-item"><span>▯</span><b>Mobile<br/>Services</b></div>
        <div className="feature-item"><span>🛒</span><b>Buy & Sell <small>(New & Second-Hand)</small></b></div>
        <div className="feature-item"><span>⌘</span><b>Website<br/>Development</b></div>
        <div className="feature-item"><span>▱</span><b>Multi-Brand<br/>Products</b></div>
      </section>
      <section className="category-section section">
        <div className="section-title"><div><span className="eyebrow">EXPLORE OUR MARKETPLACE</span><h2>Shop by Category</h2></div><button className="text-link" onClick={()=>{setCategory("All");document.getElementById("listings")?.scrollIntoView({behavior:"smooth"});}}>View all categories →</button></div>
        <div className="category-grid">{categoryTiles.map(tile=><button className="category-tile" key={tile.name} onClick={()=>{setCategory(tile.name);document.getElementById("listings")?.scrollIntoView({behavior:"smooth"});}}><span className="tile-icon">{tile.icon}</span><b>{tile.name}</b></button>)}</div>
      </section>
      <section className="services section" id="services"><div className="section-title"><div><span className="eyebrow">MORE THAN A MARKETPLACE</span><h2>Products, Services & Digital Solutions</h2><p>Visit our computer shop, get device support or build your business online.</p></div></div><div className="service-grid"><article className="service-card"><span className="service-icon">▣</span><h3>Computer Shop & Services</h3><p>Computers, laptops and accessories, plus setup, troubleshooting, upgrades and service support.</p><button className="service-link" onClick={()=>setNotice("Contact us for computer and laptop availability or service enquiries.")}>Enquire about computer services →</button></article><article className="service-card"><span className="service-icon">▯</span><h3>Mobile Services</h3><p>Mobile device services, setup and support for everyday phone and tablet needs.</p><button className="service-link" onClick={()=>setNotice("Contact us for mobile service enquiries.")}>Enquire about mobile services →</button></article><article className="service-card"><span className="service-icon">⌘</span><h3>Website Development</h3><p>Websites for businesses, shops, professionals and service providers — from business pages to online stores.</p><button className="service-link" onClick={()=>setNotice("Contact us to discuss your website project.")}>Discuss a website project →</button></article><article className="service-card"><span className="service-icon">⇄</span><h3>Buy & Sell Products</h3><p>Discover or list new and second-hand phones, computers, vehicle parts, electronics, furniture, appliances, books, tools and much more.</p><button className="service-link" onClick={()=>document.getElementById("listings")?.scrollIntoView({behavior:"smooth"})}>Explore marketplace →</button></article></div></section>
      <section className="searchbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="What are you looking for?"/><input value={place} onChange={e=>setPlace(e.target.value)} placeholder="City or state"/><button className="btn primary" onClick={()=>document.getElementById("listings")?.scrollIntoView({behavior:"smooth"})}>Search</button></section>
      <section className="section category-filters"><div className="section-title"><div><span className="eyebrow">FILTER THE LISTINGS</span><h2>Browse all product types</h2></div></div><div className="categories"><button className={category==="All"?"active":""} onClick={()=>setCategory("All")}>All items</button>{categories.map(c=><button key={c} className={category===c?"active":""} onClick={()=>setCategory(c)}>{c}</button>)}</div></section>
      <section className="section" id="listings"><div className="section-title"><div><span className="eyebrow">LISTINGS FROM ACROSS INDIA</span><h2>New & second-hand products</h2><p>{visible.length} listings {place ? "near "+place : "across India"}</p></div></div>{visible.length ? <div className="grid">{visible.map(item=><article className="product" key={item.id}><img src={item.image_urls?.[0] || "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=80"} alt={item.title}/><div className="product-body"><small>{item.category} · {item.condition}</small><h3>{item.title}</h3><strong>{money(item.price)}</strong><p>⌖ {item.city}, {item.state}</p><button className="btn primary contact buy-button" onClick={()=>buyItem(item)}>{user ? "Buy / Contact Seller" : "Login to Buy"}</button>{!item.contact_phone && <span className="demo-tag">Sample preview listing · seller contact unavailable</span>}</div></article>)}</div> : <div className="empty"><h3>No listings found</h3><p>Try a different search or category.</p></div>}</section>
      <section className="sell-cta"><div><span className="eyebrow">SELL ALMOST ANYTHING</span><h2>Have something useful to sell?</h2><p>List phones, computers, parts, electronics, furniture, appliances, vehicles and many other items.</p></div><button className="btn primary" onClick={openSell}>Start selling</button></section>
      <section className="safety"><b>Buy and sell safely</b><p>Inspect items before paying, meet in a public place, and never share OTPs, UPI PINs or banking passwords.</p></section>
      <section className="contact-section section" id="contact">
        <div className="section-title"><div><span className="eyebrow">WE'RE HERE TO HELP</span><h2>Contact VPN Products and Services</h2><p>Get in touch for computer services, mobile support, website development or marketplace enquiries.</p></div></div>
        <div className="contact-grid">
          <a className="contact-card" href="mailto:vpnproductsandservices@gmail.com"><span className="contact-icon">✉</span><span><b>Email us</b><small>vpnproductsandservices@gmail.com</small></span></a>
          <a className="contact-card" href="tel:+919916140898"><span className="contact-icon">☎</span><span><b>Call us</b><small>+91 99161 40898</small></span></a>
          <a className="contact-card" href="https://wa.me/919916140898?text=Hello%20VPN%20Products%20and%20Services%2C%20I%20have%20an%20enquiry." target="_blank" rel="noopener noreferrer"><span className="contact-icon">◉</span><span><b>WhatsApp us</b><small>+91 99161 40898</small></span></a>
          <a className="contact-card instagram-card" href="https://www.instagram.com/vpnproductsandservices/" target="_blank" rel="noopener noreferrer"><span className="contact-icon">◎</span><span><b>Follow us on Instagram</b><small>@vpnproductsandservices</small></span></a>
          <a className="contact-card address-card" href="https://www.google.com/maps/search/?api=1&query=2nd%20Ward%20near%20Anjeneya%20Temple%2C%20Malakana%20Maradi%20Road%2C%20Arhal%2C%20Gangavathi%2C%20Karnataka%2C%20India%20583235" target="_blank" rel="noopener noreferrer"><span className="contact-icon">⌖</span><span><b>Visit our location</b><small>2nd Ward, Near Anjeneya Temple, Malakana Maradi Road, Arhal, Gangavathi, Karnataka, India – 583235</small><small className="map-link-label">View on Google Maps →</small></span></a>
        </div>
      </section>
    </main>
    <footer className="site-footer">
      <b className="footer-brand">VPN Products<br/>and Services</b>
      <div className="footer-info">
        <div className="footer-address">2nd Ward, Near Anjeneya Temple, Malakana Maradi Road, Arhal, Gangavathi, Karnataka 583235, India</div>
        <div className="footer-links"><a href="mailto:vpnproductsandservices@gmail.com">vpnproductsandservices@gmail.com</a><a href="tel:+919916140898">+91 99161 40898</a><a href="https://www.instagram.com/vpnproductsandservices/" target="_blank" rel="noopener noreferrer">Instagram: @vpnproductsandservices</a></div>
        <div className="footer-copy">© {new Date().getFullYear()} VPN Products and Services <span>·</span> <a href="https://veereshuppar.com">veereshuppar.com</a></div>
      </div>
    </footer>
    {notice && <button className="notice" onClick={()=>setNotice("")}>{notice}　×</button>}
    {authOpen && <div className="overlay" onClick={()=>setAuthOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setAuthOpen(false)}>×</button><h2>{mode==="login"?"Welcome back":"Create an account"}</h2><form onSubmit={authenticate}><label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input required minLength={6} type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="btn primary full">{mode==="login"?"Sign in":"Sign up"}</button></form><button className="switch" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"New user? Create an account":"Already registered? Sign in"}</button></div></div>}
    {sellOpen && <div className="overlay" onClick={()=>setSellOpen(false)}><div className="modal wide" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSellOpen(false)}>×</button><h2>Post an item</h2><form onSubmit={submitListing}><label>Title<input required maxLength={90} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Category<select value={formCategory} onChange={e=>setFormCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Price in ₹<input required min="1" type="number" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Description<textarea required minLength={20} maxLength={1500} rows={4} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Condition<select value={condition} onChange={e=>setCondition(e.target.value)}><option>Like New</option><option>Good</option><option>Fair</option><option>For Parts</option></select></label><div className="row"><label>City<input required value={city} onChange={e=>setCity(e.target.value)} placeholder="Bengaluru"/></label><label>State<input required value={state} onChange={e=>setState(e.target.value)} placeholder="Karnataka"/></label></div><label>WhatsApp / phone<input required inputMode="numeric" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="10-digit mobile number"/></label><label>Photos (up to 5)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setPhotos(e.target.files)}/></label><button className="btn primary full">Submit for review</button><small>Listings appear publicly only after admin approval.</small></form></div></div>}
  </div>;
}
