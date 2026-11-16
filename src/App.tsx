import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import indiaStatesDistricts from "./data/india_states_districts.json";

type Listing = {
  id: string; title: string; description: string; price: number; category: string;
  condition: string; city: string; state: string; contact_phone: string;
  seller_name: string; image_urls: string[]; status: string; created_at: string;
  quantity?: number; stock?: number;
  package_weight_kg?: number | null; package_length_cm?: number | null; package_breadth_cm?: number | null; package_height_cm?: number | null;
  is_test_product?: boolean;
};
type CustomerAddress = {
  id: string; full_name: string; phone: string; pincode: string;
  address_line1: string; address_line2: string; landmark: string | null;
  city: string; state: string; district?: string | null; address_type: "Home" | "Work" | "Other";
  is_default: boolean; created_at: string;
};
type AddressDraft = {
  full_name: string; phone: string; pincode: string; address_line1: string;
  address_line2: string; landmark: string; city: string; state: string; district: string;
  address_type: "Home" | "Work" | "Other"; is_default: boolean;
};
type MarketplaceOrderItem = {
  id: string; order_id: string; product_title: string; quantity: number; unit_price: number;
  image_url?: string; is_test_product?: boolean;
};
type MarketplaceReturnRequest = {
  id: string; order_id: string; buyer_id: string; reason: string; details: string; status: string;
  admin_note?: string | null; return_awb?: string | null; return_tracking_url?: string | null;
  return_shipping_status?: string | null;
};
type MarketplaceOrder = {
  id: string; buyer_id: string; delivery_address: any; subtotal: number; delivery_fee: number;
  status: string; created_at: string; payment_status: string; payment_method: string;
  shipping_status: string; shipping_awb?: string | null; shipping_courier_name?: string | null;
  shipping_eta?: string | null; shipping_tracking_url?: string | null; tracking_payload?: any;
  tracking_updated_at?: string | null; is_test_order?: boolean; cancellation_reason?: string | null;
  items: MarketplaceOrderItem[]; returnRequest?: MarketplaceReturnRequest | null;
};
const emptyAddressDraft:AddressDraft = {
  full_name:"",phone:"",pincode:"",address_line1:"",address_line2:"",
  landmark:"",city:"",state:"",district:"",address_type:"Home",is_default:false
};
const isPreviewProduct = (item:Listing) => item.id.startsWith("demo-") || item.id.startsWith("sample-");
// Temporary sample stock is set per demo product. Replace these values with the
// actual inventory numbers when they are provided by the business.
const DEMO_PREVIEW_STOCK_BY_ID:Record<string,number> = {
  "demo-1":3,
  "demo-2":5,
  "demo-3":4,
  "sample-google-pixel-7a":3,
  "sample-lenovo-ideapad-3":4,
  "sample-logitech-keyboard-mouse":6,
  "sample-jbl-bluetooth-speaker":5,
  "sample-car-led-headlight":8,
  "sample-kitchen-mixer-grinder":7,
  "sample-study-desk":3,
  "sample-canon-eos-camera":4,
  "sample-travel-backpack":9,
  "sample-cricket-kit":5
};
const MAX_CART_QUANTITY = 99;
const getCartQuantity = (item:Listing) => Math.max(1,Math.min(MAX_CART_QUANTITY,Number(item.quantity)||1));
const getStockForDisplay = (item:Listing) => {
  const suppliedStock = Number(item.stock);
  if (Number.isInteger(suppliedStock) && suppliedStock>=0) return suppliedStock;
  if (isPreviewProduct(item)) return DEMO_PREVIEW_STOCK_BY_ID[item.id] ?? 5;
  return null;
};
const getCartStockLimit = (item:Listing) => {
  const stock = getStockForDisplay(item);
  return stock===null ? MAX_CART_QUANTITY : Math.min(stock,MAX_CART_QUANTITY);
};
const getStockMessage = (item:Listing) => {
  const stock = getStockForDisplay(item);
  if (stock===null) return "";
  if (stock===0) return "Out of stock";
  return stock>0 && stock<10 ? "Only "+stock+" left" : "";
};
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
const db: SupabaseClient | null = url && key ? createClient(url, key) : null;
const authRedirectUrl = "https://veereshuppar.com/";
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
  const [profileMenuOpen,setProfileMenuOpen] = useState(false);
  const [profilePanel,setProfilePanel] = useState<"view"|"edit"|"password"|"details"|null>(null);
  const [profileNameDraft,setProfileNameDraft] = useState("");
  const [avatarFile,setAvatarFile] = useState<File|null>(null);
  const [newPassword,setNewPassword] = useState("");
  const [confirmNewPassword,setConfirmNewPassword] = useState("");
  const [profileEmailDraft,setProfileEmailDraft] = useState("");
  const [profilePhoneDraft,setProfilePhoneDraft] = useState("");
  const [pendingPhoneChange,setPendingPhoneChange] = useState("");
  const [phoneChangeCode,setPhoneChangeCode] = useState("");
  const [profileSaving,setProfileSaving] = useState(false);
  const [cartItems,setCartItems] = useState<Listing[]>([]);
  const [showCartPage,setShowCartPage] = useState(() => window.location.pathname.replace(/\/+$/,"")==="/cart");
  const [showOrdersPage,setShowOrdersPage] = useState(false);
  const [isAdmin,setIsAdmin] = useState(false);
  const [orders,setOrders] = useState<MarketplaceOrder[]>([]);
  const [ordersLoading,setOrdersLoading] = useState(false);
  const [orderBusyId,setOrderBusyId] = useState("");
  const [returnOrderId,setReturnOrderId] = useState("");
  const [returnReason,setReturnReason] = useState("Damaged product");
  const [returnDetails,setReturnDetails] = useState("");
  const [returnBusy,setReturnBusy] = useState(false);
  const [checkoutStep,setCheckoutStep] = useState<"cart"|"address"|"review"|"success">("cart");
  const [checkoutItemIds,setCheckoutItemIds] = useState<string[]>([]);
  const [addresses,setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId,setSelectedAddressId] = useState("");
  const [addressFormOpen,setAddressFormOpen] = useState(false);
  const [addressDraft,setAddressDraft] = useState<AddressDraft>(emptyAddressDraft);
  const [commerceSaving,setCommerceSaving] = useState(false);
  const [shippingQuoteId,setShippingQuoteId] = useState("");
  const [shippingQuotes,setShippingQuotes] = useState<Array<{courier_id:number;courier_name:string;rate:number;etd?:string;estimated_delivery_days?:number}>>([]);
  const [selectedShippingCourierId,setSelectedShippingCourierId] = useState<number|null>(null);
  const [shippingQuoteBusy,setShippingQuoteBusy] = useState(false);
  const [completedOrderId,setCompletedOrderId] = useState("");
  const profileMenuRef = useRef<HTMLDivElement|null>(null);
  const [sellOpen,setSellOpen] = useState(false);
  const [mode,setMode] = useState<"login"|"signup">("login");
  const [showResendConfirmation,setShowResendConfirmation] = useState(false);
  const [passwordResetMode,setPasswordResetMode] = useState<"request"|"update"|null>(null);
  const [resetPassword,setResetPassword] = useState("");
  const [confirmResetPassword,setConfirmResetPassword] = useState("");
  const [passwordResetBusy,setPasswordResetBusy] = useState(false);
  const [email,setEmail] = useState("");
  const [fullName,setFullName] = useState("");
  const [password,setPassword] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");
  const [title,setTitle] = useState("");
  const [description,setDescription] = useState("");
  const [price,setPrice] = useState("");
  const [packageWeightKg,setPackageWeightKg] = useState("");
  const [packageLengthCm,setPackageLengthCm] = useState("");
  const [packageBreadthCm,setPackageBreadthCm] = useState("");
  const [packageHeightCm,setPackageHeightCm] = useState("");
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

  // Automatically dismiss notification toasts while allowing manual dismissal.
  useEffect(() => {
    if (!notice) return;
    const timeoutId = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const refresh = async (sessionUser: any = user) => {
    if (!db) return;
    // Guests can browse public listing details, but never receive seller phone numbers.
    const source = sessionUser ? db.from("listings") : db.from("listings_public");
    const {data,error} = await source.select("*").eq("status","active").order("created_at",{ascending:false});
    if (!error && data) setItems([...(data as Listing[]), ...featuredListings, ...sampleListings]);
    if (error) setNotice("Could not load live listings: " + error.message);
  };
  const loadCommerceData = async (sessionUser:any) => {
    if (!db || !sessionUser) {
      setCartItems([]);
      setAddresses([]);
      setSelectedAddressId("");
      setIsAdmin(false);
      setOrders([]);
      setOrdersLoading(false);
      return;
    }
    const [cartResult,addressResult,profileResult] = await Promise.all([
      db.from("cart_items").select("item_key,item_snapshot,quantity").eq("user_id",sessionUser.id).order("created_at",{ascending:true}),
      db.from("customer_addresses").select("*").eq("user_id",sessionUser.id).order("is_default",{ascending:false}).order("created_at",{ascending:false}),
      db.from("profiles").select("is_admin").eq("id",sessionUser.id).maybeSingle()
    ]);
    const shopAdmin = profileResult.data?.is_admin === true;
    setIsAdmin(shopAdmin);
    setOrdersLoading(true);
    let orderQuery = db.from("marketplace_orders").select("*").order("created_at",{ascending:false});
    if (!shopAdmin) orderQuery = orderQuery.eq("buyer_id",sessionUser.id);
    const {data:orderRows,error:ordersError} = await orderQuery;
    if (ordersError) {
      setOrders([]);
      setNotice("Order history needs supabase/order-lifecycle.sql. " + ordersError.message);
    } else {
      const orderIds = (orderRows || []).map((order:any)=>order.id);
      if (!orderIds.length) {
        setOrders([]);
      } else {
        const [itemRows,returnRows] = await Promise.all([
          db.from("marketplace_order_items").select("*").in("order_id",orderIds),
          db.from("marketplace_return_requests").select("*").in("order_id",orderIds)
        ]);
        if (itemRows.error || returnRows.error) {
          setNotice("Order details need supabase/order-lifecycle.sql. " + (itemRows.error?.message || returnRows.error?.message));
        }
        const orderItems = itemRows.data || [];
        const returns = returnRows.data || [];
        setOrders((orderRows || []).map((order:any)=>({
          ...order,
          items:orderItems.filter((item:any)=>item.order_id===order.id),
          returnRequest:returns.find((request:any)=>request.order_id===order.id) || null
        })) as MarketplaceOrder[]);
      }
    }
    setOrdersLoading(false);
    if (cartResult.error) {
      setNotice("Cart setup needs the Supabase commerce SQL migration. " + cartResult.error.message);
    } else {
      setCartItems((cartResult.data || []).map((row:any)=>({...row.item_snapshot,id:row.item_key,quantity:Number(row.quantity)||1}) as Listing));
    }
    if (addressResult.error) {
      setNotice("Address setup needs the Supabase commerce SQL migration. " + addressResult.error.message);
    } else {
      const rows = (addressResult.data || []) as CustomerAddress[];
      setAddresses(rows);
      setSelectedAddressId(current=>rows.some(address=>address.id===current)
        ? current : rows.find(address=>address.is_default)?.id || rows[0]?.id || "");
    }
  };
  useEffect(() => {
    if (user?.id) {
      void loadCommerceData(user);
    } else {
      setCartItems([]);
      setAddresses([]);
      setSelectedAddressId("");
      setIsAdmin(false);
      setOrders([]);
      setShowOrdersPage(false);
    }
  }, [user?.id]);

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
    const {data:{subscription}} = db.auth.onAuthStateChange((event,session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      void Promise.resolve().then(() => refresh(sessionUser));
      if (event==="PASSWORD_RECOVERY") {
        setMode("login");
        setPasswordResetMode("update");
        setShowResendConfirmation(false);
        setResetPassword("");
        setConfirmResetPassword("");
        setAuthOpen(true);
        setNotice("Choose a new password for your account.");
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeOnOutside = (event:MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    const closeOnEscape = (event:KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown",closeOnOutside);
    document.addEventListener("keydown",closeOnEscape);
    return () => {
      document.removeEventListener("mousedown",closeOnOutside);
      document.removeEventListener("keydown",closeOnEscape);
    };
  }, [profileMenuOpen]);

  // Show a useful message when Supabase returns an expired or invalid email link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorCode = params.get("error_code");
    const errorDescription = params.get("error_description");
    if (errorCode || errorDescription) {
      setMode("login");
      setAuthOpen(true);
      setShowResendConfirmation(errorCode === "otp_expired");
      setNotice(errorCode === "otp_expired"
        ? "This email confirmation link has expired. Enter your email below and request a new confirmation email."
        : errorDescription || "Email verification could not be completed. Please request a new confirmation email.");
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    }
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
      const cartPage = window.location.pathname.replace(/\/+$/,"")==="/cart";
      setShowCartPage(cartPage);
      setSelectedProductId(productIdFromPath());
      setSelectedCategoryPage(categoryPage);
      setShowAllProductsPage(isAllProductsPath());
      setShowAllCategoriesPage(isAllCategoriesPath());
      setCategory(categoryPage ?? "All");
      setActiveProductImage(0);
      setActiveDetailTab("specifications");
      window.scrollTo({top:0,behavior:"auto"});
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

  const resendEmailConfirmation = async () => {
    if (!db) { setNotice("Connect the Supabase project settings to enable accounts."); return; }
    const identifier = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      setNotice("Enter the email address you used when creating your account.");
      return;
    }
    const {error} = await db.auth.resend({
      type:"signup",
      email:identifier,
      options:{emailRedirectTo:authRedirectUrl}
    });
    if (error) setNotice(error.message);
    else setNotice("A new confirmation email has been sent. Open the newest email and confirm your account.");
  };

  const requestPasswordReset = async (event:FormEvent) => {
    event.preventDefault();
    if (!db) { setNotice("Connect the Supabase project settings to enable password reset."); return; }
    const identifier=email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(identifier)) {
      setNotice("Enter a valid email address to receive your password reset link.");
      return;
    }
    setPasswordResetBusy(true);
    try {
      const {error}=await db.auth.resetPasswordForEmail(identifier,{redirectTo:authRedirectUrl});
      if (error) { setNotice(error.message); return; }
      setPasswordResetMode(null);
      setShowResendConfirmation(false);
      setNotice("If an account exists for that email address, a password reset link has been sent. Check your inbox and spam folder.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not send the password reset email. Please try again.");
    } finally {
      setPasswordResetBusy(false);
    }
  };

  const savePasswordReset = async (event:FormEvent) => {
    event.preventDefault();
    if (!db) { setNotice("Connect the Supabase project settings to update your password."); return; }
    if (resetPassword.length<8) { setNotice("Your new password must contain at least 8 characters."); return; }
    if (resetPassword!==confirmResetPassword) { setNotice("New Password and Confirm Password do not match."); return; }
    setPasswordResetBusy(true);
    try {
      const {data,error}=await db.auth.updateUser({password:resetPassword});
      if (error) { setNotice(error.message); return; }
      if (data.user) setUser(data.user);
      setPasswordResetMode(null);
      setResetPassword("");
      setConfirmResetPassword("");
      setPassword("");
      setConfirmPassword("");
      setAuthOpen(false);
      setNotice("Your password has been reset successfully. You are now signed in.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update your password. Please request a new reset link.");
    } finally {
      setPasswordResetBusy(false);
    }
  };

  const phoneAuthErrorMessage = (error:any) => {
    const code=String(error?.code || "").toLowerCase();
    const message=String(error?.message || "Phone verification failed. Please try again.");
    if (code==="phone_provider_disabled") {
      return "Phone registration is disabled in Supabase. Open Authentication → Sign In / Providers → Phone and enable it. If phone confirmation is enabled, also configure an SMS provider.";
    }
    if (code==="sms_send_failed") {
      return "Supabase could not send the SMS. Check your SMS provider credentials, sender ID and message settings. For Indian mobile numbers, check applicable TRAI DLT registration and templates with your SMS provider.";
    }
    if (code==="over_sms_send_rate_limit") {
      return "Too many SMS codes were requested for this number. Wait before trying again, then request a new code.";
    }
    if (code==="over_request_rate_limit") {
      return "Too many registration requests were made. Wait a few minutes before trying again.";
    }
    if (code==="phone_exists" || code==="user_already_exists" || /phone.*already|already.*phone/i.test(message)) {
      return "This phone number is already registered. Switch to Sign in or use a different phone number.";
    }
    if (code==="phone_not_confirmed") {
      return "This phone number is not verified yet. Complete SMS verification before signing in.";
    }
    if (code==="otp_expired") {
      return "That verification code has expired. Request a new SMS code and try again.";
    }
    return message;
  };

  const authenticate = async (event:FormEvent) => {
    event.preventDefault();
    if (!db) { setNotice("Connect the Supabase project settings to enable accounts."); return; }

    // Login and new customer registration both use email addresses only.
    const identifier = email.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(identifier);
    if (!isEmail) {
      setNotice("Please enter a valid email address. Sign-in and registration use email addresses only.");
      return;
    }
    if (password.length < 8) {
      setNotice("Password must contain at least 8 characters.");
      return;
    }
    if (mode === "signup") {
      if (!fullName.trim()) { setNotice("Enter your name to create an account."); return; }
      if (password !== confirmPassword) { setNotice("Password and Confirm Password do not match."); return; }
      const result = await db.auth.signUp({
        email:identifier,
        password,
        options:{data:{full_name:fullName.trim()},emailRedirectTo:authRedirectUrl}
      });
      if (result.error) {
        const authError = result.error.message.toLowerCase();
        if (/already registered|email_exists|user_already_exists/.test(authError)) {
          setMode("login");
          setNotice("This email address is already registered. Please sign in, or use a different email address.");
        } else if (/rate limit|too many requests|email rate limit/.test(authError)) {
          setNotice("Registration email limit reached. Please wait before trying again, or configure a custom SMTP email provider in Supabase.");
        } else {
          setNotice(result.error.message);
        }
        return;
      }
      // Supabase may return an obfuscated user with no identities for an
      // existing email when email confirmation is enabled. No new account
      // was created in that case, so send the customer to the Login form.
      if (isEmail && !result.data.session && result.data.user?.identities?.length === 0) {
        setMode("login");
        setNotice("This email address is already registered. Please sign in with your existing account or use a different email address.");
        return;
      }
      setNotice(!result.data.session
        ? "Account created. Check your email to verify your account before signing in."
        : "Account created successfully.");
      setAuthOpen(false);
      setConfirmPassword("");
      return;
    }

    setShowResendConfirmation(false);
    const result = await db.auth.signInWithPassword({email:identifier,password});
    if (result.error) {
      setNotice(result.error.message);
      if (/email not confirmed/i.test(result.error.message)) {
        setShowResendConfirmation(true);
        setNotice("Your email address is not verified yet. Request a new confirmation email below.");
      }
    } else { setShowResendConfirmation(false); setNotice("You are signed in."); setAuthOpen(false); }
  };

  const submitListing = async (event:FormEvent) => {
    event.preventDefault();
    if (!db || !user) { setNotice("Please sign in before posting a listing."); setAuthOpen(true); return; }
    if (!title.trim() || description.trim().length < 20 || Number(price) <= 0 || !city.trim() || !state.trim() || phone.replace(/\D/g,"").length < 10 || Number(packageWeightKg)<=0 || Number(packageLengthCm)<=0.5 || Number(packageBreadthCm)<=0.5 || Number(packageHeightCm)<=0.5) {
      setNotice("Complete all fields, enter packed weight and dimensions, and provide a valid 10-digit phone number."); return;
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
      seller_name:user.user_metadata?.full_name || user.email?.split("@")[0] || "Seller",image_urls:imageUrls,status:"pending",package_weight_kg:Number(packageWeightKg),package_length_cm:Number(packageLengthCm),package_breadth_cm:Number(packageBreadthCm),package_height_cm:Number(packageHeightCm)
    });
    if (error) setNotice(error.message);
    else { setNotice("Listing submitted for review. It will appear after approval."); setSellOpen(false); setTitle(""); setDescription(""); setPrice(""); setCity(""); setState(""); setPhone(""); setPhotos(null); setPackageWeightKg(""); setPackageLengthCm(""); setPackageBreadthCm(""); setPackageHeightCm(""); }
  };

  const [formCategory,setFormCategory] = useState("Mobiles & Tablets");
  const closeProfilePanel = () => {
    setProfilePanel(null);
    setAvatarFile(null);
    setNewPassword("");
    setConfirmNewPassword("");
    setPhoneChangeCode("");
    setPendingPhoneChange("");
  };
  const openProfilePanel = (panel:"view"|"edit"|"password"|"details") => {
    if (!user) return;
    setProfileMenuOpen(false);
    setProfileNameDraft(user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || user.phone || "User");
    setProfileEmailDraft(user.email || "");
    setProfilePhoneDraft(user.phone || "");
    setAvatarFile(null);
    setProfilePanel(panel);
  };
  const signOut = async () => {
    setProfileMenuOpen(false);
    closeProfilePanel();
    const {error} = db ? await db.auth.signOut() : {error:null};
    if (error) { setNotice(error.message); return; }
    setUser(null);
    setCartItems([]);
    setAddresses([]);
    setOrders([]);
    setIsAdmin(false);
    setShowOrdersPage(false);
    setSelectedAddressId("");
    setCheckoutItemIds([]);
    // Clear the locally held auth form values as well as the Supabase session.
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFullName("");
    setNotice("Signed out successfully.");
  };
  const saveProfileSettings = async (event:FormEvent) => {
    event.preventDefault();
    if (!db || !user) { setNotice("Please sign in to update your profile."); return; }
    const name = profileNameDraft.trim();
    if (!name) { setNotice("Enter your profile name."); return; }
    if (avatarFile && (!["image/jpeg","image/png","image/webp"].includes(avatarFile.type) || avatarFile.size > 4*1024*1024)) {
      setNotice("Choose a JPG, PNG or WEBP profile photo under 4 MB.");
      return;
    }
    setProfileSaving(true);
    let uploadedAvatarPath:string|null = null;
    try {
      let avatarUrl = user.user_metadata?.avatar_url || "";
      if (avatarFile) {
        const extension = avatarFile.type === "image/png" ? "png" : avatarFile.type === "image/webp" ? "webp" : "jpg";
        uploadedAvatarPath = user.id + "/profile/avatar-" + crypto.randomUUID() + "." + extension;
        const {error:uploadError} = await db.storage.from("listing-images").upload(uploadedAvatarPath,avatarFile,{
          cacheControl:"3600",upsert:false,contentType:avatarFile.type
        });
        if (uploadError) throw uploadError;
        avatarUrl = db.storage.from("listing-images").getPublicUrl(uploadedAvatarPath).data.publicUrl;
      }
      const {data,error} = await db.auth.updateUser({data:{full_name:name,avatar_url:avatarUrl}});
      if (error) {
        if (uploadedAvatarPath) await db.storage.from("listing-images").remove([uploadedAvatarPath]);
        throw error;
      }
      if (data.user) setUser(data.user);
      const previousAvatarUrl = user.user_metadata?.avatar_url;
      const marker = "/storage/v1/object/public/listing-images/";
      if (uploadedAvatarPath && typeof previousAvatarUrl === "string" && previousAvatarUrl.includes(marker)) {
        const previousPath = decodeURIComponent(previousAvatarUrl.split(marker)[1].split("?")[0]);
        if (previousPath.startsWith(user.id + "/profile/") && previousPath !== uploadedAvatarPath) {
          await db.storage.from("listing-images").remove([previousPath]);
        }
      }
      closeProfilePanel();
      setNotice("Profile updated successfully.");
    } catch (error:any) {
      setNotice(error?.message || "Could not update your profile. Please try again.");
    } finally {
      setProfileSaving(false);
    }
  };
  const changeAccountPassword = async (event:FormEvent) => {
    event.preventDefault();
    if (!db || !user) { setNotice("Please sign in to change your password."); return; }
    if (newPassword.length < 8) { setNotice("Use a password with at least 8 characters."); return; }
    if (newPassword !== confirmNewPassword) { setNotice("New password and confirmation do not match."); return; }
    setProfileSaving(true);
    const {error} = await db.auth.updateUser({password:newPassword});
    setProfileSaving(false);
    if (error) { setNotice(error.message); return; }
    closeProfilePanel();
    setNotice("Your password has been changed successfully.");
  };
  const updateAccountEmail = async (event:FormEvent) => {
    event.preventDefault();
    if (!db || !user) { setNotice("Please sign in to update account details."); return; }
    const nextEmail = profileEmailDraft.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) { setNotice("Enter a valid email address."); return; }
    if (nextEmail.toLowerCase() === (user.email || "").toLowerCase()) { setNotice("That is already your registered email address."); return; }
    setProfileSaving(true);
    const {error} = await db.auth.updateUser({email:nextEmail});
    setProfileSaving(false);
    if (error) { setNotice(error.message); return; }
    setNotice("A confirmation link was sent to your new email address. Your email changes after you confirm it.");
  };
  const updateAccountPhone = async (event:FormEvent) => {
    event.preventDefault();
    if (!db || !user) { setNotice("Please sign in to update account details."); return; }
    const raw = profilePhoneDraft.trim();
    const digits = raw.replace(/\D/g,"");
    const nextPhone = raw.startsWith("+") ? "+" + digits
      : digits.length === 10 ? "+91" + digits
      : digits.length === 11 && digits.startsWith("0") ? "+91" + digits.slice(1)
      : digits.length === 12 && digits.startsWith("91") ? "+" + digits : "";
    if (!nextPhone || digits.length < 10 || digits.length > 12) { setNotice("Enter a valid Indian mobile number with country code if needed."); return; }
    if (nextPhone === user.phone) { setNotice("That is already your registered phone number."); return; }
    setProfileSaving(true);
    const {error} = await db.auth.updateUser({phone:nextPhone});
    setProfileSaving(false);
    if (error) { setNotice(error.message); return; }
    setPendingPhoneChange(nextPhone);
    setPhoneChangeCode("");
    setNotice("A verification code has been sent to " + nextPhone + ". Enter it below to confirm the new number.");
  };
  const verifyAccountPhoneChange = async (event:FormEvent) => {
    event.preventDefault();
    if (!db || !pendingPhoneChange || !phoneChangeCode.trim()) { setNotice("Enter the verification code sent to your new phone number."); return; }
    setProfileSaving(true);
    const {data,error} = await db.auth.verifyOtp({phone:pendingPhoneChange,token:phoneChangeCode.trim(),type:"phone_change"});
    setProfileSaving(false);
    if (error) { setNotice(error.message); return; }
    if (data.user) setUser(data.user);
    setPendingPhoneChange("");
    setPhoneChangeCode("");
    setProfilePhoneDraft(data.user?.phone || pendingPhoneChange);
    setNotice("Phone number updated and verified successfully.");
  };

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

  const requireLoginForCommerce = () => {
    setMode("login");
    setNotice("Please sign in or create an account to use the shopping cart and checkout.");
    setAuthOpen(true);
  };
  const persistCartItem = async (item:Listing,showMessage=true,incrementIfExists=true):Promise<boolean> => {
    if (!user) { requireLoginForCommerce(); return false; }
    if (!db) { setNotice("Cart is unavailable because the Supabase connection is not configured."); return false; }
    const existing = cartItems.find(current=>current.id===item.id);
    const currentQuantity = existing ? getCartQuantity(existing) : 0;
    const stockLimit = getCartStockLimit(item);
    if (stockLimit===0) {
      setNotice("This product is currently out of stock.");
      return false;
    }
    if (existing) {
      if (!incrementIfExists) return true;
      if (currentQuantity>=stockLimit) {
        setNotice(isPreviewProduct(item) ? "Only 2 left in this demo product." : "You have reached the available stock for this product.");
        return true;
      }
      const nextQuantity=currentQuantity+1;
      const {error} = await db.from("cart_items").update({quantity:nextQuantity})
        .eq("user_id",user.id).eq("item_key",item.id);
      if (error) {
        const detail=error.message || "";
        setNotice(/quantity|schema cache/i.test(detail)
          ? "Supabase is missing the cart quantity column. Run the latest supabase/cart-quantity.sql in Supabase SQL Editor, then refresh the page. " + detail
          : "Could not update the cart quantity. " + detail);
        return false;
      }
      setCartItems(current=>current.map(currentItem=>currentItem.id===item.id?{...currentItem,quantity:nextQuantity}:currentItem));
      if (showMessage) setNotice("Quantity updated to "+nextQuantity+".");
      return true;
    }
    const snapshot = {
      id:item.id,title:item.title,description:item.description,price:Number(item.price),
      category:item.category,condition:item.condition,city:item.city,state:item.state,
      seller_name:item.seller_name,image_urls:item.image_urls || [],stock:item.stock
    };
    const {error} = await db.from("cart_items").upsert({
      user_id:user.id,item_key:item.id,item_snapshot:snapshot,quantity:1
    },{onConflict:"user_id,item_key"});
    if (error) {
      const detail=error.message || "";
      setNotice(/quantity|schema cache/i.test(detail)
        ? "Supabase is missing the cart quantity column. Run the latest supabase/cart-quantity.sql in Supabase SQL Editor, then refresh the page. " + detail
        : "Could not save this item to your cart. " + detail);
      return false;
    }
    setCartItems(current=>current.some(currentItem=>currentItem.id===item.id)?current:[...current,{...item,quantity:1}]);
    if (showMessage) setNotice("Added to your cart.");
    return true;
  };
  const addToCart = async (item:Listing) => {
    await persistCartItem(item,true,true);
  };
  const openCartPage = () => {
    if (!user) { requireLoginForCommerce(); return; }
    if (!showCartPage) {
      const returnTo = window.location.pathname + window.location.search + window.location.hash;
      window.history.pushState({fromCartPage:true,returnTo},"","/cart");
    }
    setShowCartPage(true);
    setSelectedProductId(null);
    setSelectedCategoryPage(null);
    setShowAllCategoriesPage(false);
    setShowAllProductsPage(false);
    setCheckoutStep("cart");
    setCheckoutItemIds([]);
    setAddressFormOpen(false);
    setProfileMenuOpen(false);
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const openMyOrders = () => {
    if (!user) { requireLoginForCommerce(); return; }
    setProfileMenuOpen(false);
    setShowOrdersPage(true);
    setShowCartPage(false);
    setSelectedProductId(null);
    setSelectedCategoryPage(null);
    setShowAllCategoriesPage(false);
    setShowAllProductsPage(false);
    setCategory("All");
    void loadCommerceData(user);
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const cancelCustomerOrder = async (orderId:string) => {
    if (!db || !user) { requireLoginForCommerce(); return; }
    if (!window.confirm("Cancel this order request? If a courier shipment has already been booked, cancellation will be sent to Shiprocket and may be refused after dispatch.")) return;
    setOrderBusyId(orderId);
    const {data,error} = await db.functions.invoke("shiprocket",{body:{action:"cancel",orderId,reason:"Cancelled by customer"}});
    setOrderBusyId("");
    if (error || data?.error) { setNotice(data?.error || error?.message || "Could not cancel this order."); return; }
    setNotice("Order cancelled successfully.");
    await loadCommerceData(user);
  };
  const refreshOrderTracking = async (orderId:string) => {
    if (!db || !user) return;
    setOrderBusyId(orderId);
    const {data,error} = await db.functions.invoke("shiprocket",{body:{action:"track",orderId}});
    setOrderBusyId("");
    if (error || data?.error) { setNotice(data?.error || error?.message || "Could not refresh delivery status."); return; }
    setNotice("Latest delivery status: "+(data.status || "Updated"));
    await loadCommerceData(user);
  };
  const submitReturnRequest = async (orderId:string) => {
    if (!db || !user) return;
    if (!returnReason.trim()) { setNotice("Select a return reason."); return; }
    setReturnBusy(true);
    const {data,error} = await db.rpc("create_marketplace_return_request",{
      p_order_id:orderId,p_reason:returnReason,p_details:returnDetails.trim()
    });
    setReturnBusy(false);
    if (error) { setNotice("Could not submit your return request. "+error.message); return; }
    setReturnOrderId("");
    setReturnDetails("");
    setReturnReason("Damaged product");
    setNotice("Return request submitted. Our shop will review it.");
    await loadCommerceData(user);
  };
  const adminUpdateOrder = async (orderId:string,status?:string,paymentStatus?:string) => {
    if (!db || !isAdmin) return;
    if (paymentStatus==="paid" && !window.confirm("Confirm that you have actually received and verified the customer's advance payment before marking this order as paid.")) return;
    setOrderBusyId(orderId);
    const {data,error} = await db.functions.invoke("shiprocket",{body:{action:"admin-update-order",orderId,status,paymentStatus}});
    setOrderBusyId("");
    if (error || data?.error) { setNotice(data?.error || error?.message || "Could not update this order."); return; }
    setNotice("Order updated.");
    await loadCommerceData(user);
  };
  const adminBookShipment = async (orderId:string) => {
    if (!db || !isAdmin) return;
    if (!window.confirm("Book this prepaid Shiprocket shipment and request pickup from your shop?")) return;
    setOrderBusyId(orderId);
    const {data,error} = await db.functions.invoke("shiprocket",{body:{action:"book",orderId}});
    setOrderBusyId("");
    if (error || data?.error) { setNotice(data?.error || error?.message || "Shipment booking failed."); return; }
    setNotice("Shipment booked. AWB: "+(data.awb || "assigned"));
    await loadCommerceData(user);
  };
  const adminProcessReturn = async (returnRequestId:string,action:"approve-return"|"reject-return") => {
    if (!db || !isAdmin) return;
    const warning = action==="approve-return"
      ? "Approve this return and book a reverse pickup from the customer? Shiprocket reverse-pickup charges may apply."
      : "Reject this customer's return request?";
    if (!window.confirm(warning)) return;
    setOrderBusyId(returnRequestId);
    const {data,error} = await db.functions.invoke("shiprocket",{body:{action,returnRequestId,note:action==="reject-return"?"Return request reviewed by shop.":""}});
    setOrderBusyId("");
    if (error || data?.error) { setNotice(data?.error || error?.message || "Could not process return request."); return; }
    setNotice(action==="approve-return"?"Return approved and reverse pickup scheduled.":"Return request rejected.");
    await loadCommerceData(user);
  };
  const refreshReturnTracking = async (returnRequestId:string) => {
    if (!db || !user) return;
    setOrderBusyId(returnRequestId);
    const {data,error} = await db.functions.invoke("shiprocket",{body:{action:"track-return",returnRequestId}});
    setOrderBusyId("");
    if (error || data?.error) { setNotice(data?.error || error?.message || "Could not refresh return status."); return; }
    setNotice("Return status: "+(data.status || "Updated"));
    await loadCommerceData(user);
  };

  const closeCartPanel = () => {
    setCheckoutStep("cart");
    setCheckoutItemIds([]);
    setAddressFormOpen(false);
    setAddressDraft(emptyAddressDraft);
    if (window.location.pathname.replace(/\/+$/,"")==="/cart") {
      if (window.history.state?.fromCartPage) {
        window.history.back();
      } else {
        window.history.replaceState({},"","/");
        setShowCartPage(false);
        setSelectedProductId(null);
        setSelectedCategoryPage(null);
        setShowAllCategoriesPage(false);
        setShowAllProductsPage(false);
        setCategory("All");
        window.scrollTo({top:0,behavior:"smooth"});
      }
    }
  };
  const buyNow = async (item:Listing) => {
    if (!user) { requireLoginForCommerce(); return; }
    const saved = await persistCartItem(item,false,false);
    if (!saved) return;
    if (!showCartPage) {
      const returnTo = window.location.pathname + window.location.search + window.location.hash;
      window.history.pushState({fromCartPage:true,returnTo},"","/cart");
    }
    setShowCartPage(true);
    setSelectedProductId(null);
    setSelectedCategoryPage(null);
    setShowAllCategoriesPage(false);
    setShowAllProductsPage(false);
    setCheckoutItemIds([item.id]);
    setCheckoutStep("address");
    setSelectedAddressId(current=>addresses.some(address=>address.id===current)
      ? current : addresses.find(address=>address.is_default)?.id || addresses[0]?.id || "");
    setAddressFormOpen(addresses.length===0);
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const changeCartQuantity = async (itemId:string,delta:-1|1) => {
    if (!db || !user) return;
    const item=cartItems.find(current=>current.id===itemId);
    if (!item) return;
    const currentQuantity=getCartQuantity(item);
    const nextQuantity=currentQuantity+delta;
    const stockLimit=getCartStockLimit(item);
    if (nextQuantity<1) {
      setNotice("Use Remove to delete this product from your cart.");
      return;
    }
    if (nextQuantity>stockLimit) {
      setNotice(isPreviewProduct(item) ? "Only 2 left in this demo product." : "You have reached the available stock for this product.");
      return;
    }
    const {error}=await db.from("cart_items").update({quantity:nextQuantity})
      .eq("user_id",user.id).eq("item_key",itemId);
    if(error) {
      const detail=error.message || "";
      setNotice(/quantity|schema cache/i.test(detail)
        ? "Supabase is missing the cart quantity column. Run the latest supabase/cart-quantity.sql in Supabase SQL Editor, then refresh the page. " + detail
        : "Could not update the quantity. " + detail);
      return;
    }
    setCartItems(current=>current.map(currentItem=>currentItem.id===itemId?{...currentItem,quantity:nextQuantity}:currentItem));
  };
  const removeCartItem = async (itemId:string) => {
    if (!db || !user) return;
    const {error} = await db.from("cart_items").delete().eq("user_id",user.id).eq("item_key",itemId);
    if (error) { setNotice("Could not remove this cart item: " + error.message); return; }
    setCartItems(current=>current.filter(item=>item.id!==itemId));
    setCheckoutItemIds(current=>current.filter(id=>id!==itemId));
    setNotice("Item removed from your cart.");
  };
  const beginCartCheckout = () => {
    if (!cartItems.length) { setNotice("Your cart is empty. Add a product before checkout."); return; }
    setCheckoutItemIds(cartItems.map(item=>item.id));
    setShippingQuoteId(""); setShippingQuotes([]); setSelectedShippingCourierId(null);
    setCheckoutStep("address");
    setAddressFormOpen(addresses.length===0);
    setSelectedAddressId(current=>addresses.some(address=>address.id===current)
      ? current : addresses.find(address=>address.is_default)?.id || addresses[0]?.id || "");
    if (cartItems.some(isPreviewProduct)) {
      setNotice("Demo listings can be submitted as order requests. The seller must confirm availability, price and delivery before the purchase is final.");
    }
  };
  const saveCustomerAddress = async (event:FormEvent) => {
    event.preventDefault();
    if (!db || !user) { requireLoginForCommerce(); return; }
    const phoneDigits = addressDraft.phone.replace(/\D/g,"");
    const pinDigits = addressDraft.pincode.replace(/\D/g,"");
    if (phoneDigits.length!==10 || !/^[6-9]/.test(phoneDigits)) {
      setNotice("Enter a valid 10-digit Indian mobile number for the delivery address.");
      return;
    }
    if (pinDigits.length!==6) { setNotice("Enter a valid 6-digit PIN code."); return; }
    const selectedState = indiaStatesDistricts.find(stateOption=>stateOption.name===addressDraft.state);
    const selectedDistrictIsValid = Boolean(selectedState?.districts.some(districtOption=>districtOption.name===addressDraft.district));
    if (!selectedDistrictIsValid) {
      setNotice("Select a valid district for the chosen state or union territory.");
      return;
    }
    if (!addressDraft.full_name.trim() || !addressDraft.address_line1.trim()
      || !addressDraft.address_line2.trim() || !addressDraft.city.trim() || !addressDraft.state.trim() || !addressDraft.district.trim()) {
      setNotice("Complete all required delivery address fields.");
      return;
    }
    setCommerceSaving(true);
    if (addressDraft.is_default) {
      const {error:defaultError} = await db.from("customer_addresses")
        .update({is_default:false}).eq("user_id",user.id).eq("is_default",true);
      if (defaultError) {
        setCommerceSaving(false);
        setNotice("Could not update the default address. " + defaultError.message);
        return;
      }
    }
    const {data,error} = await db.from("customer_addresses").insert({
      user_id:user.id,
      full_name:addressDraft.full_name.trim(),
      phone:phoneDigits,
      pincode:pinDigits,
      address_line1:addressDraft.address_line1.trim(),
      address_line2:addressDraft.address_line2.trim(),
      landmark:addressDraft.landmark.trim() || null,
      city:addressDraft.city.trim(),
      state:addressDraft.state.trim(),
      district:addressDraft.district.trim(),
      address_type:addressDraft.address_type,
      is_default:addressDraft.is_default || addresses.length===0
    }).select("*").single();
    setCommerceSaving(false);
    if (error) {
      setNotice("Could not save the delivery address. Make sure supabase/commerce.sql has been run. " + error.message);
      return;
    }
    const savedAddress = data as CustomerAddress;
    setAddresses(current=>[savedAddress,...current.map(address=>savedAddress.is_default?{...address,is_default:false}:address)]);
    setSelectedAddressId(savedAddress.id);
    setShippingQuoteId(""); setShippingQuotes([]); setSelectedShippingCourierId(null);
    setAddressFormOpen(false);
    setAddressDraft(emptyAddressDraft);
    setNotice("Delivery address saved.");
  };
  const deleteCustomerAddress = async (addressId:string) => {
    if (!db || !user) return;
    const {error} = await db.from("customer_addresses").delete().eq("id",addressId).eq("user_id",user.id);
    if (error) { setNotice("Could not delete this address: " + error.message); return; }
    const remaining = addresses.filter(address=>address.id!==addressId);
    setAddresses(remaining);
    if (selectedAddressId===addressId) {
      setSelectedAddressId(remaining.find(address=>address.is_default)?.id || remaining[0]?.id || "");
      setShippingQuoteId(""); setShippingQuotes([]); setSelectedShippingCourierId(null);
    }
    setNotice("Delivery address deleted.");
  };
  const requestShippingQuotes = async () => {
    if (!db || !user) { requireLoginForCommerce(); return; }
    const address = addresses.find(item=>item.id===selectedAddressId);
    if (!address) { setNotice("Select or save a delivery address before checking courier options."); return; }
    if (!checkoutItems.length) { setNotice("Your checkout has no products."); return; }
    setShippingQuoteBusy(true);
    setShippingQuoteId(""); setShippingQuotes([]); setSelectedShippingCourierId(null);
    const {data,error} = await db.functions.invoke("shiprocket",{
      body:{action:"quote",addressId:address.id,itemIds:checkoutItems.map(item=>item.id)}
    });
    setShippingQuoteBusy(false);
    if (error || !data?.quoteId) {
      setNotice(data?.error || error?.message || "Could not calculate delivery options. Check that packed parcel details are saved for every product.");
      return;
    }
    const options = Array.isArray(data.couriers) ? data.couriers : [];
    setShippingQuoteId(data.quoteId);
    setShippingQuotes(options);
    if (options.length) setSelectedShippingCourierId(options[0].courier_id);
    else setNotice("No Shiprocket courier service is currently available for this delivery PIN code.");
  };

  const placeOrderRequest = async () => {
    if (!db || !user) { requireLoginForCommerce(); return; }
    const address = addresses.find(item=>item.id===selectedAddressId);
    const orderItems = cartItems.filter(item=>checkoutItemIds.includes(item.id));
    if (!address) { setNotice("Select a delivery address or add a new address."); return; }
    if (!orderItems.length) { setNotice("Your checkout has no items. Return to your cart and add a product."); return; }
    if (!shippingQuoteId || selectedShippingCourierId===null) { setNotice("Check delivery options and select a courier before submitting your order request."); return; }
    setCommerceSaving(true);
    const {data,error} = await db.rpc("create_marketplace_order",{
      p_address_id:address.id,
      p_items:orderItems.map(item=>({
        id:item.id,title:item.title,price:Number(item.price),quantity:getCartQuantity(item),category:item.category,
        condition:item.condition,seller_name:item.seller_name,image_urls:item.image_urls || []
      })),
      p_shipping_quote_id:shippingQuoteId,
      p_courier_id:selectedShippingCourierId
    });
    setCommerceSaving(false);
    if (error) {
      setNotice("Could not submit your order request. " + error.message);
      return;
    }
    const orderedIds = orderItems.map(item=>item.id);
    const {error:removeError} = await db.from("cart_items").delete().eq("user_id",user.id).in("item_key",orderedIds);
    if (removeError) setNotice("Your order request was submitted, but the cart could not be cleared. You can remove the items manually.");
    setCartItems(current=>current.filter(item=>!orderedIds.includes(item.id)));
    setCompletedOrderId(String(data || ""));
    setCheckoutStep("success");
    setCheckoutItemIds([]);
  };
  const checkoutItems = cartItems.filter(item=>checkoutItemIds.includes(item.id));
  const checkoutSubtotal = checkoutItems.reduce((total,item)=>total+Number(item.price || 0)*getCartQuantity(item),0);
  const cartQuantityCount = cartItems.reduce((total,item)=>total+getCartQuantity(item),0);
  const cartSubtotal = cartItems.reduce((total,item)=>total+Number(item.price || 0)*getCartQuantity(item),0);
  const chosenAddress = addresses.find(address=>address.id===selectedAddressId) || null;
  const selectedShippingQuote = shippingQuotes.find(option=>option.courier_id===selectedShippingCourierId) || null;
  const orderGrandTotal = checkoutSubtotal + (selectedShippingQuote?.rate || 0);

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
            {item.is_test_product && <span className="test-product-badge">₹1 TEST PRODUCT · CANCEL AFTER TEST</span>}
            <h3>{item.title}</h3>
            <strong>{money(item.price)}</strong>
            <p>⌖ {item.city}, {item.state}</p>
            <div className="product-buy-actions">
              <button
                type="button"
                className="btn product-cart-button"
                onClick={event=>{event.stopPropagation();void addToCart(item);}}
              ><span className="purchase-button-label">Add to Cart</span></button>
              <button
                type="button"
                className="btn primary buy-button"
                onClick={event=>{event.stopPropagation();void buyNow(item);}}
              ><span className="purchase-button-label">Buy Now</span></button>
            </div>
            {item.contact_phone && <button type="button" className="contact-seller-link" onClick={event=>{event.stopPropagation();buyItem(item);}}>Contact seller on WhatsApp →</button>}
            {getStockMessage(item) && <span className="stock-badge">{getStockMessage(item)}</span>}
            {isPreviewProduct(item) && <span className="demo-tag">Demo listing · order request requires seller confirmation</span>}
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


  const displayName = user?.user_metadata?.full_name?.trim() || user?.email?.split("@")[0] || user?.phone || "User";

  return <div className="site">
    <header className="header"><a className="logo" href="/" aria-label="VPN Products and Services home"><img src="/vpn-logo.webp" alt="VPN monogram logo" /><b>VPN Products and Services</b></a><div className="header-search"><span className="header-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m16 16 4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products, parts, gadgets and more"/></div><div className="header-actions"><button className="btn buy-top" onClick={openBuy}>🛒 Buy</button><button className="btn primary" onClick={openSell}>＋ Sell item</button>{user && <button type="button" className="cart-icon-button" onClick={openCartPage} aria-label={"Shopping cart with "+cartQuantityCount+" items"} title="Shopping cart"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 3.5h2.2l2.1 11.1c.15.8.83 1.4 1.65 1.4h9.2c.75 0 1.4-.48 1.62-1.2L21.5 7H6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 9.2h11.8l-1.15 4.5H8.85L8 9.2Z" fill="currentColor" opacity=".18"/><circle cx="9.7" cy="19.2" r="1.65" fill="currentColor"/><circle cx="18" cy="19.2" r="1.65" fill="currentColor"/></svg>{cartQuantityCount>0 && <span className="cart-count">{cartQuantityCount}</span>}</button>}{user ? <div className="profile-menu-wrap" ref={profileMenuRef}>
        <button type="button" className="profile-icon-button" aria-label={"Open profile menu for "+displayName} aria-haspopup="menu" aria-expanded={profileMenuOpen} onClick={()=>setProfileMenuOpen(value=>!value)}>
          {user.user_metadata?.avatar_url ? <img className="profile-avatar profile-avatar-image" src={user.user_metadata.avatar_url} alt="" /> : <span className="profile-avatar">{displayName.charAt(0).toUpperCase()}</span>}
        </button>
        {profileMenuOpen && <div className="profile-dropdown" role="menu">
          <div className="profile-dropdown-heading">
            {user.user_metadata?.avatar_url ? <img className="profile-avatar profile-avatar-large profile-avatar-image" src={user.user_metadata.avatar_url} alt="" /> : <span className="profile-avatar profile-avatar-large">{displayName.charAt(0).toUpperCase()}</span>}
            <span className="profile-dropdown-identity"><b>{displayName}</b><small>{user.email || user.phone || "Signed-in account"}</small></span>
          </div>
          <div className="profile-menu-divider"/>
          <button type="button" className="profile-menu-item" role="menuitem" onClick={openMyOrders}>
            <span aria-hidden="true">▣</span> My Orders
          </button>
          <button type="button" className="profile-menu-item" role="menuitem" onClick={()=>openProfilePanel("view")}>
            <span aria-hidden="true">♙</span> My Profile
          </button>
          <button type="button" className="profile-menu-item" role="menuitem" onClick={()=>openProfilePanel("edit")}>
            <span aria-hidden="true">✎</span> Edit Profile
          </button>
          <button type="button" className="profile-menu-item" role="menuitem" onClick={()=>openProfilePanel("details")}>
            <span aria-hidden="true">▤</span> Account Details
          </button>
          <button type="button" className="profile-menu-item" role="menuitem" onClick={()=>openProfilePanel("password")}>
            <span aria-hidden="true">⌑</span> Change Password
          </button>
          <div className="profile-menu-divider"/>
          <button type="button" className="profile-menu-item profile-logout-item" role="menuitem" onClick={signOut}>
            <span aria-hidden="true">↪</span> Logout
          </button>
        </div>}
      </div> : <button className="btn account-top" onClick={()=>{setMode("login");setAuthOpen(true);}}><span className="account-top-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.3" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M5.2 20c.55-3.4 3.1-5.2 6.8-5.2s6.25 1.8 6.8 5.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></span><span className="account-top-copy"><b>Login</b><small>Register</small></span></button>}</div></header>
    <main id="top">
      {showOrdersPage ? <section className="my-orders-page section">
        <button type="button" className="cart-page-back" onClick={()=>setShowOrdersPage(false)}>← Continue shopping</button>
        <div className="cart-page-heading">
          <span className="eyebrow">ACCOUNT</span>
          <h1>My Orders</h1>
          <p>View order confirmations, cancel eligible orders, request returns and refresh delivery status.</p>
        </div>
        {ordersLoading ? <div className="cart-page-empty"><p>Loading your orders…</p></div> : orders.length===0 ? <div className="cart-page-empty">
          <span className="cart-page-empty-icon" aria-hidden="true">▣</span>
          <h2>No orders yet</h2>
          <p>Your order requests will appear here after checkout.</p>
          <button type="button" className="btn primary" onClick={()=>setShowOrdersPage(false)}>Browse products</button>
        </div> : <div className="my-orders-list">
          {orders.map(order=>{
            const delivered = order.status==="delivered" || /delivered/i.test(String(order.shipping_status||""));
            const dispatched = /shipped|in transit|out for delivery|picked up|delivered/i.test(String(order.shipping_status||""));
            const cancellable = order.status!=="cancelled" && !delivered && !dispatched;
            const returnRequest = order.returnRequest;
            const busy = orderBusyId===order.id;
            const statusText = order.status==="cancelled" ? "Cancelled"
              : delivered ? "Delivered"
              : dispatched ? order.shipping_status
              : order.status==="confirmed" ? "Order confirmed"
              : order.status==="processing" ? "Processing"
              : order.is_test_order ? "Test order placed"
              : "Awaiting confirmation";
            return <article className="my-order-card" key={order.id}>
              <div className="my-order-card-head">
                <div><span className="eyebrow">ORDER REQUEST</span><strong>#{order.id.slice(0,8).toUpperCase()}</strong><small>{new Date(order.created_at).toLocaleString("en-IN")}</small></div>
                <span className={"order-status-pill "+(order.status==="cancelled"?"is-cancelled":delivered?"is-delivered":order.is_test_order?"is-test":"")}>{statusText}</span>
              </div>
              {order.is_test_order && <div className="test-order-warning"><b>Test order only</b><span>This ₹1 listing never creates a real courier shipment. Cancel it here after testing checkout.</span></div>}
              <div className="my-order-items">
                {order.items.map(item=><div className="my-order-item" key={item.id}>
                  {item.image_url && <img src={item.image_url} alt="" />}
                  <span>{item.product_title} × {item.quantity}</span>
                  <b>{money(Number(item.unit_price)*Number(item.quantity))}</b>
                </div>)}
              </div>
              <div className="my-order-meta">
                <span>Products: {money(Number(order.subtotal||0))}</span>
                <span>Delivery: {money(Number(order.delivery_fee||0))}</span>
                <span>Payment: {order.is_test_order?"Test only":order.payment_status==="paid"?"Prepaid received":"Prepaid pending"}</span>
                <strong>Total: {money(Number(order.subtotal||0)+Number(order.delivery_fee||0))}</strong>
              </div>
              <div className="my-order-address">
                <b>Delivery address</b>
                <span>{order.delivery_address?.full_name} · {order.delivery_address?.phone}</span>
                <span>{order.delivery_address?.address_line1}, {order.delivery_address?.address_line2}, {order.delivery_address?.city}{order.delivery_address?.district?", "+order.delivery_address.district:""}, {order.delivery_address?.state} - {order.delivery_address?.pincode}</span>
              </div>
              {order.shipping_courier_name && <div className="my-order-shipping">
                <b>Courier: {order.shipping_courier_name}</b>
                {order.shipping_eta && <span>Estimated delivery: {order.shipping_eta}</span>}
                {order.shipping_awb && <span>AWB: {order.shipping_awb}</span>}
                {order.shipping_tracking_url && <a href={order.shipping_tracking_url} target="_blank" rel="noopener noreferrer">Open courier tracking ↗</a>}
                {order.tracking_updated_at && <small>Last updated: {new Date(order.tracking_updated_at).toLocaleString("en-IN")}</small>}
              </div>}
              <div className="my-order-actions">
                {order.shipping_awb && <button className="btn light" type="button" disabled={busy} onClick={()=>void refreshOrderTracking(order.id)}>{busy?"Refreshing…":"Refresh delivery status"}</button>}
                {cancellable && <button className="btn light danger-outline" type="button" disabled={busy} onClick={()=>void cancelCustomerOrder(order.id)}>{busy?"Cancelling…":"Cancel order"}</button>}
                {delivered && !order.is_test_order && !returnRequest && <button className="btn light" type="button" onClick={()=>{setReturnOrderId(returnOrderId===order.id?"":order.id);setReturnDetails("");}}>Request return</button>}
                {isAdmin && order.status==="pending_confirmation" && <button className="btn light" type="button" disabled={busy} onClick={()=>void adminUpdateOrder(order.id,"confirmed")}>Confirm order</button>}
                {isAdmin && ["confirmed","processing"].includes(order.status) && order.payment_status!=="paid" && !order.is_test_order && <button className="btn light" type="button" disabled={busy} onClick={()=>void adminUpdateOrder(order.id,undefined,"paid")}>Mark prepaid received</button>}
                {isAdmin && order.status==="confirmed" && order.payment_status==="paid" && !order.is_test_order && !order.shiprocket_order_id && <button className="btn primary" type="button" disabled={busy} onClick={()=>void adminBookShipment(order.id)}>Book Shiprocket shipment</button>}
              </div>
              {returnOrderId===order.id && <form className="order-return-form" onSubmit={event=>{event.preventDefault();void submitReturnRequest(order.id);}}>
                <b>Request a return</b>
                <label>Reason<select value={returnReason} onChange={event=>setReturnReason(event.target.value)}>
                  <option>Damaged product</option><option>Wrong item received</option><option>Item not as described</option><option>Missing parts or accessories</option><option>Other</option>
                </select></label>
                <label>Additional details (optional)<textarea maxLength={1200} value={returnDetails} onChange={event=>setReturnDetails(event.target.value)} placeholder="Describe the issue"/></label>
                <div className="my-order-actions"><button className="btn primary" type="submit" disabled={returnBusy}>{returnBusy?"Submitting…":"Submit return request"}</button><button className="btn light" type="button" onClick={()=>setReturnOrderId("")}>Close</button></div>
              </form>}
              {returnRequest && <div className="my-order-return">
                <b>Return request: {returnRequest.status.replaceAll("_"," ")}</b>
                <span>Reason: {returnRequest.reason}</span>
                {returnRequest.admin_note && <small>{returnRequest.admin_note}</small>}
                {returnRequest.return_awb && <span>Reverse pickup AWB: {returnRequest.return_awb}</span>}
                {returnRequest.return_tracking_url && <a href={returnRequest.return_tracking_url} target="_blank" rel="noopener noreferrer">Track return ↗</a>}
                {returnRequest.return_awb && <button className="btn light" type="button" disabled={busy} onClick={()=>void refreshReturnTracking(returnRequest.id)}>{busy?"Refreshing…":"Refresh return status"}</button>}
                {isAdmin && returnRequest.status==="requested" && <div className="my-order-actions">
                  <button className="btn primary" type="button" disabled={orderBusyId===returnRequest.id} onClick={()=>void adminProcessReturn(returnRequest.id,"approve-return")}>Approve & book return pickup</button>
                  <button className="btn light danger-outline" type="button" disabled={orderBusyId===returnRequest.id} onClick={()=>void adminProcessReturn(returnRequest.id,"reject-return")}>Reject return</button>
                </div>}
              </div>}
            </article>;
          })}
        </div>}
      </section> : showCartPage ? <section className="cart-page section">
        <button type="button" className="cart-page-back" onClick={closeCartPanel}>← Continue shopping</button>
        {checkoutStep==="cart" && <>
          <div className="cart-page-heading">
            <span className="eyebrow">YOUR SHOPPING BAG</span>
            <h1 className="shopping-cart-title">Shopping Cart</h1>
            <p>{cartItems.length} {cartItems.length===1?"product":"products"} · {cartQuantityCount} {cartQuantityCount===1?"item":"items"} in your cart</p>
          </div>
          {!user ? <div className="cart-page-empty">
            <span className="cart-page-empty-icon" aria-hidden="true">♙</span>
            <h2>Sign in to view your cart</h2>
            <p>Your saved products will appear here after you sign in.</p>
            <button type="button" className="btn primary" onClick={requireLoginForCommerce}>Sign in</button>
          </div> : cartItems.length===0 ? <div className="cart-page-empty">
            <span className="cart-page-empty-icon" aria-hidden="true">🛒</span>
            <h2>Your cart is empty</h2>
            <p>You haven't added any products yet. Explore the marketplace and add products you would like to buy.</p>
            <button type="button" className="btn primary" onClick={closeCartPanel}>Browse products</button>
          </div> : <div className="cart-page-layout">
            <div className="cart-page-items">
              {cartItems.map(item=><article className="commerce-cart-item cart-page-item" key={item.id}>
                <img src={item.image_urls?.[0] || "/vpn-logo.webp"} alt={item.title}/>
                <div className="commerce-cart-item-info">
                  <b>{item.title}</b>
                  <small>{item.category} · {item.condition}</small>
                  <small>{item.city}, {item.state}</small>
                  <small>Unit price: {money(Number(item.price))}</small>
                  <div className="cart-quantity-control" aria-label={"Quantity for "+item.title}>
                    <button type="button" aria-label="Decrease quantity" disabled={getCartQuantity(item)<=1} onClick={()=>void changeCartQuantity(item.id,-1)}>−</button>
                    <span>{getCartQuantity(item)}</span>
                    <button type="button" aria-label="Increase quantity" disabled={getCartQuantity(item)>=getCartStockLimit(item)} onClick={()=>void changeCartQuantity(item.id,1)}>＋</button>
                  </div>
                  <strong>Item total: {money(Number(item.price)*getCartQuantity(item))}</strong>
                  {getStockMessage(item) && <span className="stock-badge cart-stock-badge">{getStockMessage(item)}</span>}
                  <span className="cart-page-seller">Seller: {item.seller_name || "Marketplace seller"}</span>
                  {isPreviewProduct(item) && <span className="cart-preview-label">Demo listing · seller must confirm availability and price</span>}
                </div>
                <button type="button" className="commerce-remove-button" onClick={()=>void removeCartItem(item.id)}>Remove</button>
              </article>)}
              <button type="button" className="cart-page-continue" onClick={closeCartPanel}>← Continue shopping</button>
            </div>
            <aside className="cart-page-summary">
              <h2>Order Summary</h2>
              <div className="cart-summary-row"><span>Items ({cartQuantityCount})</span><b>{money(cartSubtotal)}</b></div>
              <div className="cart-summary-row"><span>Delivery</span><b>To be confirmed</b></div>
              <div className="cart-summary-total"><span>Subtotal</span><strong>{money(cartSubtotal)}</strong></div>
              <p className="commerce-note">Demo listings can be submitted as order requests. The seller must confirm actual availability, price and delivery charges before the purchase is final.</p>
              <button className="btn primary full cart-page-checkout" type="button" disabled={cartItems.every(isPreviewProduct)} onClick={beginCartCheckout}>Proceed to checkout →</button>
              {cartItems.every(isPreviewProduct) && <small className="cart-preview-checkout-note">Add a live seller listing to continue to checkout.</small>}
              <div className="cart-page-secure-note"><span aria-hidden="true">✓</span> Your cart is saved to your account</div>
            </aside>
          </div>}
        </>}
        {checkoutStep==="address" && <>
          <div className="cart-page-heading">
            <span className="eyebrow">CHECKOUT · STEP 1 OF 2</span>
            <h1 className="checkout-address-title">Select delivery address</h1>
            <p>Choose where you want your order delivered, or add a new address.</p>
          </div>
          <div className="cart-checkout-layout">
            <div className="cart-checkout-main">
              {addresses.length>0 && <div className="commerce-address-list">
                {addresses.map(address=><article className={"commerce-address-option"+(selectedAddressId===address.id?" selected":"")} key={address.id}>
                  <label>
                    <input type="radio" name="checkout-address" value={address.id} checked={selectedAddressId===address.id} onChange={()=>{setSelectedAddressId(address.id);setShippingQuoteId("");setShippingQuotes([]);setSelectedShippingCourierId(null);}}/>
                    <span className="commerce-address-copy">
                      <span className="commerce-address-title"><b>{address.full_name}</b><small>{address.address_type}</small>{address.is_default && <em>Default</em>}</span>
                      <span>{address.address_line1}, {address.address_line2}</span>
                      {address.landmark && <span>Landmark: {address.landmark}</span>}
                      <span>{address.city}{address.district?", "+address.district:""}, {address.state} - {address.pincode}</span>
                      <span>Mobile: +91 {address.phone}</span>
                    </span>
                  </label>
                  <button type="button" className="commerce-remove-button" onClick={()=>void deleteCustomerAddress(address.id)}>Delete</button>
                </article>)}
              </div>}
              {!addressFormOpen && <button type="button" className="commerce-add-address" onClick={()=>{setAddressDraft(emptyAddressDraft);setAddressFormOpen(true);}}>＋ Add a new delivery address</button>}
              {addressFormOpen && <form className="commerce-address-form" onSubmit={saveCustomerAddress}>
                <div className="commerce-form-heading"><b>Add delivery address</b><button type="button" className="commerce-cancel-form" onClick={()=>{setAddressFormOpen(false);setAddressDraft(emptyAddressDraft);}}>Cancel</button></div>
                <div className="commerce-form-grid">
                  <label>Full name<input required maxLength={80} autoComplete="name" value={addressDraft.full_name} onChange={event=>setAddressDraft(current=>({...current,full_name:event.target.value}))} placeholder="Name of recipient"/></label>
                  <label>Mobile number<input required type="tel" inputMode="numeric" maxLength={10} autoComplete="tel-national" value={addressDraft.phone} onChange={event=>setAddressDraft(current=>({...current,phone:event.target.value.replace(/\D/g,"").slice(0,10)}))} placeholder="10-digit mobile number"/></label>
                  <label>PIN code<input required inputMode="numeric" maxLength={6} autoComplete="postal-code" value={addressDraft.pincode} onChange={event=>setAddressDraft(current=>({...current,pincode:event.target.value.replace(/\D/g,"").slice(0,6)}))} placeholder="6-digit PIN code"/></label>
                  <label>Flat, house no. or building<input required maxLength={160} autoComplete="address-line1" value={addressDraft.address_line1} onChange={event=>setAddressDraft(current=>({...current,address_line1:event.target.value}))} placeholder="House / flat / building"/></label>
                  <label>Area, street or village<input required maxLength={160} autoComplete="address-line2" value={addressDraft.address_line2} onChange={event=>setAddressDraft(current=>({...current,address_line2:event.target.value}))} placeholder="Street, area or village"/></label>
                  <label>Landmark (optional)<input maxLength={120} value={addressDraft.landmark} onChange={event=>setAddressDraft(current=>({...current,landmark:event.target.value}))} placeholder="Nearby landmark"/></label>
                  <label>Town / city<input required maxLength={80} autoComplete="address-level2" value={addressDraft.city} onChange={event=>setAddressDraft(current=>({...current,city:event.target.value}))} placeholder="City or town"/></label>
                  <label>State / Union Territory<select required autoComplete="address-level1" value={addressDraft.state} onChange={event=>setAddressDraft(current=>({...current,state:event.target.value,district:""}))}>
                    <option value="">Select state / UT</option>
                    {indiaStatesDistricts.map(stateOption=><option key={stateOption.code} value={stateOption.name}>{stateOption.name}</option>)}
                  </select></label>
                  <label>District<select required autoComplete="address-level2" value={addressDraft.district} disabled={!addressDraft.state} onChange={event=>setAddressDraft(current=>({...current,district:event.target.value}))}>
                    <option value="">{addressDraft.state?"Select district":"Select state first"}</option>
                    {(indiaStatesDistricts.find(stateOption=>stateOption.name===addressDraft.state)?.districts ?? []).map(districtOption=><option key={districtOption.code} value={districtOption.name}>{districtOption.name}</option>)}
                  </select></label>
                  <label>Address type<select value={addressDraft.address_type} onChange={event=>setAddressDraft(current=>({...current,address_type:event.target.value as AddressDraft["address_type"]}))}><option value="Home">Home</option><option value="Work">Work</option><option value="Other">Other</option></select></label>
                </div>
                <label className="commerce-default-toggle"><input type="checkbox" checked={addressDraft.is_default} onChange={event=>setAddressDraft(current=>({...current,is_default:event.target.checked}))}/> Save as my default address</label>
                <button className="btn primary full" type="submit" disabled={commerceSaving}>{commerceSaving?"Saving address…":"Save address"}</button>
              </form>}
              {chosenAddress && !addressFormOpen && <section className="shiprocket-quotes">
                <div className="shiprocket-quotes-heading"><b>Delivery options</b><span>Shiprocket courier services</span></div>
                <p>All parcels are dispatched from your shop pickup location. Rates are estimates based on the packed measurements saved by the seller and may change after final packing.</p>
                <button type="button" className="btn light shiprocket-quote-button" disabled={shippingQuoteBusy || commerceSaving} onClick={()=>void requestShippingQuotes()}>{shippingQuoteBusy?"Checking courier rates…":"Check delivery options"}</button>
                {shippingQuotes.length>0 && <div className="shiprocket-courier-list">
                  {shippingQuotes.map(option=><label className={"shiprocket-courier-option"+(selectedShippingCourierId===option.courier_id?" selected":"")} key={option.courier_id}>
                    <input type="radio" name="shipping-courier" checked={selectedShippingCourierId===option.courier_id} onChange={()=>setSelectedShippingCourierId(option.courier_id)}/>
                    <span className="shiprocket-courier-copy"><b>{option.courier_name}</b><small>{option.etd || (option.estimated_delivery_days ? option.estimated_delivery_days+" days" : "Courier delivery estimate")}</small></span>
                    <strong>{money(option.rate)}</strong>
                  </label>)}
                </div>}
              </section>}
            </div>
            <aside className="cart-page-summary">
              <h2>Checkout Summary</h2>
              <div className="cart-summary-row"><span>Selected products</span><b>{checkoutItems.length}</b></div>
              <div className="cart-summary-row"><span>Delivery fee</span><b>{selectedShippingQuote?money(selectedShippingQuote.rate):"Check options"}</b></div>
              <div className="cart-summary-total"><span>Estimated total</span><strong>{money(orderGrandTotal)}</strong></div>
              <p className="commerce-note">Shipping and final availability are confirmed before the order is accepted.</p>
              <button className="btn primary full cart-page-checkout" type="button" disabled={!chosenAddress || checkoutItems.length===0 || !selectedShippingQuote || commerceSaving || shippingQuoteBusy} onClick={()=>setCheckoutStep("review")}>Continue to review →</button>
            </aside>
          </div>
        </>}
        {checkoutStep==="review" && <>
          <div className="cart-page-heading">
            <span className="eyebrow">CHECKOUT · STEP 2 OF 2</span>
            <h1>Review your order</h1>
            <p>Confirm your products and delivery address before submitting.</p>
          </div>
          <div className="cart-checkout-layout">
            <div className="cart-checkout-main">
              {chosenAddress && <div className="commerce-review-address">
                <b>Deliver to</b>
                <strong>{chosenAddress.full_name} · +91 {chosenAddress.phone}</strong>
                <span>{chosenAddress.address_line1}, {chosenAddress.address_line2}{chosenAddress.landmark?", "+chosenAddress.landmark:""}, {chosenAddress.city}{chosenAddress.district?", "+chosenAddress.district:""}, {chosenAddress.state} - {chosenAddress.pincode}</span>
                <button type="button" className="commerce-back" onClick={()=>setCheckoutStep("address")}>Change delivery address</button>
              </div>}
              <div className="commerce-review-items">
                {checkoutItems.map(item=><div className="commerce-review-item" key={item.id}>
                  <span>{item.title} × {getCartQuantity(item)}</span><strong>{money(Number(item.price)*getCartQuantity(item))}</strong>
                </div>)}
              </div>
            </div>
            <aside className="cart-page-summary">
              <h2>Order Summary</h2>
              <div className="cart-summary-row"><span>Products ({checkoutItems.length})</span><b>{money(checkoutSubtotal)}</b></div>
              <div className="cart-summary-row"><span>Delivery · {selectedShippingQuote?.courier_name || "Courier not selected"}</span><b>{selectedShippingQuote?money(selectedShippingQuote.rate):"Not selected"}</b></div>
              <div className="cart-summary-row"><span>Payment method</span><b>Prepaid only</b></div>
              <div className="cart-summary-total"><span>Estimated total</span><strong>{money(orderGrandTotal)}</strong></div>
              <p className="commerce-note commerce-important-note">Prepaid orders only. Cash on Delivery (COD) is not available. This submits an order request; our team will confirm availability and share advance-payment instructions. Payment must be received and verified before a Shiprocket shipment is booked. This website does not collect online payments yet.</p>
              <button className="btn primary full cart-page-checkout" type="button" disabled={commerceSaving || !chosenAddress || checkoutItems.length===0} onClick={()=>void placeOrderRequest()}>{commerceSaving?"Submitting order request…":"Place order request"}</button>
            </aside>
          </div>
        </>}
        {checkoutStep==="success" && <div className="commerce-success cart-page-success">
          <span className="commerce-success-mark" aria-hidden="true">✓</span>
          <span className="eyebrow commerce-eyebrow">REQUEST SUBMITTED</span>
          <h1>Thank you for your order request!</h1>
          <p>Your prepaid order request is awaiting confirmation. Our team will confirm product availability and share advance-payment instructions. The order will be dispatched only after payment is received and verified. Cash on Delivery (COD) is not available.</p>
          {completedOrderId && <div className="commerce-order-reference">Order request ID <b>{completedOrderId}</b></div>}
           {selectedShippingQuote && <div className="commerce-review-address"><b>Selected delivery service</b><strong>{selectedShippingQuote.courier_name}</strong><span>Estimated delivery fee: {money(selectedShippingQuote.rate)}</span><span>Estimated order total: {money(orderGrandTotal)}</span><small>Courier booking will happen after the shop confirms your order and payment.</small></div>}
          <p className="commerce-note">No online payment has been collected on this website yet. Contact our team on WhatsApp for advance-payment instructions. Dispatch happens only after payment confirmation; COD is not accepted.</p>
          <a className="btn primary commerce-whatsapp-followup" href={"https://wa.me/919916140898?text="+encodeURIComponent("Hello VPN Products and Services, please confirm my order request "+completedOrderId+".")} target="_blank" rel="noopener noreferrer">Contact us on WhatsApp</a>
          <button className="btn light" type="button" onClick={closeCartPanel}>Continue shopping</button>
        </div>}
      </section> : selectedProduct ? <section className="product-detail-page">
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
            {selectedProduct.is_test_product && <div className="test-order-warning"><b>₹1 test listing</b><span>For checkout and cancellation testing only. No physical courier shipment will be created.</span></div>}
            <div className="detail-price">{money(selectedProduct.price)}</div>
            <span className="detail-condition">{selectedProduct.condition}</span>
            <p className="detail-location">⌖ {selectedProduct.city}, {selectedProduct.state}</p>
            {getStockMessage(selectedProduct) && <span className="stock-badge detail-stock-badge">{getStockMessage(selectedProduct)}</span>}
            <div className="detail-buy-actions">
              <button className="btn light detail-cart-button" type="button" disabled={getCartStockLimit(selectedProduct)===0} onClick={()=>void addToCart(selectedProduct)}><span className="purchase-button-label">Add to Cart</span></button>
              <button className="btn primary detail-buy-button" type="button" disabled={getCartStockLimit(selectedProduct)===0} onClick={()=>void buyNow(selectedProduct)}><span className="purchase-button-label">Buy Now</span></button>
            </div>
            {selectedProduct.contact_phone && <button type="button" className="contact-seller-link" onClick={()=>buyItem(selectedProduct)}>Contact seller on WhatsApp →</button>}
            {isPreviewProduct(selectedProduct) && <span className="demo-tag">Demo listing · order request requires seller confirmation</span>}
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

      <section id="home-hero" className="hero"><div className="hero-copy"><span className="eyebrow">COMPUTER SHOP & MULTI-SERVICE CENTER</span><h1>Buy, Sell, Repair &<br/><em>Get IT Services</em></h1><p>Computer and mobile services, Xerox and printing, online application assistance, website development, and new and second-hand products — all in one place.</p><div className="hero-actions"><button className="btn primary" onClick={()=>document.getElementById("listings")?.scrollIntoView({behavior:"smooth"})}>🛒 Browse Products</button><button className="btn light" onClick={()=>document.getElementById("services")?.scrollIntoView({behavior:"smooth"})}>⚒ Our Services</button></div></div><div className="hero-art"><img className="hero-illustration hero-print-illustration" src="/hero-print-services.svg" alt="Xerox printer, photocopying, document scanning and online application assistance"/><img className="hero-illustration hero-devices-illustration" src="/hero-devices.svg" alt="Computer, laptop, mobile phone, camera, headphones and electronics"/></div></section>
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
      <section className="services section" id="services"><div className="section-title"><div><span className="eyebrow">MORE THAN A MARKETPLACE</span><h2>Products, Services & Digital Solutions</h2><p>Get computer and mobile support, photocopying, printing, document scanning and help with eligible online applications.</p></div></div><div className="service-grid"><article className="service-card"><span className="service-icon" aria-hidden="true">💻</span><h3>Computer Shop & Services</h3><p>Computers, laptops and accessories, plus setup, troubleshooting, upgrades and service support.</p><button className="service-link" onClick={()=>setNotice("Contact us for computer and laptop availability or service enquiries.")}>Enquire about computer services →</button></article><article className="service-card"><span className="service-icon" aria-hidden="true">📱</span><h3>Mobile Services</h3><p>Mobile device services, setup and support for everyday phone and tablet needs.</p><button className="service-link" onClick={()=>setNotice("Contact us for mobile service enquiries.")}>Enquire about mobile services →</button></article><article className="service-card"><span className="service-icon" aria-hidden="true">🖨️</span><h3>Xerox, Printing & Scanning</h3><p>Photocopying, black-and-white and colour printing, document scanning and digital copies.</p><button className="service-link" onClick={()=>setNotice("Contact us for Xerox, photocopy, printing and document scanning enquiries.")}>Enquire about printing services →</button></article><article className="service-card"><span className="service-icon" aria-hidden="true">📝</span><h3>Online Application Assistance</h3><p>Help with PAN card applications, eligible Aadhaar-related services, income and caste certificate applications, and other online forms.</p><button className="service-link" onClick={()=>setNotice("Contact us for PAN, eligible Aadhaar, income or caste certificate application assistance. Service availability depends on the relevant portal and eligibility.")}>Enquire about application help →</button></article><article className="service-card"><span className="service-icon" aria-hidden="true">🌐</span><h3>Website Development</h3><p>Websites for businesses, shops, professionals and service providers — from business pages to online stores.</p><button className="service-link" onClick={()=>setNotice("Contact us to discuss your website project.")}>Discuss a website project →</button></article><article className="service-card"><span className="service-icon" aria-hidden="true">🔄</span><h3>Buy & Sell Products</h3><p>Discover or list new and second-hand phones, computers, vehicle parts, electronics, furniture, appliances, books, tools and much more.</p><button className="service-link" onClick={()=>document.getElementById("listings")?.scrollIntoView({behavior:"smooth"})}>Explore marketplace →</button></article></div></section>
      <section className="section recent-products-section" id="listings"><div className="section-title"><div><span className="eyebrow">LATEST MARKETPLACE LISTINGS</span><h2>Recently Added Products</h2><p>Showing {Math.min(visible.length,5)} of {visible.length} products {place ? "near "+place : "across India"}, newest first</p></div></div>{recentProductCards}</section>
      <section className="sell-cta"><div><span className="eyebrow">SELL ALMOST ANYTHING</span><h2>Have something useful to sell?</h2><p>List phones, computers, parts, electronics, furniture, appliances, vehicles and many other items.</p></div><button className="btn primary" onClick={openSell}>Start selling</button></section>
      <section className="safety"><b>Buy and sell safely</b><p>Inspect items before paying, meet in a public place, and never share OTPs, UPI PINs or banking passwords.</p></section>
      <section className="contact-section section" id="contact">
        <div className="section-title"><div><span className="eyebrow">WE'RE HERE TO HELP</span><h2>Contact VPN Products and Services</h2><p>Get in touch for computer and mobile services, Xerox and printing, online application assistance, website development or marketplace enquiries.</p></div></div>
        <div className="contact-grid">
          <a className="contact-card" href="mailto:vpnproductsandservices@gmail.com"><span className="contact-icon">✉</span><span><b>Email us</b><small>vpnproductsandservices@gmail.com</small></span></a>
          <a className="contact-card" href="tel:+919916140898"><span className="contact-icon">☎</span><span><b>Call us</b><small>+91 99161 40898</small></span></a>
          <a className="contact-card" href="https://wa.me/919916140898?text=Hello%20VPN%20Products%20and%20Services%2C%20I%20have%20an%20enquiry." target="_blank" rel="noopener noreferrer"><span className="contact-icon brand-icon whatsapp-icon"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.52 3.48A11.87 11.87 0 0 0 12.08 0C5.48 0 .11 5.37.11 11.97c0 2.11.55 4.17 1.6 5.98L0 24l6.2-1.63a11.86 11.86 0 0 0 5.87 1.54h.01c6.6 0 11.97-5.37 11.97-11.97a11.9 11.9 0 0 0-3.53-8.46zM12.08 21.9c-1.83 0-3.62-.49-5.18-1.42l-.37-.22-3.68.97.98-3.59-.24-.37a9.88 9.88 0 1 1 8.49 4.63zm5.42-7.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35z"/></svg></span><span><b>WhatsApp us</b><small>+91 99161 40898</small></span></a>
          <a className="contact-card instagram-card" href="https://www.instagram.com/vpnproductsandservices/" target="_blank" rel="noopener noreferrer"><span className="contact-icon brand-icon instagram-icon"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.25" fill="currentColor"/></svg></span><span><b>Follow us on Instagram</b><small>@vpnproductsandservices</small></span></a>
          <a className="contact-card address-card" href="https://maps.app.goo.gl/xQe4VLiTK6Wsiqfm7" target="_blank" rel="noopener noreferrer"><span className="contact-icon">⌖</span><span><b>Visit our exact location</b><small>Open the exact shop pin shared on Google Maps</small><small className="map-link-label">Get directions on Google Maps →</small></span></a>
        </div>
      </section>
      </>}
    </main>
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand-block">
          <h2 className="footer-brand">VPN Products<br/>and Services</h2>
          <p>Computer and mobile services, Xerox and printing, online application assistance, website development, and a marketplace for new and second-hand products.</p>
        </div>
        <div className="footer-column">
          <h3>Visit our shop</h3>
          <p className="footer-address">Find our shop using the exact Google Maps pin shared by VPN Products and Services.</p>
          <a className="footer-plain-link" href="https://maps.app.goo.gl/xQe4VLiTK6Wsiqfm7" target="_blank" rel="noopener noreferrer">Get directions →</a>
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
    {notice && <div className="notice" role="status" aria-live="polite"><span>{notice}</span><button type="button" className="notice-dismiss" aria-label="Dismiss notification" onClick={()=>setNotice("")}>×</button></div>}
    {profilePanel && user && <div className="overlay" onClick={closeProfilePanel}>
      <div className="modal wide profile-settings-modal" role="dialog" aria-modal="true" aria-labelledby="profile-panel-title" onClick={e=>e.stopPropagation()}>
        <button className="close" type="button" aria-label="Close profile window" onClick={closeProfilePanel}>×</button>
        {profilePanel === "view" && <>
          <h2 id="profile-panel-title">My Profile</h2>
          <div className="profile-view-card">
            {user.user_metadata?.avatar_url ? <img className="profile-view-avatar" src={user.user_metadata.avatar_url} alt="Profile"/> : <span className="profile-view-avatar profile-view-avatar-placeholder">{displayName.charAt(0).toUpperCase()}</span>}
            <div className="profile-view-identity"><b>{displayName}</b><small>VPN Products and Services member</small></div>
          </div>
          <div className="profile-detail-list">
            <div><span>Full name</span><b>{displayName}</b></div>
            <div><span>Email address</span><b>{user.email || "Not added"}</b></div>
            <div><span>Phone number</span><b>{user.phone || "Not added"}</b></div>
            <div><span>Member since</span><b>{user.created_at ? new Date(user.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—"}</b></div>
          </div>
          <button className="btn primary full profile-panel-primary" type="button" onClick={()=>openProfilePanel("edit")}>Edit Profile</button>
          <button className="btn light full profile-panel-secondary" type="button" onClick={()=>openProfilePanel("details")}>Manage Account Details</button>
          <button className="btn light full profile-panel-secondary" type="button" onClick={()=>openProfilePanel("password")}>Change Password</button>
        </>}
        {profilePanel === "edit" && <>
          <h2 id="profile-panel-title">Edit Profile</h2>
          <p className="auth-hint">Update the name and profile photo shown on your account.</p>
          <form onSubmit={saveProfileSettings}>
            <div className="profile-photo-editor">
              {avatarFile ? <span className="profile-view-avatar profile-view-avatar-placeholder">{displayName.charAt(0).toUpperCase()}</span>
                : user.user_metadata?.avatar_url ? <img className="profile-view-avatar" src={user.user_metadata.avatar_url} alt="Current profile"/>
                : <span className="profile-view-avatar profile-view-avatar-placeholder">{displayName.charAt(0).toUpperCase()}</span>}
              <label className="profile-photo-upload">Profile Photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setAvatarFile(e.target.files?.[0] || null)}/></label>
            </div>
            {avatarFile && <small className="profile-file-name">Selected: {avatarFile.name}</small>}
            <label>Profile Name<input required type="text" autoComplete="name" maxLength={80} value={profileNameDraft} onChange={e=>setProfileNameDraft(e.target.value)} placeholder="Enter your profile name"/></label>
            <button className="btn primary full" disabled={profileSaving}>{profileSaving ? "Saving…" : "Save Profile"}</button>
          </form>
        </>}
        {profilePanel === "password" && <>
          <h2 id="profile-panel-title">Change Password</h2>
          <p className="auth-hint">Choose a strong password with at least 8 characters.</p>
          <form onSubmit={changeAccountPassword}>
            <label>New Password<input required minLength={8} autoComplete="new-password" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Enter new password"/></label>
            <label>Confirm New Password<input required minLength={8} autoComplete="new-password" type="password" value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} placeholder="Re-enter new password"/></label>
            <button className="btn primary full" disabled={profileSaving}>{profileSaving ? "Updating…" : "Update Password"}</button>
          </form>
        </>}
        {profilePanel === "details" && <>
          <h2 id="profile-panel-title">Account Details</h2>
          <p className="auth-hint">Change your registered email address or phone number. Supabase will ask you to verify the new contact detail.</p>
          <form onSubmit={updateAccountEmail}>
            <label>Registered Email<input type="email" autoComplete="email" value={profileEmailDraft} onChange={e=>setProfileEmailDraft(e.target.value)} placeholder="Enter email address"/></label>
            <button className="btn light full" disabled={profileSaving}>{profileSaving ? "Please wait…" : "Update Email"}</button>
          </form>
          <div className="profile-panel-divider"/>
          <form onSubmit={pendingPhoneChange ? verifyAccountPhoneChange : updateAccountPhone}>
            <label>{pendingPhoneChange ? "Verification code sent to " + pendingPhoneChange : "Registered Phone Number"}
              {pendingPhoneChange
                ? <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={phoneChangeCode} onChange={e=>setPhoneChangeCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="Enter SMS verification code"/>
                : <input type="tel" autoComplete="tel" value={profilePhoneDraft} onChange={e=>setProfilePhoneDraft(e.target.value)} placeholder="10-digit mobile number"/>}
            </label>
            <button className="btn primary full" disabled={profileSaving}>{profileSaving ? "Please wait…" : pendingPhoneChange ? "Verify New Phone Number" : "Update Phone Number"}</button>
            {pendingPhoneChange && <button className="switch" type="button" onClick={()=>{setPendingPhoneChange("");setPhoneChangeCode("");}}>Cancel phone verification</button>}
          </form>
        </>}
      </div>
    </div>}
    {authOpen && <div className="overlay"><div className="modal" onClick={e=>e.stopPropagation()}>
      <button className="close" type="button" onClick={()=>{if(passwordResetMode!=="update") { setAuthOpen(false); setPasswordResetMode(null); }}} disabled={passwordResetMode==="update"}>×</button>
      {passwordResetMode==="request" ? <>
        <h2>Forgot password?</h2>
        <p className="auth-hint">Enter the email address linked to your account. We'll send you a secure password reset link.</p>
        <form onSubmit={requestPasswordReset}>
          <label>Email Address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email address"/></label>
          <button className="btn primary full" disabled={passwordResetBusy}>{passwordResetBusy?"Sending reset link…":"Send reset link"}</button>
        </form>
        <button type="button" className="switch auth-back-link" onClick={()=>{setPasswordResetMode(null);setNotice("");}}>Back to login</button>
      </> : passwordResetMode==="update" ? <>
        <h2>Set a new password</h2>
        <p className="auth-hint">Choose a new password for your VPN Products and Services account.</p>
        <form onSubmit={savePasswordReset}>
          <label>New Password<input required minLength={8} type="password" autoComplete="new-password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} placeholder="At least 8 characters"/></label>
          <label>Confirm New Password<input required minLength={8} type="password" autoComplete="new-password" value={confirmResetPassword} onChange={e=>setConfirmResetPassword(e.target.value)} placeholder="Re-enter your new password"/></label>
          <button className="btn primary full" disabled={passwordResetBusy}>{passwordResetBusy?"Updating password…":"Update password"}</button>
        </form>
      </> : <>
        <h2>{mode==="login"?"Welcome back":"Create an account"}</h2>
        <form key={mode} autoComplete={mode==="login"?"on":"off"} onSubmit={authenticate}>
          {mode==="signup" && <label>Full Name<input required type="text" name="signup-full-name" autoComplete="name" maxLength={80} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Enter your full name"/></label>}
          <label>Email Address<input required type="email" name={mode==="login"?"username":"signup-email"} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email address"/></label>
          <label>Password<input required minLength={8} name={mode==="login"?"password":"signup-new-password"} autoComplete={mode==="login"?"current-password":"new-password"} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
          {mode==="signup" && <label>Confirm Password<input required minLength={8} name="signup-confirm-password" autoComplete="new-password" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter your password (minimum 8 characters)"/></label>}
          <button className="btn primary full">{mode==="login"?"Sign in":"Create account"}</button>
          {mode==="signup" && <p className="auth-hint">Register using your email address. We'll send you a confirmation link before you can sign in.</p>}
        </form>
        {mode==="login" && <button type="button" className="switch auth-forgot-link" onClick={()=>{setPasswordResetMode("request");setShowResendConfirmation(false);setNotice("");}}>Forgot password?</button>}
        {mode==="login" && showResendConfirmation && <button type="button" className="switch" onClick={resendEmailConfirmation}>Resend confirmation email</button>}
        <button type="button" className="switch" onClick={()=>{setMode(mode==="login"?"signup":"login");setPasswordResetMode(null);setShowResendConfirmation(false);setEmail("");setPassword("");setConfirmPassword("");setFullName("");}}>{mode==="login"?"New user? Create an account":"Already registered? Sign in"}</button>
      </>}
    </div></div>}
    {sellOpen && <div className="overlay" onClick={()=>setSellOpen(false)}><div className="modal wide" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSellOpen(false)}>×</button><h2>Post an item</h2><form onSubmit={submitListing}><label>Title<input required maxLength={90} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Category<select value={formCategory} onChange={e=>setFormCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Price in ₹<input required min="1" type="number" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Description<textarea required minLength={20} maxLength={1500} rows={4} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>Condition<select value={condition} onChange={e=>setCondition(e.target.value)}><option>Like New</option><option>Good</option><option>Fair</option><option>For Parts</option></select></label><div className="row"><label>City<input required value={city} onChange={e=>setCity(e.target.value)} placeholder="Bengaluru"/></label><label>State<input required value={state} onChange={e=>setState(e.target.value)} placeholder="Karnataka"/></label></div><div className="shipping-package-fields"><b>Packed parcel details</b><small>Required for Shiprocket delivery estimates. Enter measurements after packing the product. All marketplace parcels are dispatched from the VPN Products and Services shop, so sellers must bring accepted items to the shop for packing and pickup.</small><div className="row"><label>Packed weight (kg)<input required type="number" min="0.01" step="0.01" value={packageWeightKg} onChange={e=>setPackageWeightKg(e.target.value)} placeholder="e.g. 0.50"/></label><label>Length (cm)<input required type="number" min="0.6" step="0.1" value={packageLengthCm} onChange={e=>setPackageLengthCm(e.target.value)} placeholder="e.g. 20"/></label><label>Breadth (cm)<input required type="number" min="0.6" step="0.1" value={packageBreadthCm} onChange={e=>setPackageBreadthCm(e.target.value)} placeholder="e.g. 15"/></label><label>Height (cm)<input required type="number" min="0.6" step="0.1" value={packageHeightCm} onChange={e=>setPackageHeightCm(e.target.value)} placeholder="e.g. 10"/></label></div></div><label>WhatsApp / phone<input required inputMode="numeric" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="10-digit mobile number"/></label><label>Photos (up to 5)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setPhotos(e.target.files)}/></label><button className="btn primary full">Submit for review</button><small>Listings appear publicly only after admin approval.</small></form></div></div>}
  </div>;
}
