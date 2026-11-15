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
const categoryIconByName:Record<string,string> = {
  "Mobiles & Tablets":"📱",
  "Computers & Laptops":"💻",
  "Computer Accessories":"⌨️",
  "Electronics & Gadgets":"🎧",
  "Vehicle Parts":"⚙️",
  "Cars & Bikes":"🏍️",
  "Home & Kitchen":"🏠",
  "Furniture":"🪑",
  "Cameras":"📷",
  "Fashion":"👕",
  "Books & Education":"📚",
  "Sports & Fitness":"🏏",
  "Tools & Hardware":"🛠️",
  "Toys & Games":"🧸",
  "Musical Instruments":"🎸",
  "Other Products":"📦"
};
const allCategoryTiles = categories.map(name=>({name,icon:categoryIconByName[name] ?? "📦"}));
const isAllCategoriesPath = () => /^\/categories\/?$/.test(window.location.pathname);
const categorySlug = (name:string) => name.toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const categoryFromPath = () => {
  const match = window.location.pathname.match(/^\/category\/([^/]+)(?:\/[^/]+)?\/?$/);
  if (!match) return null;
  let slug = "";
  try { slug = decodeURIComponent(match[1]); } catch { return null; }
  return [...new Set([...categories,...categoryTiles.map(tile=>tile.name)])].find(name=>categorySlug(name)===slug) ?? null;
};
const demo: Listing[] = [
  {id:"demo-1",title:"iPhone 13 · 128GB",description:"Good condition, fully working. Sample listing for preview.",price:28500,category:"Mobiles & Tablets",condition:"Good",city:"Bengaluru",state:"Karnataka",contact_phone:"",seller_name:"Demo seller",image_urls:["https://images.unsplash.com/photo-1632633173522-3cbf9e4a3b9b?auto=format&fit=crop&w=900&q=80"],status:"active",created_at:new Date().toISOString()},
  {id:"demo-2",title:"Honda Activa 6G",description:"Single-owner scooter. Sample listing for preview.",price:62000,category:"Cars & Bikes",condition:"Good",city:"Mysuru",state:"Karnataka",contact_phone:"",seller_name:"Demo seller",image_urls:["https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80"],status:"active",created_at:new Date().toISOString()},
  {id:"demo-3",title:"Dell Inspiron Laptop",description:"Laptop for study and office use. Sample listing for preview.",price:22000,category:"Computers & Laptops",condition:"Fair",city:"Chennai",state:"Tamil Nadu",contact_phone:"",seller_name:"Demo seller",image_urls:["https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80"],status:"active",created_at:new Date().toISOString()}
];
const featuredListings: Listing[] = [
  {
    id:"samsung-galaxy-a12-6gb-128gb",
    title:"Samsung Galaxy A12 (6GB RAM, 128GB Storage)",
    description:"Samsung Galaxy A12 in blue with 6GB RAM and 128GB internal storage. Used phone with visible scratches on the display and wear/chipped paint on the body and frame. Please inspect all photos carefully before purchase. Specifications: 6.5-inch HD+ Infinity-V display (720 × 1600); octa-core processor; 48MP main + 5MP ultra-wide + 2MP macro + 2MP depth rear cameras; 8MP front camera; 5,000mAh battery with 15W charging; side-mounted fingerprint sensor; USB Type-C port; 3.5mm headphone jack; microSD expansion support. Battery health, operating condition and included accessories have not been independently verified; buyers are welcome to inspect the phone before purchase.",
    price:3000,
    category:"Mobiles & Tablets",
    condition:"Used - Scratches",
    city:"Gangavathi",
    state:"Karnataka",
    contact_phone:"9916140898",
    seller_name:"VPN Products and Services",
    image_urls:[
      "/products/samsung-galaxy-a12/01-galaxy-a12-front-home.webp",
      "/products/samsung-galaxy-a12/02-galaxy-a12-back.webp",
      "/products/samsung-galaxy-a12/03-galaxy-a12-screen-off.webp",
      "/products/samsung-galaxy-a12/04-galaxy-a12-side-buttons.webp",
      "/products/samsung-galaxy-a12/05-galaxy-a12-side-tray.webp",
      "/products/samsung-galaxy-a12/06-galaxy-a12-bottom.webp",
      "/products/samsung-galaxy-a12/07-galaxy-a12-side-profile.webp"
    ],
    status:"active",
    created_at:new Date().toISOString()
  }
];
const isAllProductsPath = () => /^\/products\/?$/.test(window.location.pathname);
const sampleListings: Listing[] = [
  {
    id:"sample-google-pixel-7a",
    title:"Google Pixel 7a · 128GB",
    description:"Sample demonstration listing for a Google Pixel 7a with 128GB storage. This is a dummy product shown to demonstrate the marketplace layout; it is not a confirmed item for sale.",
    price:18999,category:"Mobiles & Tablets",condition:"Good",city:"Bengaluru",state:"Karnataka",
    contact_phone:"",seller_name:"Demo seller",
    image_urls:["https://images.unsplash.com/photo-1605236453806-6ff36851218e?auto=format&fit=crop&w=900&q=85"],
    status:"active",created_at:new Date(Date.now()-1000).toISOString()
  },
  {
    id:"sample-lenovo-ideapad-3",
    title:"Lenovo IdeaPad 3 Laptop",
    description:"Sample demonstration listing for a Lenovo IdeaPad laptop suitable for study and office use. This dummy item is for website preview only.",
    price:28999,category:"Computers & Laptops",condition:"Good",city:"Bengaluru",state:"Karnataka",
    contact_phone:"",seller_name:"Demo seller",
    image_urls:["https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85"],
    status:"active",created_at:new Date(Date.now()-2000).toISOString()
  },
  {
    id:"sample-logitech-keyboard-mouse",
    title:"Wireless Keyboard & Mouse Combo",
    description:"Sample demonstration listing for a wireless keyboard and mouse combo. This dummy item is included to preview the Computer Accessories category.",
    price:1299,category:"Computer Accessories",condition:"Like New",city:"Mysuru",state:"Karnataka",
    contact_phone:"",seller_name:"Demo seller",
    image_urls:["https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=85"],
    status:"active",created_at:new Date(Date.now()-3000).toISOString()
  },
  {
    id:"sample-jbl-bluetooth-speaker",
    title:"Portable Bluetooth Speaker",
    description:"Sample demonstration listing for a portable Bluetooth speaker. Dummy product for marketplace preview only; seller contact is not available.",
    price:1799,category:"Electronics & Gadgets",condition:"Good",city:"Hubballi",state:"Karnataka",
    contact_phone:"",seller_name:"Demo seller",
    image_urls:["https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85"],
    status:"active",created_at:new Date(Date.now()-4000).toISOString()
  },
  {
    id:"sample-car-led-headlight",
    title:"Car LED Headlight Bulb Pair",
    description:"Sample demonstration listing for a pair of car LED headlight bulbs. This dummy item demonstrates the Vehicle Parts category.",
    price:999,category:"Vehicle Parts",condition:"New",city:"Bengaluru",state:"Karnataka",
    contact_phone:"",seller_name:"Demo seller",
    image_urls:["https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=900&q=85"],
    status:"active",created_at:new Date(Date.now()-5000).toISOString()
  },
  {
    id:"sample-kitchen-mixer-grinder",
    title:"Mixer Grinder · 3 Jars",
    description:"Sample demonstration listing for a three-jar mixer grinder. This is a dummy listing to show the Home & Kitchen category.",
    price:2499,category:"Home & Kitchen",condition:"Good",city:"Mandya",state:"Karnataka",
    contact_phone:"",seller_name:"Demo seller",
    image_urls:["https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=900&q=85"],
    status:"active",created_at:new Date(Date.now()-6000).toISOString()
  },
  {
    id:"sample-study-desk",
    title:"Compact Wooden Study Desk",
    description:"Sample demonstration listing for a compact wooden study desk. Dummy listing for the Furniture category, added for website preview.",
    price:3499,category:"Furniture",condition:"Good",city:"Dharwad",state:"Karnataka",
    contact_phone:"",seller_name:"Demo seller",
    image_urls:["https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=85"],
    status:"active",created_at:new Date(Date.now()-7000).toISOString()
  },
  {
    id:"sample-canon-eos-camera",
    title:"Canon EOS DSLR Camera",
    description:"Sample demonstration listing for a Canon EOS DSLR camera body. This dummy product is for layout preview only and is not a verified sale offer.",
    price:21999,category:"Cameras",condition:"Good",city:"Mangaluru",state:"Karnataka",
    contact_phone:"",seller_name:"Demo seller",
    image_urls:["https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=85"],
    status:"active",created_at:new Date(Date.now()-8000).toISOString()
  },
  {
    id:"sample-travel-backpack",
    title:"Everyday Travel Backpack",
    description:"Sample demonstration listing for a daily-use travel backpack. This is a dummy Fashion category product for marketplace preview.",
    price:899,category:"Fashion",condition:"Like New",city:"Shivamogga",state:"Karnataka",
    contact_phone:"",seller_name:"Demo seller",
    image_urls:["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=85"],
    status:"active",created_at:new Date(Date.now()-9000).toISOString()
  },
  {
    id:"sample-cricket-kit",
    title:"Cricket Bat & Practice Kit",
    description:"Sample demonstration listing for a cricket bat and practice kit. This dummy item demonstrates the Sports & Fitness category.",
    price:1599,category:"Sports & Fitness",condition:"Good",city:"Tumakuru",state:"Karnataka",
    contact_phone:"",seller_name:"Demo seller",
    image_urls:["https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=900&q=85"],
    status:"active",created_at:new Date(Date.now()-10000).toISOString()
  }
];
const productIdFromPath = () => {
  const categoryProductMatch = window.location.pathname.match(/^\/category\/([^/]+)\/([^/]+)\/?$/);
  const legacyProductMatch = window.location.pathname.match(/^\/product\/([^/]+)\/?$/);
  const slug = categoryProductMatch?.[2] ?? legacyProductMatch?.[1];
  if (!slug) return null;
  try { return decodeURIComponent(slug); } catch { return null; }
};
const money = (n:number) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);

