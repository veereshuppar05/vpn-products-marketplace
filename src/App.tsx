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
const categories = ["Mobiles", "Cars & Bikes", "Vehicle Parts", "Computers", "Furniture", "Appliances", "Cameras", "Accessories"];
const demo: Listing[] = [
  {id:"demo-1",title:"iPhone 13 · 128GB",description:"Good condition, fully working. Sample listing for preview.",price:28500,category:"Mobiles",condition:"Good",city:"Bengaluru",state:"Karnataka",contact_phone:"",seller_name:"Demo seller",image_urls:["https://images.unsplash.com/photo-1632633173522-3cbf9e4a3b9b?auto=format&fit=crop&w=900&q=80"],status:"active",created_at:new Date().toISOString()},
  {id:"demo-2",title:"Honda Activa 6G",description:"Single-owner scooter. Sample listing for preview.",price:62000,category:"Cars & Bikes",condition:"Good",city:"Mysuru",state:"Karnataka",contact_phone:"",seller_name:"Demo seller",image_urls:["https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80"],status:"active",created_at:new Date().toISOString()},
  {id:"demo-3",title:"Dell Inspiron Laptop",description:"Laptop for study and office use. Sample listing for preview.",price:22000,category:"Computers",condition:"Fair",city:"Chennai",state:"Tamil Nadu",contact_phone:"",seller_name:"Demo seller",image_urls:["https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80"],status:"active",created_at:new Date().toISOString()}
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

  const refresh = async () => {
    if (!db) return;
    const {data,error} = await db.from("listings").select("*").eq("status","active").order("created_at",{ascending:false});
    if (!error && data) setItems(data as Listing[]);
    if (error) setNotice("Could not load live listings: " + error.message);
  };
  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({data}) => setUser(data.session?.user ?? null));
    const {data:{subscription}} = db.auth.onAuthStateChange((_event,session) => setUser(session?.user ?? null));
    void refresh();
    return () => subscription.unsubscribe();
  }, []);

  const visible = useMemo(() => items.filter(item => {
    const text = (item.title + " " + item.description + " " + item.category).toLowerCase();
    const location = (item.city + " " + item.state).toLowerCase();
    return item.status === "active" && (!query || text.includes(query.toLowerCase()))
      && (category === "All" || item.category === category)
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

  const [formCategory,setFormCategory] = useState("Mobiles");
  const signOut = async () => { await db?.auth.signOut(); setUser(null); setNotice("Signed out."); };
  const whatsapp = (item:Listing) => "https://wa.me/91" + item.contact_phone.replace(/\D/g,"").replace(/^91/,"") + "?text=" + encodeURIComponent("Hi, I am interested in " + item.title + " on VPN Products.");

  return <div className="site">
    <header className="header"><a className="logo" href="#top" aria-label="VPN Products home"><img src="/vpn-logo.webp" alt="VPN monogram logo" /><b>VPN Products</b></a><div className="header-search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search phones, vehicles, gadgets and more"/></div><div className="header-actions">{user ? <button className="btn light" onClick={signOut}>Sign out</button> : <button className="btn light" onClick={()=>setAuthOpen(true)}>Login / Register</button>}<button className="btn primary" onClick={()=>setSellOpen(true)}>＋ Sell item</button></div></header>
    <main id="top">
      <section className="hero"><div><span className="eyebrow">INDIA'S PRE-OWNED MARKETPLACE</span><h1>Give good things<br/><em>a second life.</em></h1><p>Discover great deals on pre-owned products across India. Find your next favourite thing or sell what you no longer need.</p><button className="btn primary" onClick={()=>document.getElementById("listings")?.scrollIntoView({behavior:"smooth"})}>Explore listings ↓</button></div><img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=85" alt="Electronics and gadgets"/></section>
      <section className="searchbar"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="What are you looking for?"/><input value={place} onChange={e=>setPlace(e.target.value)} placeholder="City or state"/><button className="btn primary" onClick={()=>document.getElementById("listings")?.scrollIntoView({behavior:"smooth"})}>Search</button></section>
      <section className="section"><div className="section-title"><div><span className="eyebrow">BROWSE BY CATEGORY</span><h2>Explore categories</h2></div></div><div className="categories"><button className={category==="All"?"active":""} onClick={()=>setCategory("All")}>All items</button>{categories.map(c=><button key={c} className={category===c?"active":""} onClick={()=>setCategory(c)}>{c}</button>)}</div></section>
      <section className="section" id="listings"><div className="section-title"><div><span className="eyebrow">FRESH FINDS, FAIR PRICES</span><h2>Second-hand deals</h2><p>{visible.length} listings {place ? "near "+place : "across India"}</p></div></div>{visible.length ? <div className="grid">{visible.map(item=><article className="product" key={item.id}><img src={item.image_urls?.[0] || "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=80"} alt={item.title}/><div className="product-body"><small>{item.category} · {item.condition}</small><h3>{item.title}</h3><strong>{money(item.price)}</strong><p>⌖ {item.city}, {item.state}</p>{item.contact_phone ? <a className="btn primary contact" href={whatsapp(item)} target="_blank" rel="noreferrer">Contact seller on WhatsApp</a> : <span className="demo-tag">Sample preview listing</span>}</div></article>)}</div> : <div className="empty"><h3>No listings found</h3><p>Try a different search or category.</p></div>}</section>
      <section className="sell-cta"><div><span className="eyebrow">YOUR UNUSED ITEMS HAVE VALUE</span><h2>Ready to make some extra cash?</h2><p>Post your pre-owned items and connect with interested buyers.</p></div><button className="btn primary" onClick={()=>setSellOpen(true)}>Start selling</button></section>
      <section className="safety"><b>Buy and sell safely</b><p>Inspect items before paying, meet in a public place, and never share OTPs, UPI PINs or banking passwords.</p></section>
    </main>
    <footer><b>VPN Products</b><span>© {new Date().getFullYear()} VPN Products · <a href="https://veereshuppar.com">veereshuppar.com</a></span></footer>
    {notice && <button className="notice" onClick={()=>setNotice("")}>{notice}　×</button>}
    {authOpen && <div className="overlay" onClick={()=>setAuthOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setAuthOpen(false)}>×</button><h2>{mode==="login"?"Welcome back":"Create an account"}</h2><form onSubmit={authenticate}><label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input required minLength={6} type="password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="btn primary full">{mode==="login"?"Sign in":"Sign up"}</button></form><button className="switch" onClick={()=>setMode(mode==="login"?"signup":"login")}>{mode==="login"?"New user? Create an account":"Already registered? Sign in"}</button></div></div>}
    {sellOpen && <div className="overlay" onClick={()=>setSellOpen(false)}><div className="modal wide" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSellOpen(false)}>×</button><h2>Post an item</h2><form onSubmit={submitListing}><label>Title<input required maxLength={90} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Category<select value={formCategory} onChange={e=>setFormCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Price in ₹<input required min="1" type="number" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Description<textarea required minLength={20} maxLength={1500} rows={4} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Condition<select value={condition} onChange={e=>setCondition(e.target.value)}><option>Like New</option><option>Good</option><option>Fair</option><option>For Parts</option></select></label><div className="row"><label>City<input required value={city} onChange={e=>setCity(e.target.value)} placeholder="Bengaluru"/></label><label>State<input required value={state} onChange={e=>setState(e.target.value)} placeholder="Karnataka"/></label></div><label>WhatsApp / phone<input required inputMode="numeric" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="10-digit mobile number"/></label><label>Photos (up to 5)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setPhotos(e.target.files)}/></label><button className="btn primary full">Submit for review</button><small>Listings appear publicly only after admin approval.</small></form></div></div>}
  </div>;
}