export default function App() {
  const [items,setItems] = useState<Listing[]>([...demo,...featuredListings,...sampleListings]);
  const [user,setUser] = useState<any>(null);
  const [query,setQuery] = useState("");
  const [place,setPlace] = useState("");
  const [category,setCategory] = useState(() => categoryFromPath() ?? "All");
  const [notice,setNotice] = useState("");
  const [authOpen,setAuthOpen] = useState(false);
  const [sellOpen,setSellOpen] = useState(false);
  const [mode,setMode] = useState<"login"|"signup">("login");
  const [email,setEmail] = useState("");
  const [fullName,setFullName] = useState("");
  const [password,setPassword] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");
  const [otpRequired,setOtpRequired] = useState(false);
  const [pendingPhone,setPendingPhone] = useState("");
  const [otpCode,setOtpCode] = useState("");
  const [title,setTitle] = useState("");
  const [description,setDescription] = useState("");
  const [price,setPrice] = useState("");
  const [condition,setCondition] = useState("Good");
  const [city,setCity] = useState("");
  const [state,setState] = useState("");
  const [phone,setPhone] = useState("");
  const [photos,setPhotos] = useState<FileList|null>(null);
  const [selectedProductId,setSelectedProductId] = useState<string|null>(() => productIdFromPath());
  const [selectedCategoryPage,setSelectedCategoryPage] = useState<string|null>(() => categoryFromPath());
  const [showAllProductsPage,setShowAllProductsPage] = useState(() => isAllProductsPath());
  const [showAllCategoriesPage,setShowAllCategoriesPage] = useState(() => isAllCategoriesPath());
  const [activeProductImage,setActiveProductImage] = useState(0);
  const [photoViewerOpen,setPhotoViewerOpen] = useState(false);
  const [photoZoomed,setPhotoZoomed] = useState(false);
  const [activeDetailTab,setActiveDetailTab] = useState<"specifications"|"description">("specifications");

  const refresh = async (sessionUser: any = user) => {
    if (!db) return;
    // Guests can browse public listing details, but never receive seller phone numbers.
    const source = sessionUser ? db.from("listings") : db.from("listings_public");
    const {data,error} = await source.select("*").eq("status","active").order("created_at",{ascending:false});
    if (!error && data) setItems([...(data as Listing[]), ...featuredListings, ...sampleListings]);
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
  }).sort((a,b) => {
    const dateA = Date.parse(a.created_at) || 0;
    const dateB = Date.parse(b.created_at) || 0;
    return dateB - dateA;
  }), [items,query,category,place]);
  const selectedProduct = useMemo(
    () => items.find(item => item.id === selectedProductId) ?? null,
    [items,selectedProductId]
  );
  const detailSpecifications = selectedProduct?.id === "samsung-galaxy-a12-6gb-128gb"
    ? [
        {label:"Brand",value:"Samsung"},
        {label:"Model",value:"Galaxy A12"},
        {label:"RAM",value:"6GB"},
        {label:"Internal storage",value:"128GB"},
        {label:"Display",value:"6.5-inch HD+ Infinity-V TFT display (720 × 1600)"},
        {label:"Processor",value:"Octa-core processor"},
        {label:"Rear cameras",value:"48MP main + 5MP ultra-wide + 2MP macro + 2MP depth"},
        {label:"Front camera",value:"8MP"},
        {label:"Battery",value:"5,000mAh"},
        {label:"Charging",value:"15W wired charging"},
        {label:"Fingerprint sensor",value:"Side-mounted"},
        {label:"Connectivity and ports",value:"4G LTE, USB Type-C, 3.5mm headphone jack"},
        {label:"Storage expansion",value:"microSD card support"},
        {label:"Colour",value:"Blue"}
      ]
    : selectedProduct ? [
        {label:"Category",value:selectedProduct.category},
        {label:"Condition",value:selectedProduct.condition},
        {label:"Location",value:selectedProduct.city + ", " + selectedProduct.state},
        {label:"Seller",value:selectedProduct.seller_name}
      ] : [];

  useEffect(() => {
    const handlePopState = () => {
      const categoryPage = categoryFromPath();
      setSelectedProductId(productIdFromPath());
      setSelectedCategoryPage(categoryPage);
      setShowAllProductsPage(isAllProductsPath());
      setShowAllCategoriesPage(isAllCategoriesPath());
      setCategory(categoryPage ?? "All");
      setActiveProductImage(0);
      setActiveDetailTab("specifications");
    };
    window.addEventListener("popstate",handlePopState);
    return () => window.removeEventListener("popstate",handlePopState);
  }, []);
  useEffect(() => {
    if (!photoViewerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleViewerKeys = (event:KeyboardEvent) => {
      if (event.key === "Escape") {
        setPhotoViewerOpen(false);
        setPhotoZoomed(false);
      } else if (event.key === "ArrowRight" && selectedProduct?.image_urls?.length) {
        setActiveProductImage(current => (current + 1) % selectedProduct.image_urls.length);
        setPhotoZoomed(false);
      } else if (event.key === "ArrowLeft" && selectedProduct?.image_urls?.length) {
        setActiveProductImage(current => (current - 1 + selectedProduct.image_urls.length) % selectedProduct.image_urls.length);
        setPhotoZoomed(false);
      }
    };
    window.addEventListener("keydown",handleViewerKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown",handleViewerKeys);
    };
  }, [photoViewerOpen,selectedProduct]);


  const openProduct = (item:Listing) => {
    const categoryPath = categorySlug(item.category);
    window.history.pushState(
      {fromProductDetail:true},
      "",
      "/category/" + categoryPath + "/" + encodeURIComponent(item.id)
    );
    setSelectedProductId(item.id);
    setSelectedCategoryPage(item.category);
    setCategory(item.category);
    setActiveProductImage(0);
    setActiveDetailTab("specifications");
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const openCategory = (categoryName:string) => {
    window.history.pushState(
      {fromCategoryPage:true},
      "",
      "/category/" + categorySlug(categoryName)
    );
    setSelectedProductId(null);
    setSelectedCategoryPage(categoryName);
    setShowAllCategoriesPage(false);
    setShowAllProductsPage(false);
    setCategory(categoryName);
    setActiveProductImage(0);
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const openAllCategories = () => {
    window.history.pushState({fromAllCategories:true},"","/categories");
    setSelectedProductId(null);
    setSelectedCategoryPage(null);
    setShowAllCategoriesPage(true);
    setShowAllProductsPage(false);
    setCategory("All");
    setQuery("");
    setPlace("");
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const backFromAllCategories = () => {
    if (window.history.state?.fromAllCategories) {
      window.history.back();
    } else {
      window.history.replaceState({},"","/");
      setShowAllCategoriesPage(false);
      setCategory("All");
      window.scrollTo({top:0,behavior:"smooth"});
    }
  };
  const openAllProducts = () => {
    window.history.pushState({fromAllProducts:true},"","/products");
    setSelectedProductId(null);
    setSelectedCategoryPage(null);
    setShowAllProductsPage(true);
    setShowAllCategoriesPage(false);
    setCategory("All");
    setQuery("");
    setPlace("");
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const backFromAllProducts = () => {
    if (window.history.state?.fromAllProducts) {
      window.history.back();
    } else {
      window.history.replaceState({},"","/");
      setShowAllProductsPage(false);
      setCategory("All");
      window.scrollTo({top:0,behavior:"smooth"});
    }
  };
  const backToCategories = () => {
    if (window.history.state?.fromCategoryPage) {
      window.history.back();
    } else {
      window.history.replaceState({},"","/#top");
      setSelectedCategoryPage(null);
      setCategory("All");
      window.scrollTo({top:0,behavior:"smooth"});
    }
  };
  const backToProducts = () => {
    if (window.history.state?.fromProductDetail) {
      window.history.back();
    } else {
      window.history.replaceState({},"","/#listings");
      setSelectedProductId(null);
      setActiveProductImage(0);
      window.setTimeout(() => document.getElementById("listings")?.scrollIntoView({behavior:"smooth"}),0);
    }
  };

  const authenticate = async (event:FormEvent) => {
    event.preventDefault();
    if (!db) { setNotice("Connect the Supabase project settings to enable accounts."); return; }

    // Phone authentication in Supabase uses international E.164 format.
    const identifier = email.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const digits = identifier.replace(/\D/g,"");
    const authPhoneCandidate = identifier.startsWith("+") ? "+" + digits
      : digits.length === 10 ? "+91" + digits
      : digits.length === 11 && digits.startsWith("0") ? "+91" + digits.slice(1)
      : digits.length === 12 && digits.startsWith("91") ? "+" + digits : "";
    const authPhone = digits.length >= 8 && digits.length <= 15 ? authPhoneCandidate : "";

    if (otpRequired) {
      if (!otpCode.trim()) { setNotice("Enter the verification code sent to your phone."); return; }
      const {error} = await db.auth.verifyOtp({phone:pendingPhone,token:otpCode.trim(),type:"sms"});
      if (error) { setNotice(error.message); return; }
      setOtpRequired(false); setOtpCode(""); setPendingPhone(""); setAuthOpen(false);
      setNotice("Phone number verified. Your account is ready.");
      return;
    }

    if (!isEmail && !authPhone) {
      setNotice("Enter a valid email address or a 10-digit Indian mobile number.");
      return;
    }
    if (mode === "signup") {
      if (!fullName.trim()) { setNotice("Enter your name to create an account."); return; }
      if (password !== confirmPassword) { setNotice("Password and Confirm Password do not match."); return; }
      const result = isEmail
        ? await db.auth.signUp({email:identifier,password,options:{data:{full_name:fullName.trim()}}})
        : await db.auth.signUp({phone:authPhone,password,options:{data:{full_name:fullName.trim()}}});
      if (result.error) { setNotice(result.error.message); return; }
      if (!isEmail && !result.data.session) {
        setPendingPhone(authPhone); setOtpCode(""); setOtpRequired(true);
        setNotice("A verification code has been sent by SMS. Enter it to finish creating your account.");
        return;
      }
      setNotice(isEmail && !result.data.session
        ? "Account created. Check your email to verify your account before signing in."
        : "Account created successfully.");
      setAuthOpen(false);
      setConfirmPassword("");
      return;
    }

    const result = isEmail
      ? await db.auth.signInWithPassword({email:identifier,password})
      : await db.auth.signInWithPassword({phone:authPhone,password});
    if (result.error) setNotice(result.error.message);
    else { setNotice("You are signed in."); setAuthOpen(false); }
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
      seller_name:user.user_metadata?.full_name || user.email?.split("@")[0] || "Seller",image_urls:imageUrls,status:"pending"
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
  const renderProductCards = (listings:Listing[],compact=false) => listings.length ? (
    <div className={compact ? "grid recent-products-grid" : "grid"}>
      {listings.map(item=>(
        <article
          className="product product-clickable"
          key={item.id}
          role="link"
          tabIndex={0}
          aria-label={"View details for "+item.title}
          onClick={()=>openProduct(item)}
          onKeyDown={event=>{
            if(event.target===event.currentTarget && (event.key==="Enter" || event.key===" ")){
              event.preventDefault();
              openProduct(item);
            }
          }}
        >
          <div className="product-gallery">
            <img
              className="product-main-image"
              src={item.image_urls?.[0] || "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=80"}
              alt={item.title}
            />
            <div className="product-thumbnails">
              {item.image_urls?.slice(1).map((image,index)=>(
                <img key={image} src={image} alt={item.title+" photo "+(index+2)}/>
              ))}
            </div>
          </div>
          <div className="product-body">
            <small>{item.category} · {item.condition}</small>
            <h3>{item.title}</h3>
            <strong>{money(item.price)}</strong>
            <p>⌖ {item.city}, {item.state}</p>
            <button
              className="btn primary contact buy-button"
              onClick={event=>{event.stopPropagation();buyItem(item);}}
            >{user ? "Buy / Contact Seller" : "Login to Buy"}</button>
            {!item.contact_phone && <span className="demo-tag">Demo product · sample listing · seller contact unavailable</span>}
          </div>
        </article>
      ))}
      {compact && <button type="button" className="recent-view-all-tile" onClick={openAllProducts} aria-label="View all products">
        <span className="recent-view-all-arrow" aria-hidden="true">→</span>
        <b>View All Products</b>
        <small>Explore the marketplace</small>
      </button>}
    </div>
  ) : (
    <div className="empty">
      <h3>{selectedCategoryPage ? "No products in this category yet" : "No listings found"}</h3>
      <p>{selectedCategoryPage ? "Check back soon for new listings in "+selectedCategoryPage+"." : "Try a different search or category."}</p>
    </div>
  );
  const productCards = renderProductCards(visible);
  const recentProductCards = renderProductCards(visible.slice(0,5),true);


  return <div className="site">
    <header className="header"><a className="logo" href="/" aria-label="VPN Products and Services home"><img src="/vpn-logo.webp" alt="VPN monogram logo" /><b>VPN Products and Services</b></a><div className="header-search"><span className="header-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m16 16 4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products, parts, gadgets and more"/></div><div className="header-actions"><button className="btn buy-top" onClick={openBuy}>🛒 Buy</button>{user ? <button className="btn account-top signed-in" onClick={signOut}><span className="account-top-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M21 4v16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></span><span className="account-top-copy"><b>Sign out</b></span></button> : <button className="btn account-top" onClick={()=>{setMode("login");setAuthOpen(true);}}><span className="account-top-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.3" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M5.2 20c.55-3.4 3.1-5.2 6.8-5.2s6.25 1.8 6.8 5.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></span><span className="account-top-copy"><b>Login</b><small>Register</small></span></button>}<button className="btn primary" onClick={openSell}>＋ Sell item</button></div></header>
    <main id="top">
      {selectedProduct ? <section className="product-detail-page">
        <button className="detail-back" onClick={backToProducts}>← Back to products</button>
        <div className="detail-breadcrumb">Home <span>›</span> {selectedProduct.category} <span>›</span> {selectedProduct.title}</div>
        <div className="product-detail-grid">
          <div className="detail-gallery-card">
            <div className="detail-image-stage">
              <button
                type="button"
                className="detail-image-open"
                onClick={()=>setPhotoViewerOpen(true)}
                aria-label="Open product photo in full screen"
                title="View full-size photo"
              >
                <img src={selectedProduct.image_urls?.[activeProductImage] || selectedProduct.image_urls?.[0]} alt={selectedProduct.title + " photo " + (activeProductImage+1)}/>
              </button>
              {(selectedProduct.image_urls?.length ?? 0) > 1 && <>
                <button
                  type="button"
                  className="detail-image-nav prev"
                  aria-label="Previous product photo"
                  title="Previous photo"
                  onClick={()=>setActiveProductImage(current=>{
                    const total=selectedProduct.image_urls?.length ?? 1;
                    return (current - 1 + total) % total;
                  })}
                >‹</button>
                <button
                  type="button"
                  className="detail-image-nav next"
                  aria-label="Next product photo"
                  title="Next photo"
                  onClick={()=>setActiveProductImage(current=>{
                    const total=selectedProduct.image_urls?.length ?? 1;
                    return (current + 1) % total;
                  })}
                >›</button>
                <span className="detail-image-counter">{activeProductImage+1} / {selectedProduct.image_urls.length}</span>
              </>}
            </div>
            <div className="detail-thumbnails">
              {selectedProduct.image_urls?.map((image,index)=><button key={image} className={activeProductImage===index?"active":""} onClick={()=>setActiveProductImage(index)} aria-label={"Show product photo "+(index+1)}>
                <img src={image} alt=""/>
              </button>)}
            </div>
            <p className="detail-photo-count">{selectedProduct.image_urls?.length || 0} product photos</p>
          </div>
          <div className="detail-summary-card">
            <span className="detail-category">{selectedProduct.category}</span>
            <h1>{selectedProduct.title}</h1>
            <div className="detail-price">{money(selectedProduct.price)}</div>
            <span className="detail-condition">{selectedProduct.condition}</span>
            <p className="detail-location">⌖ {selectedProduct.city}, {selectedProduct.state}</p>
            <button className="btn primary detail-buy-button" onClick={()=>buyItem(selectedProduct)}>{user ? "Buy / Contact Seller" : "Login to Buy"}</button>
            <div className="detail-condition-note">
              <b>Condition and inspection notes</b>
              <p>{selectedProduct.id==="samsung-galaxy-a12-6gb-128gb"
                ? "Used phone. Scratches are visible on the screen and body, with chipped paint and wear on the blue frame. Review all actual product photos and inspect the phone before purchase."
                : selectedProduct.description}</p>
            </div>
          </div>
        </div>
        <section className="detail-tabs-card" aria-label="Product information">
          <div className="detail-tabs" role="tablist" aria-label="Product information tabs">
            <button
              type="button"
              id="product-specifications-tab"
              role="tab"
              aria-selected={activeDetailTab==="specifications"}
              aria-controls="product-information-panel"
              className={activeDetailTab==="specifications" ? "active" : ""}
              onClick={()=>setActiveDetailTab("specifications")}
            >Specifications</button>
            <button
              type="button"
              id="product-description-tab"
              role="tab"
              aria-selected={activeDetailTab==="description"}
              aria-controls="product-information-panel"
              className={activeDetailTab==="description" ? "active" : ""}
              onClick={()=>setActiveDetailTab("description")}
            >Product Description</button>
          </div>
          <div
            id="product-information-panel"
            className="detail-tab-panel"
            role="tabpanel"
            aria-labelledby={activeDetailTab==="specifications" ? "product-specifications-tab" : "product-description-tab"}
          >
            {activeDetailTab==="specifications" ? <div className="detail-spec-table">
              {detailSpecifications.map(row=><div className="detail-spec-row" key={row.label}><b>{row.label}</b><span>{row.value}</span></div>)}
              <div className="detail-spec-row"><b>Listed price</b><span>{money(selectedProduct.price)}</span></div>
              <div className="detail-spec-row"><b>Availability</b><span>Available for enquiry</span></div>
            </div> : <div className="detail-description-panel">
              <h2>Product Description</h2>
              <p>{selectedProduct.description}</p>
            </div>}
          </div>
        </section>
        <button className="detail-back detail-back-bottom" onClick={backToProducts}>← Back to products</button>
      </section> : selectedCategoryPage ? <section className="category-page section">
        <button className="category-page-back" onClick={backToCategories}>← Back to all categories</button>
        <div className="category-page-heading">
          <span className="eyebrow">EXPLORE OUR MARKETPLACE</span>
          <h1>{selectedCategoryPage}</h1>
          <p>Browse products listed under {selectedCategoryPage}.</p>
          <span className="category-page-count">{visible.length} {visible.length===1?"product":"products"} available</span>
        </div>
        {productCards}
      </section> : showAllCategoriesPage ? <section className="all-categories-page section">
        <button className="category-page-back" onClick={backFromAllCategories}>← Back to homepage</button>
        <div className="category-page-heading">
          <span className="eyebrow">EXPLORE OUR MARKETPLACE</span>
          <h1>All Categories</h1>
          <p>Choose a category to browse products and listings.</p>
          <span className="category-page-count">{allCategoryTiles.length} categories</span>
        </div>
        <div className="all-categories-grid category-grid">
          {allCategoryTiles.map(tile=><button className="category-tile" key={tile.name} onClick={()=>openCategory(tile.name)}>
            <span className="tile-icon">{tile.icon}</span><b>{tile.name}</b>
          </button>)}
        </div>
      </section> : showAllProductsPage ? <section className="all-products-page section">
        <button className="category-page-back" onClick={backFromAllProducts}>← Back to homepage</button>
        <div className="category-page-heading">
          <span className="eyebrow">VPN PRODUCTS AND SERVICES MARKETPLACE</span>
          <h1>All Products</h1>
          <p>Browse all available products across categories, newest first.</p>
          <span className="category-page-count">{visible.length} products available</span>
        </div>
        {productCards}
      </section> : <>

      <section className="hero"><div className="hero-copy"><span className="eyebrow">COMPUTER SHOP & MULTI-SERVICE CENTER</span><h1>Buy, Sell, Repair &<br/><em>Get IT Services</em></h1><p>Computer and laptop services, mobile services, website development, and a wide range of new and second-hand products — all in one place.</p><div className="hero-actions"><button className="btn primary" onClick={()=>document.getElementById("listings")?.scrollIntoView({behavior:"smooth"})}>🛒 Browse Products</button><button className="btn light" onClick={()=>document.getElementById("services")?.scrollIntoView({behavior:"smooth"})}>⚒ Our Services</button></div></div><div className="hero-art"><img src="/hero-devices.svg" alt="Computer, laptop, mobile phone, camera, headphones and electronics"/></div></section>
      <section className="feature-strip" aria-label="Our business areas">
        <div className="feature-item"><span>▣</span><b>Computer<br/>Services</b></div>
        <div className="feature-item"><span>▯</span><b>Mobile<br/>Services</b></div>
        <div className="feature-item"><span>🛒</span><b>Buy & Sell <small>(New & Second-Hand)</small></b></div>
        <div className="feature-item"><span>⌘</span><b>Website<br/>Development</b></div>
        <div className="feature-item"><span>▱</span><b>Multi-Brand<br/>Products</b></div>
      </section>
      <section className="category-section section">
        <div className="section-title"><div><span className="eyebrow">EXPLORE OUR MARKETPLACE</span><h2>Shop by Category</h2></div><button className="text-link" onClick={openAllCategories}>View all categories →</button></div>
        <div className="category-grid">{categoryTiles.map(tile=><button className="category-tile" key={tile.name} onClick={()=>openCategory(tile.name)}><span className="tile-icon">{tile.icon}</span><b>{tile.name}</b></button>)}</div>
      </section>
      <section className="services section" id="services"><div className="section-title"><div><span className="eyebrow">MORE THAN A MARKETPLACE</span><h2>Products, Services & Digital Solutions</h2><p>Visit our computer shop, get device support or build your business online.</p></div></div><div className="service-grid"><article className="service-card"><span className="service-icon">▣</span><h3>Computer Shop & Services</h3><p>Computers, laptops and accessories, plus setup, troubleshooting, upgrades and service support.</p><button className="service-link" onClick={()=>setNotice("Contact us for computer and laptop availability or service enquiries.")}>Enquire about computer services →</button></article><article className="service-card"><span className="service-icon">▯</span><h3>Mobile Services</h3><p>Mobile device services, setup and support for everyday phone and tablet needs.</p><button className="service-link" onClick={()=>setNotice("Contact us for mobile service enquiries.")}>Enquire about mobile services →</button></article><article className="service-card"><span className="service-icon">⌘</span><h3>Website Development</h3><p>Websites for businesses, shops, professionals and service providers — from business pages to online stores.</p><button className="service-link" onClick={()=>setNotice("Contact us to discuss your website project.")}>Discuss a website project →</button></article><article className="service-card"><span className="service-icon">⇄</span><h3>Buy & Sell Products</h3><p>Discover or list new and second-hand phones, computers, vehicle parts, electronics, furniture, appliances, books, tools and much more.</p><button className="service-link" onClick={()=>document.getElementById("listings")?.scrollIntoView({behavior:"smooth"})}>Explore marketplace →</button></article></div></section>
      <section className="section recent-products-section" id="listings"><div className="section-title"><div><span className="eyebrow">LATEST MARKETPLACE LISTINGS</span><h2>Recently Added Products</h2><p>Showing {Math.min(visible.length,5)} of {visible.length} products {place ? "near "+place : "across India"}, newest first</p></div></div>{recentProductCards}</section>
      <section className="sell-cta"><div><span className="eyebrow">SELL ALMOST ANYTHING</span><h2>Have something useful to sell?</h2><p>List phones, computers, parts, electronics, furniture, appliances, vehicles and many other items.</p></div><button className="btn primary" onClick={openSell}>Start selling</button></section>
      <section className="safety"><b>Buy and sell safely</b><p>Inspect items before paying, meet in a public place, and never share OTPs, UPI PINs or banking passwords.</p></section>
      <section className="contact-section section" id="contact">
        <div className="section-title"><div><span className="eyebrow">WE'RE HERE TO HELP</span><h2>Contact VPN Products and Services</h2><p>Get in touch for computer services, mobile support, website development or marketplace enquiries.</p></div></div>
        <div className="contact-grid">
          <a className="contact-card" href="mailto:vpnproductsandservices@gmail.com"><span className="contact-icon">✉</span><span><b>Email us</b><small>vpnproductsandservices@gmail.com</small></span></a>
          <a className="contact-card" href="tel:+919916140898"><span className="contact-icon">☎</span><span><b>Call us</b><small>+91 99161 40898</small></span></a>
          <a className="contact-card" href="https://wa.me/919916140898?text=Hello%20VPN%20Products%20and%20Services%2C%20I%20have%20an%20enquiry." target="_blank" rel="noopener noreferrer"><span className="contact-icon brand-icon whatsapp-icon"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.52 3.48A11.87 11.87 0 0 0 12.08 0C5.48 0 .11 5.37.11 11.97c0 2.11.55 4.17 1.6 5.98L0 24l6.2-1.63a11.86 11.86 0 0 0 5.87 1.54h.01c6.6 0 11.97-5.37 11.97-11.97a11.9 11.9 0 0 0-3.53-8.46zM12.08 21.9c-1.83 0-3.62-.49-5.18-1.42l-.37-.22-3.68.97.98-3.59-.24-.37a9.88 9.88 0 1 1 8.49 4.63zm5.42-7.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z"/></svg></span><span><b>WhatsApp us</b><small>+91 99161 40898</small></span></a>
          <a className="contact-card instagram-card" href="https://www.instagram.com/vpnproductsandservices/" target="_blank" rel="noopener noreferrer"><span className="contact-icon brand-icon instagram-icon"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.25" fill="currentColor"/></svg></span><span><b>Follow us on Instagram</b><small>@vpnproductsandservices</small></span></a>
          <a className="contact-card address-card" href="https://www.google.com/maps/search/?api=1&query=2nd%20Ward%20near%20Anjeneya%20Temple%2C%20Malakana%20Maradi%20Road%2C%20Arhal%2C%20Gangavathi%2C%20Karnataka%2C%20India%20583235" target="_blank" rel="noopener noreferrer"><span className="contact-icon">⌖</span><span><b>Visit our location</b><small>2nd Ward, Near Anjeneya Temple, Malakana Maradi Road, Arhal, Gangavathi, Karnataka, India – 583235</small><small className="map-link-label">View on Google Maps →</small></span></a>
        </div>
      </section>
      </>}
    </main>
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand-block">
          <h2 className="footer-brand">VPN Products<br/>and Services</h2>
          <p>Computer and mobile services, website development, and a marketplace for new and second-hand products.</p>
        </div>
        <div className="footer-column">
          <h3>Visit our shop</h3>
          <p className="footer-address">2nd Ward, Near Anjeneya Temple, Malakana Maradi Road, Arhal, Gangavathi, Karnataka 583235, India</p>
          <a className="footer-plain-link" href="https://www.google.com/maps/search/?api=1&query=2nd%20Ward%20near%20Anjeneya%20Temple%2C%20Malakana%20Maradi%20Road%2C%20Arhal%2C%20Gangavathi%2C%20Karnataka%2C%20India%20583235" target="_blank" rel="noopener noreferrer">Get directions →</a>
        </div>
        <div className="footer-column">
          <h3>Contact us</h3>
          <a className="footer-contact-link" href="mailto:vpnproductsandservices@gmail.com"><span aria-hidden="true">✉</span>vpnproductsandservices@gmail.com</a>
          <a className="footer-contact-link" href="tel:+919916140898"><span aria-hidden="true">☎</span>+91 99161 40898</a>
          <div className="footer-socials" aria-label="Social media">
            <a className="footer-social whatsapp" href="https://wa.me/919916140898?text=Hello%20VPN%20Products%20and%20Services%2C%20I%20have%20an%20enquiry." target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.52 3.48A11.87 11.87 0 0 0 12.08 0C5.48 0 .11 5.37.11 11.97c0 2.11.55 4.17 1.6 5.98L0 24l6.2-1.63a11.86 11.86 0 0 0 5.87 1.54h.01c6.6 0 11.97-5.37 11.97-11.97a11.9 11.9 0 0 0-3.53-8.46zM12.08 21.9c-1.83 0-3.62-.49-5.18-1.42l-.37-.22-3.68.97.98-3.59-.24-.37a9.88 9.88 0 1 1 8.49 4.63zm5.42-7.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z"/></svg></a>
            <a className="footer-social instagram" href="https://www.instagram.com/vpnproductsandservices/" target="_blank" rel="noopener noreferrer" aria-label="Follow us on Instagram"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.25" fill="currentColor"/></svg></a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} VPN Products and Services. All rights reserved.</span>
        <a href="https://veereshuppar.com">veereshuppar.com</a>
      </div>
    </footer>
    {photoViewerOpen && selectedProduct && <div
      className="photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Full-size product photo viewer"
      onClick={()=>{setPhotoViewerOpen(false);setPhotoZoomed(false);}}
    >
      <button
        type="button"
        className="photo-lightbox-close"
        aria-label="Close full-size photo"
        onClick={event=>{event.stopPropagation();setPhotoViewerOpen(false);setPhotoZoomed(false);}}
      >×</button>
      <div className="photo-lightbox-media" onClick={event=>event.stopPropagation()}>
        <img
          className={"photo-lightbox-image" + (photoZoomed ? " zoomed" : "")}
          src={selectedProduct.image_urls?.[activeProductImage] || selectedProduct.image_urls?.[0]}
          alt={selectedProduct.title + " full-size photo " + (activeProductImage+1)}
          title={photoZoomed ? "Double-click to fit image" : "Double-click to zoom"}
          onDoubleClick={event=>{event.stopPropagation();setPhotoZoomed(value=>!value);}}
        />
      </div>
      {(selectedProduct.image_urls?.length ?? 0)>1 && <>
        <button
          type="button"
          className="photo-lightbox-nav previous"
          aria-label="Previous photo"
          onClick={event=>{event.stopPropagation();setActiveProductImage(current=>(current-1+selectedProduct.image_urls.length)%selectedProduct.image_urls.length);setPhotoZoomed(false);}}
        >‹</button>
        <button
          type="button"
          className="photo-lightbox-nav next"
          aria-label="Next photo"
          onClick={event=>{event.stopPropagation();setActiveProductImage(current=>(current+1)%selectedProduct.image_urls.length);setPhotoZoomed(false);}}
        >›</button>
        <div className="photo-lightbox-dots" onClick={event=>event.stopPropagation()} aria-label="Choose product photo">
          {selectedProduct.image_urls.map((image,index)=><button
            type="button"
            key={image}
            className={activeProductImage===index?"active":""}
            aria-label={"Show photo "+(index+1)}
            aria-current={activeProductImage===index?"true":undefined}
            onClick={()=>{setActiveProductImage(index);setPhotoZoomed(false);}}
          />)}
        </div>
      </>}
      <span className="photo-lightbox-count">{activeProductImage+1} / {selectedProduct.image_urls?.length || 1}</span>
    </div>}
    {notice && <button className="notice" onClick={()=>setNotice("")}>{notice}　×</button>}
    {authOpen && <div className="overlay" onClick={()=>setAuthOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setAuthOpen(false)}>×</button><h2>{otpRequired?"Verify your phone number":mode==="login"?"Welcome back":"Create an account"}</h2>{otpRequired ? <form onSubmit={authenticate}><p className="auth-hint">Enter the SMS verification code sent to {pendingPhone}.</p><label>Verification code<input required type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otpCode} onChange={e=>setOtpCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6-digit code"/></label><button className="btn primary full">Verify phone</button></form> : <form onSubmit={authenticate}>{mode==="signup" && <label>Full Name<input required type="text" autoComplete="name" maxLength={80} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Enter your full name"/></label>}<label>Email or Phone Number<input required type="text" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address or mobile number"/></label><label>Password<input required minLength={6} autoComplete={mode==="login"?"current-password":"new-password"} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters"/></label>{mode==="signup" && <label>Confirm Password<input required minLength={6} autoComplete="new-password" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter your password"/></label>}<button className="btn primary full">{mode==="login"?"Sign in":"Create account"}</button>{mode==="signup" && <p className="auth-hint">Use an email address or an Indian 10-digit mobile number. Phone registration requires SMS verification.</p>}</form>}{!otpRequired && <button className="switch" onClick={()=>{setMode(mode==="login"?"signup":"login");setConfirmPassword("");}}>{mode==="login"?"New user? Create an account":"Already registered? Sign in"}</button>}</div></div>}
    {sellOpen && <div className="overlay" onClick={()=>setSellOpen(false)}><div className="modal wide" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSellOpen(false)}>×</button><h2>Post an item</h2><form onSubmit={submitListing}><label>Title<input required maxLength={90} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Category<select value={formCategory} onChange={e=>setFormCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Price in ₹<input required min="1" type="number" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Description<textarea required minLength={20} maxLength={1500} rows={4} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Condition<select value={condition} onChange={e=>setCondition(e.target.value)}><option>Like New</option><option>Good</option><option>Fair</option><option>For Parts</option></select></label><div className="row"><label>City<input required value={city} onChange={e=>setCity(e.target.value)} placeholder="Bengaluru"/></label><label>State<input required value={state} onChange={e=>setState(e.target.value)} placeholder="Karnataka"/></label></div><label>WhatsApp / phone<input required inputMode="numeric" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="10-digit mobile number"/></label><label>Photos (up to 5)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setPhotos(e.target.files)}/></label><button className="btn primary full">Submit for review</button><small>Listings appear publicly only after admin approval.</small></form></div></div>}
  </div>;
}
