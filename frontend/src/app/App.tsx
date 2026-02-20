import { useState, useEffect, useRef, useMemo } from "react";
import {
  Check,
  ArrowLeft,
  Lock,
  Menu,
  Wallet,
  LayoutDashboard,
  History,
  Banknote,
  Trash2,
  Plus,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { usePaystackPayment } from "react-paystack";

type DataBundle = {
  id: string;
  data: string;
  price: string;
};

type Network = {
  id: string;
  name: string;
  color: string;
  textColor: string;
  logo: string;
};

type Order = {
  id: string;
  network: string;
  bundle: string;
  price: string;
  recipientNumber: string;
  paymentNumber: string;
  status: "pending" | "completed" | "failed";
  timestamp: string;
};

const networks: Network[] = [
  {
    id: "mtn",
    name: "MTN",
    color: "#FFCC00",
    textColor: "#000000",
    logo: "/logos/mtnlogo.png",
  },
  {
    id: "telecel",
    name: "Telecel",
    color: "#E30613",
    textColor: "#FFFFFF",
    logo: "/logos/Telecel-logo-2012.png",
  },
  {
    id: "airteltigo",
    name: "AirtelTigo",
    color: "#ED1C24",
    textColor: "#FFFFFF",
    logo: "/logos/airteltigo.png",
  },
  {
    id: "mtn-afa",
    name: "MTN AFA",
    color: "#004F71",
    textColor: "#FFFFFF",
    logo: "/logos/mtnAfa.webp",
  },
];

const INITIAL_BUNDLES: Record<string, DataBundle[]> = {
  mtn: [
    { id: "mtn-1", data: "1GB", price: "GH₵4.9" },
    { id: "mtn-2", data: "2GB", price: "GH₵9.8" },
    { id: "mtn-3", data: "3GB", price: "GH₵13.5" },
    { id: "mtn-4", data: "4GB", price: "GH₵18.5" },
    { id: "mtn-5", data: "5GB", price: "GH₵22.5" },
    { id: "mtn-6", data: "6GB", price: "GH₵27" },
    { id: "mtn-7", data: "8GB", price: "GH₵35.7" },
    { id: "mtn-8", data: "10GB", price: "GH₵44.5" },
    { id: "mtn-9", data: "15GB", price: "GH₵64" },
    { id: "mtn-10", data: "20GB", price: "GH₵84" },
  ],
  telecel: [
  //  { id: "telecel-1", data: "5GB", price: "GH₵22" },
    { id: "telecel-2", data: "10GB", price: "GH₵43" },
    { id: "telecel-3", data: "15GB", price: "GH₵58" },
    { id: "telecel-4", data: "20GB", price: "GH₵78" },
    { id: "telecel-5", data: "25GB", price: "GH₵96" },
    { id: "telecel-6", data: "25GB", price: "GH₵113" },
  ],
  airteltigo: [
    { id: "airteltigo-1", data: "1GB", price: "GH₵4.7" },
    { id: "airteltigo-2", data: "2GB", price: "GH₵8.8" },
    { id: "airteltigo-3", data: "3GB", price: "GH₵13" },
    { id: "airteltigo-4", data: "4GB", price: "GH₵18" },
    { id: "airteltigo-5", data: "5GB", price: "GH₵20" },
    { id: "airteltigo-6", data: "10GB", price: "GH₵43" },
    { id: "airteltigo-7", data: "15GB", price: "GH₵60" },
    { id: "airteltigo-8", data: "20GB", price: "GH₵81.5" },
  ],
  "mtn-afa": [
  //  { id: "afa-1", data: "1GB", price: "GH₵5" },
   // { id: "afa-2", data: "2GB", price: "GH₵10" },
   // { id: "afa-3", data: "3GB", price: "GH₵15" },
   // { id: "afa-4", data: "5GB", price: "GH₵24" },
  ],
};

export default function App() {
  const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://airtime-backend-app-d61f8bf0e690.herokuapp.com/functions/v1";

  const [mode, setMode] = useState<"customer" | "admin">("customer");
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);

  // Dynamic Pricing State
  const [bundles, setBundles] = useState<Record<string, DataBundle[]>>(() => {
    const saved = localStorage.getItem("airtime_bundles");
    return saved ? JSON.parse(saved) : INITIAL_BUNDLES;
  });

  const [costPrices, setCostPrices] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem("airtime_cost_prices");
    return saved ? JSON.parse(saved) : {};
  });

  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const isInitialLoad = useRef(true);

  // Function to handle tab switching with unsaved changes confirmation
  const handleTabSwitch = (newTab: typeof activeTab) => {
    if (hasUnsavedChanges && activeTab === "pricing") {
      const confirmLeave = window.confirm(
        "You have unsaved pricing changes. Are you sure you want to leave? Your changes will be lost."
      );
      if (!confirmLeave) return;
    }
    setActiveTab(newTab);
  };

  // Function to save all pricing changes
  const savePricingChanges = () => {
    localStorage.setItem("airtime_bundles", JSON.stringify(bundles));
    localStorage.setItem("airtime_cost_prices", JSON.stringify(costPrices));
    setHasUnsavedChanges(false);
  };

  // Track changes for unsaved indicator (skip initial load)
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    setHasUnsavedChanges(true);
  }, [bundles, costPrices]);

  const [step, setStep] = useState<
    "network" | "package" | "payment" | "confirmation"
  >("network");
  const [selectedNetwork, setSelectedNetwork] = useState<string>("");
  const [selectedBundle, setSelectedBundle] = useState<string>("");
  const [recipientNumber, setRecipientNumber] = useState<string>("");
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Mock orders data - REPLACED WITH REAL DATA
  const [orders, setOrders] = useState<Order[]>([]);

  // Fetch orders when entering Admin Mode
  useEffect(() => {
    if (mode === "admin" && isAdminLoggedIn) {
      const fetchOrders = async () => {
        try {
          const response = await fetch(`${API_URL}/admin/orders`);
          const data = await response.json();
          if (data.success) {
            // Map API orders to frontend format
            const mappedOrders = data.orders.map((o: any) => ({
              id: o.id,
              network: o.network,
              bundle: o.bundleData,
              price: `GH₵${o.bundlePrice}`,
              recipientNumber: o.recipientNumber,
              paymentNumber: o.paymentNumber,
              status:
                o.status === "pending_payment"
                  ? "pending"
                  : o.status === "paid"
                    ? "completed"
                    : o.status,
              timestamp: new Date(o.createdAt).toLocaleString(),
            }));
            setOrders(mappedOrders);
          }
        } catch (error) {
          console.error("Failed to fetch orders:", error);
        }
      };
      fetchOrders();

      // Refresh every 10 seconds
      const interval = setInterval(fetchOrders, 10000);
      return () => clearInterval(interval);
    }
  }, [mode, isAdminLoggedIn]);

  const handleAdminLogin = async (
    email: string,
    password: string,
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Login error:", error.message);
        alert(`Login failed: ${error.message}`); // Show error to user
        return false;
      }

      if (data.user) {
        setIsAdminLoggedIn(true);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Unexpected error:", err);
      return false;
    }
  };

  const handleAdminLogout = async () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        "You have unsaved pricing changes. Are you sure you want to logout? Your changes will be lost."
      );
      if (!confirmLeave) return;
    }
    await supabase.auth.signOut();
    setIsAdminLoggedIn(false);
    setMode("customer");
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: "pending" | "completed" | "failed",
  ) => {
    // Optimistic Update
    setOrders(
      orders.map((order) =>
        order.id === orderId ? { ...order, status: newStatus } : order,
      ),
    );

    // Sync with Server
    try {
      await fetch(`${API_URL}/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error("Failed to persist status update:", err);
    }
  };

  // Admin Mode
  if (mode === "admin") {
    if (!isAdminLoggedIn) {
      return (
        <AdminLogin
          onLogin={handleAdminLogin}
          onBackToCustomer={() => {
            if (hasUnsavedChanges) {
              const confirmLeave = window.confirm(
                "You have unsaved pricing changes. Are you sure you want to switch to customer mode? Your changes will be lost."
              );
              if (!confirmLeave) return;
            }
            setMode("customer");
          }}
        />
      );
    }
    return (
      <AdminDashboard
        orders={orders}
        onLogout={handleAdminLogout}
        onUpdateStatus={handleUpdateOrderStatus}
        bundles={bundles}
        setBundles={setBundles}
        costPrices={costPrices}
        setCostPrices={setCostPrices}
        hasUnsavedChanges={hasUnsavedChanges}
        savePricingChanges={savePricingChanges}
      />
    );
  }

  const handleNetworkSelect = (networkId: string) => {
    setSelectedNetwork(networkId);
    setStep("package");
  };

  const handlePackageSelect = (bundleId: string) => {
    setSelectedBundle(bundleId);
    setStep("payment");
  };

  const handlePaymentSubmit = async (data: {
    reference: any;
    orderId: string;
    order?: any;
  }) => {
    const { reference, orderId, order } = data;
    setStep("confirmation");
    setIsProcessing(true);
    // Set preliminary order info if available
    if (order) setConfirmedOrder(order);

    try {
      // 2. Verify with Backend (Secure Flow)
      // We skip step 1 (create order) because it's now done in PaymentDetails
      try {
        const verifyResp = await fetch(`${API_URL}/orders/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference: reference.reference,
            orderId: orderId,
          }),
        });
        const verifyData = await verifyResp.json();
        console.log("Verification result:", verifyData);

        if (verifyData.success) {
          setConfirmedOrder(verifyData.order);
        } else {
          console.error("Verification failed:", verifyData.error);
          // Optionally show alert lightly, but keep UI in success state since customer paid
        }
      } catch (fulfillmentErr) {
        console.error("Backend verification trigger failed:", fulfillmentErr);
      }

      setIsProcessing(false);
      // Success state will be shown by step 'confirmation'
    } catch (err) {
      console.error("Network error:", err);
      setIsProcessing(false);
      setStep("payment");
    }
  };

  const handleBuyAgain = () => {
    // Keep the same network, reset bundle and payment info, go to package selection
    setSelectedBundle("");
    setRecipientNumber("");
    setIsProcessing(false);
    setStep("package");
  };

  const handleGoHome = () => {
    // Reset everything and go back to network selection
    setStep("network");
    setSelectedNetwork("");
    setSelectedBundle("");
    setRecipientNumber("");
    setIsProcessing(false);
  };

  const handleBack = () => {
    if (step === "package") {
      setStep("network");
      setSelectedNetwork("");
    } else if (step === "payment") {
      setStep("package");
      setSelectedBundle("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex justify-between items-center">
        {step !== "network" && step !== "confirmation" ? (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-700 font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
        ) : (
          <div className="font-extrabold text-4xl tracking-tighter bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-transparent bg-clip-text drop-shadow-sm py-1">
            Firefly Ventures
          </div>
        )}

        {/* Right side menu */}
        {step === "network" && (
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <div className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer">
                <Menu className="w-6 h-6 text-gray-700" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-white shadow-lg rounded-xl p-2 border border-gray-100"
            >
              <DropdownMenuItem
                onClick={() => setMode("admin")}
                className="cursor-pointer p-3 hover:bg-gray-50 rounded-lg flex items-center gap-3"
              >
                <Lock className="w-4 h-4" />
                <span>Admin Login</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        {step === "network" && (
          <NetworkSelection onSelect={handleNetworkSelect} />
        )}

        {step === "package" && selectedNetwork && (
          <PackageSelection
            network={networks.find((n) => n.id === selectedNetwork)!}
            bundles={bundles[selectedNetwork]}
            onSelect={handlePackageSelect}
          />
        )}

        {step === "payment" && (
          <PaymentDetails
            recipientNumber={recipientNumber}
            onRecipientChange={setRecipientNumber}
            onSubmit={handlePaymentSubmit}
            selectedBundle={bundles[selectedNetwork]?.find(
              (b) => b.id === selectedBundle,
            )}
            network={networks.find((n) => n.id === selectedNetwork)!}
            backendEndpoint={API_URL}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
          />
        )}

        {step === "confirmation" && (
          <PaymentConfirmation
            order={confirmedOrder}
            onBuyAgain={handleBuyAgain}
            onGoHome={handleGoHome}
            isProcessing={isProcessing}
          />
        )}
      </div>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/233558302466"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-xl hover:bg-[#20bd5a] transition-all hover:scale-105 active:scale-95 flex items-center justify-center animate-bounce-slow hover:shadow-2xl"
        aria-label="Chat on WhatsApp"
      >
        <svg
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="currentColor"
          className="w-8 h-8"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      </a>
    </div>
  );
}

function NetworkSelection({
  onSelect,
}: {
  onSelect: (networkId: string) => void;
}) {
  return (
    <div className="p-6">
      <div className="max-w-md mx-auto mb-8 text-center space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 text-transparent bg-clip-text p-1">
          Affordable Data Bundles
        </h1>
        <p className="text-gray-500 font-medium">
          Choose your network to get started
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
        {networks.map((network) => (
          <button
            key={network.id}
            onClick={() => onSelect(network.id)}
            className="w-full aspect-square rounded-2xl shadow-xl hover:shadow-2xl transition-all active:scale-95 border-2 border-white overflow-hidden relative group"
            style={{ backgroundColor: network.color }}
          >
            <img
              src={network.logo}
              alt={network.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex items-end justify-start h-1/2">
              <span className="text-white font-bold text-xl drop-shadow-md tracking-wide">
                {network.name}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PackageSelection({
  network,
  bundles,
  onSelect,
}: {
  network: Network;
  bundles: DataBundle[];
  onSelect: (bundleId: string) => void;
}) {
  return (
    <div className="p-6">
      <div
        className="rounded-2xl p-6 text-center font-bold text-2xl mb-6 shadow-lg"
        style={{
          backgroundColor: network.color,
          color: network.textColor,
        }}
      >
        {network.name}
      </div>

      <h2 className="text-2xl font-bold text-center mb-6">
        Select Data Package
      </h2>

      <div className="grid grid-cols-1 gap-4 max-w-md mx-auto">
        {bundles.map((bundle) => (
          <button
            key={bundle.id}
            onClick={() => onSelect(bundle.id)}
            className="bg-white rounded-xl p-6 text-left shadow-md border-2 border-gray-200 transition-all active:scale-95 active:border-indigo-500"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl font-bold">{bundle.data}</span>
              <span className="text-2xl text-indigo-600 font-bold">
                {bundle.price}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-white bg-green-500 rounded-sm p-0.5" />
              <span className="text-green-600 text-sm font-medium">
                Non-Expiry
              </span>
            </div>

            <div className="inline-flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded">
              <div className="w-3 h-3 bg-green-600 rounded-sm flex items-center justify-center">
                <span className="text-white text-[10px]">%</span>
              </div>
              <span className="text-green-700 font-medium text-sm">
                Special Rate
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PaymentDetails({
  recipientNumber,
  onRecipientChange,
  // onEmailChange removed
  onSubmit, // Now accepts reference
  selectedBundle,
  network,
  backendEndpoint,
  isProcessing,
  setIsProcessing,
}: {
  recipientNumber: string;
  onRecipientChange: (value: string) => void;
  // onEmailChange removed
  onSubmit: (reference: any) => void;
  selectedBundle?: DataBundle;
  network: Network;
  backendEndpoint: string;
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
}) {
  const isFormValid = recipientNumber.length >= 10;

  const price =
    parseFloat(selectedBundle?.price.replace("GH₵", "") || "0") * 100;

  // Derive dummy email using recipient number since payment number is removed
  const derivedEmail = `${recipientNumber || "customer"}@firefly.com`;

  const config = {
    reference: new Date().getTime().toString(),
    email: derivedEmail,
    amount: price,
    currency: "GHS",
    channels: ["mobile_money"],
    publicKey:
      import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ||
      "pk_test_0c38b24d506f6703ac29310cd2efa4e85bd91313",
  };

  const initializePayment = usePaystackPayment(config);

  return (
    <div className="p-6">
      <div
        className="rounded-2xl p-4 text-center font-bold text-xl mb-6 shadow-lg"
        style={{
          backgroundColor: network.color,
          color: network.textColor,
        }}
      >
        {network.name} - {selectedBundle?.data} ({selectedBundle?.price})
      </div>

      <h2 className="text-2xl font-bold text-center mb-8">Payment Details</h2>

      <div className="space-y-6 max-w-md mx-auto">
        <div>
          <label className="block text-lg font-semibold mb-3">
            Recipient Phone Number
          </label>
          <input
            type="tel"
            value={recipientNumber}
            onChange={(e) => onRecipientChange(e.target.value)}
            placeholder="0XX XXX XXXX"
            className="w-full text-xl p-4 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:outline-none"
            maxLength={10}
          />
          <p className="text-sm text-gray-500 mt-2">
            Number that will receive the data
          </p>
          <p className="text-sm text-amber-600 mt-1 font-medium">
            ⚠️ Order to a wrong number cannot be reversed
          </p>
        </div>

        {/* Payment Number and Email inputs removed */}

        <button
          onClick={async () => {
            setIsProcessing(true);
            // 1. Create Pending Order
            try {
              const res = await fetch(`${backendEndpoint}/orders`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  network: network.name,
                  bundleId: selectedBundle?.id,
                  bundleData: selectedBundle?.data,
                  bundlePrice: selectedBundle?.price,
                  recipientNumber: recipientNumber,
                  paymentNumber: recipientNumber,
                  email: `${recipientNumber}@firefly.com`,
                }),
              });
              const data = await res.json();
              if (!data.success) throw new Error(data.error);

              const orderId = data.orderId;
              const order = data.order;

              // 2. Start Payment
              initializePayment({
                onSuccess: (reference) =>
                  onSubmit({ reference, orderId, order }),
                onClose: () => setIsProcessing(false),
              });
            } catch (e) {
              alert("Could not initiate order. Please try again.");
              console.error(e);
              setIsProcessing(false);
            }
          }}
          disabled={!isFormValid || isProcessing}
          className={`w-full text-xl font-bold py-5 rounded-xl shadow-lg transition-all ${
            isFormValid && !isProcessing
              ? "bg-indigo-600 text-white active:scale-95"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          {isProcessing ? "Processing..." : `Pay ${selectedBundle?.price}`}
        </button>
      </div>
    </div>
  );
}

function PaymentConfirmation({
  order,
  onBuyAgain,
  onGoHome,
  isProcessing,
}: {
  order: any;
  onBuyAgain: () => void;
  onGoHome: () => void;
  isProcessing: boolean;
}) {
  // Show Receipt
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-sm border border-gray-100 relative overflow-hidden">
        {/* Receipt Top Pattern */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-8 h-8 text-green-600" strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Payment Successful
          </h2>
          <p className="text-gray-500 text-sm">Thank you for your purchase</p>
        </div>

        <div className="border-t-2 border-dashed border-gray-200 my-4"></div>

        <div className="space-y-4 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Order ID:</span>
            <span className="font-mono font-medium">{order?.id}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-500">Date:</span>
            <span className="font-medium">{new Date().toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-500">Network:</span>
            <span className="font-bold">{order?.network}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-500">Data Bundle:</span>
            <span className="font-bold">{order?.bundleData}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-500">Recipient:</span>
            <span className="font-mono font-medium">
              {order?.recipientNumber}
            </span>
          </div>
        </div>

        <div className="border-t-2 border-dashed border-gray-200 my-4"></div>

        <div className="flex justify-between items-center text-lg font-bold">
          <span>Total Paid</span>
          <span className="text-indigo-600">
            GH₵{(order?.bundlePrice || 0).toFixed(2)}
          </span>
        </div>

        {/* Receipt Bottom Pattern */}
        <div className="absolute bottom-0 left-0 w-full flex space-x-1 overflow-hidden opacity-20">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-4 h-4 bg-gray-900 rounded-full -mb-2"
            ></div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4 w-full max-w-sm">
        <button
          onClick={onBuyAgain}
          className="w-full text-lg font-bold py-4 bg-indigo-600 text-white rounded-xl shadow-lg transition-all active:scale-95 hover:bg-indigo-700"
        >
          Buy Another Bundle
        </button>
        <button
          onClick={onGoHome}
          className="w-full text-lg font-bold py-4 bg-white text-gray-700 border-2 border-gray-200 rounded-xl transition-all active:scale-95 hover:bg-gray-50"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

function AdminLogin({
  onLogin,
  onBackToCustomer,
}: {
  onLogin: (email: string, password: string) => Promise<boolean>;
  onBackToCustomer: () => void;
}) {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const success = await onLogin(email, password);
      if (!success) {
        setError("Invalid email or password");
      }
    } catch (e) {
      setError("An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
      <h2 className="text-3xl font-bold text-center mb-4">Admin Login</h2>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md w-full">
        <div>
          <label className="block text-lg font-semibold mb-3">
            Email or Username
          </label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter admin email"
            className="w-full text-xl p-4 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-lg font-semibold mb-3">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full text-xl p-4 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:outline-none"
            required
          />
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full text-xl font-bold py-5 rounded-xl shadow-lg bg-indigo-600 text-white active:scale-95 transition-all ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
        >
          {isLoading ? "Logging in..." : "Login"}
        </button>

        <button
          onClick={onBackToCustomer}
          className="w-full text-xl font-bold py-5 bg-gray-700 text-white rounded-xl shadow-lg transition-all active:scale-95"
        >
          Back to Customer Mode
        </button>
      </form>
    </div>
  );
}

function AdminDashboard({
  orders,
  onLogout,
  onUpdateStatus,
  bundles,
  setBundles,
  costPrices,
  setCostPrices,
  hasUnsavedChanges,
  savePricingChanges,
}: {
  orders: Order[];
  onLogout: () => void;
  onUpdateStatus: (
    orderId: string,
    newStatus: "pending" | "completed" | "failed",
  ) => void;
  bundles: Record<string, DataBundle[]>;
  setBundles: React.Dispatch<
    React.SetStateAction<Record<string, DataBundle[]>>
  >;
  costPrices: Record<string, number>;
  setCostPrices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  hasUnsavedChanges: boolean;
  savePricingChanges: () => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "orders" | "pricing" | "settings"
  >("dashboard");

  // Function to handle internal tab switching with unsaved changes confirmation
  const handleInternalTabSwitch = (newTab: typeof activeTab) => {
    if (hasUnsavedChanges && activeTab === "pricing") {
      const confirmLeave = window.confirm(
        "You have unsaved pricing changes. Are you sure you want to leave? Your changes will be lost."
      );
      if (!confirmLeave) return;
    }
    setActiveTab(newTab);
  };
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Date Range State
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0], // First day of current month
    end: new Date().toISOString().split("T")[0], // Today
  });

  // State for new bundle inputs per network
  const [newBundleInputs, setNewBundleInputs] = useState<
    Record<string, { data: string; cost: string; price: string }>
  >({});

  const handleAddBundle = (networkId: string) => {
    const input = newBundleInputs[networkId];
    if (!input || !input.data || !input.price) return; // Basic validation

    const netIdClean = networkId.toLowerCase().replace(/\s/g, "-");
    const newId = `${netIdClean}-${Date.now()}`; // Generate unique ID

    // Create new bundle object
    const newBundle: DataBundle = {
      id: newId,
      data: input.data,
      price: `GH₵${parseFloat(input.price).toFixed(2).replace(/\.00$/, "")}`, // Format price like GH₵5 or GH₵5.5
    };

    // Update bundles state
    setBundles((prev) => ({
      ...prev,
      [networkId]: [...(prev[networkId] || []), newBundle],
    }));

    // Update cost price
    if (input.cost) {
      setCostPrices((prev) => ({
        ...prev,
        [newId]: parseFloat(input.cost),
      }));
    }

    // Reset inputs
    setNewBundleInputs((prev) => ({
      ...prev,
      [networkId]: { data: "", cost: "", price: "" },
    }));
  };

  const handleDeleteBundle = (networkId: string, bundleId: string) => {
    if (!confirm("Are you sure you want to delete this bundle?")) return;

    setBundles((prev) => ({
      ...prev,
      [networkId]: prev[networkId].filter((b) => b.id !== bundleId),
    }));

    // Optional: Clean up cost price (not strictly necessary but good for hygiene)
    setCostPrices((prev) => {
      const newCosts = { ...prev };
      delete newCosts[bundleId];
      return newCosts;
    });
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      alert("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      alert("Error updating password: " + error.message);
    }
  };

  // Helper to parse price
  const getPriceValue = (priceStr: string) => {
    try {
      if (!priceStr) return 0;
      return parseFloat(priceStr.replace("GH₵", ""));
    } catch {
      return 0;
    }
  };

  // Filter orders by date range (memoized for performance)
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const orderDate = order.timestamp
        ? new Date(order.timestamp).toISOString().split("T")[0]
        : "";
      return orderDate >= dateRange.start && orderDate <= dateRange.end;
    });
  }, [orders, dateRange.start, dateRange.end]);

  // Calculate Metrics (memoized for performance)
  const totalSales = useMemo(() => {
    return filteredOrders
      .filter((o) => o.status === "completed")
      .reduce((acc, curr) => acc + getPriceValue(curr.price), 0);
  }, [filteredOrders]);

  const totalCommission = useMemo(() => {
    return filteredOrders
      .filter((o) => o.status === "completed")
      .reduce((acc, curr) => {
        const selling = getPriceValue(curr.price);
        let cost = 0;

        // Attempt to find configured cost based on order details
        // We map the network display name back to an ID to lookup bundles
        const net = networks.find(
          (n) => n.name === curr.network || n.id === curr.network,
        );
        if (net && bundles[net.id]) {
          const bun = bundles[net.id].find((b) => b.data === curr.bundle);
          if (bun) {
            cost = costPrices[bun.id] || 0;
          }
        }

        // Fallback if no specific cost set: 85% of selling price
        if (cost === 0) cost = selling * 0.85;

        return acc + (selling - cost);
      }, 0);
  }, [filteredOrders, bundles, costPrices]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Lock className="w-5 h-5 text-indigo-600" />
          Admin Panel
        </h1>
        <button onClick={onLogout} className="text-sm font-medium text-red-600">
          Logout
        </button>
      </div>

      {/* Modern Tabs Navigation */}
      <div className="bg-white px-2 pt-2 border-b overflow-x-auto no-scrollbar">
        <div className="flex gap-4 min-w-max">
          <button
            onClick={() => handleInternalTabSwitch("dashboard")}
            className={`flex items-center gap-2 px-4 py-3 rounded-t-lg border-b-2 transition-colors ${
              activeTab === "dashboard"
                ? "border-indigo-600 text-indigo-600 bg-indigo-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="font-medium">Dashboard</span>
          </button>

          <button
            onClick={() => handleInternalTabSwitch("orders")}
            className={`flex items-center gap-2 px-4 py-3 rounded-t-lg border-b-2 transition-colors ${
              activeTab === "orders"
                ? "border-indigo-600 text-indigo-600 bg-indigo-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <History className="w-4 h-4" />
            <span className="font-medium">Orders</span>
          </button>

          <button
            onClick={() => handleInternalTabSwitch("pricing")}
            className={`flex items-center gap-2 px-4 py-3 rounded-t-lg border-b-2 transition-colors ${
              activeTab === "pricing"
                ? "border-indigo-600 text-indigo-600 bg-indigo-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span className="font-medium">Pricing & Profit</span>
          </button>

          <button
            onClick={() => handleInternalTabSwitch("settings")}
            className={`flex items-center gap-2 px-4 py-3 rounded-t-lg border-b-2 transition-colors ${
              activeTab === "settings"
                ? "border-indigo-600 text-indigo-600 bg-indigo-50"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Lock className="w-4 h-4" />
            <span className="font-medium">Settings</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* DASHBOARD VIEW */}
          {activeTab === "dashboard" && (
            <>
              {/* Date Filter */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">
                    From:
                  </span>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, start: e.target.value })
                    }
                    className="border p-2 rounded-lg text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">To:</span>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) =>
                      setDateRange({ ...dateRange, end: e.target.value })
                    }
                    className="border p-2 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                      <LayoutDashboard className="w-5 h-5" />
                    </div>
                    <span className="text-gray-500 text-sm font-medium">
                      Completed Orders
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {
                      filteredOrders.filter((o) => o.status === "completed")
                        .length
                    }
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-100 rounded-lg text-green-600">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <span className="text-gray-500 text-sm font-medium">
                      Total Sales
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    GH₵{totalSales.toFixed(2)}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-100 bg-indigo-50/50">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <span className="text-indigo-600 text-sm font-medium">
                      Total Commission
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-indigo-900">
                    GH₵{totalCommission.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Pending / Incomplete Payments */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b bg-yellow-50">
                  <h3 className="font-bold text-yellow-800 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    Incomplete / Pending Payments
                  </h3>
                </div>
                <div className="divide-y max-h-80 overflow-y-auto">
                  {orders.filter((o) =>
                    ["pending", "pending_payment"].includes(o.status),
                  ).length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No pending payments found
                    </div>
                  ) : (
                    orders
                      .filter((o) =>
                        ["pending", "pending_payment"].includes(o.status),
                      )
                      .map((order) => (
                        <div
                          key={order.id}
                          className="p-4 flex items-center justify-between hover:bg-gray-50"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-gray-700">
                                {order.network}
                              </span>
                              <span className="text-xs text-gray-500">
                                &bull;
                              </span>
                              <span className="text-sm">{order.bundle}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(order.timestamp).toLocaleString()}
                            </p>
                            <p className="text-xs font-mono text-gray-400 mt-0.5">
                              {order.recipientNumber}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="block font-bold text-gray-900">
                              {order.price}
                            </span>
                            <span className="text-xs text-yellow-600 font-medium bg-yellow-100 px-2 py-0.5 rounded-full">
                              Pending
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* ORDERS VIEW */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-xl shadow-lg p-4 border-2 border-gray-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-lg">{order.id}</span>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}
                    >
                      {["pending", "pending_payment"].includes(order.status)
                        ? "Pending Order"
                        : order.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Network</p>
                      <p className="font-semibold">{order.network}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Bundle</p>
                      <p className="font-semibold">{order.bundle}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Price</p>
                      <p className="font-semibold text-purple-600">
                        {order.price}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Recipient Number</p>
                      <p className="font-semibold">{order.recipientNumber}</p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs text-gray-500">
                      Customer Number (Payment)
                    </p>
                    <p className="font-semibold">{order.paymentNumber}</p>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs text-gray-500">Timestamp</p>
                    <p className="text-sm">{order.timestamp}</p>
                  </div>

                  <select
                    value={order.status}
                    onChange={(e) =>
                      onUpdateStatus(
                        order.id,
                        e.target.value as "pending" | "completed" | "failed",
                      )
                    }
                    className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:outline-none font-semibold mb-2"
                  >
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* PRICING & LOGIC VIEW */}
          {activeTab === "pricing" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b bg-gradient-to-r from-gray-50 to-blue-50/30">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                        <span className="text-2xl">💰</span>
                        Manage Prices & Profit
                      </h3>
                      <p className="text-sm text-gray-600 max-w-md">
                        Set the Cost Price (what you pay) and Selling Price (what
                        customers see). Your profit is calculated automatically.
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {hasUnsavedChanges && (
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg animate-pulse">
                          <span className="text-lg">⚠️</span>
                          <span className="font-medium">Unsaved changes</span>
                        </div>
                      )}
                      <button
                        onClick={savePricingChanges}
                        disabled={!hasUnsavedChanges}
                        className={`relative px-8 py-3 rounded-xl font-bold text-sm transition-all duration-200 transform ${
                          hasUnsavedChanges
                            ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 hover:scale-105 shadow-lg hover:shadow-xl active:scale-95"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">💾</span>
                          <span>Save All Changes</span>
                          {hasUnsavedChanges && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className="p-6 space-y-8">
                    {networks.map((net) => (
                      <div
                        key={net.id}
                        className="border rounded-xl overflow-hidden"
                      >
                        <div className="bg-gray-50 p-4 border-b flex items-center gap-3">
                          <img
                            src={net.logo}
                            className="w-8 h-8 rounded-full border bg-white"
                            alt={net.name}
                          />
                          <h4 className="font-bold text-lg text-gray-800">
                            {net.name}
                          </h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-white text-gray-500 font-medium border-b">
                              <tr>
                                <th className="p-4 w-1/4">Bundle Size</th>
                                <th className="p-4 w-1/4">Cost Price (GH₵)</th>
                                <th className="p-4 w-1/4">
                                  Selling Price (GH₵)
                                </th>
                                <th className="p-4 w-1/4 text-right">Profit</th>
                                <th className="p-4 w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y bg-white">
                              {(bundles[net.id] || []).map((bundle) => {
                                const currentSelling = parseFloat(
                                  bundle.price.replace("GH₵", ""),
                                );
                                const currentCost =
                                  costPrices[bundle.id] ||
                                  currentSelling * 0.85; // Default display 85%
                                const profit = currentSelling - currentCost;

                                return (
                                  <tr
                                    key={bundle.id}
                                    className="hover:bg-gray-50 transition-colors"
                                  >
                                    <td className="p-4 font-bold text-gray-700">
                                      {bundle.data}
                                    </td>
                                    <td className="p-4">
                                      <div className="flex items-center gap-1">
                                        <span className="text-gray-400 font-medium">
                                          GH₵
                                        </span>
                                        <input
                                          type="number"
                                          step="0.1"
                                          value={currentCost} // controlled component need logic to avoid NaN if empty
                                          onChange={(e) => {
                                            const val = parseFloat(
                                              e.target.value,
                                            );
                                            setCostPrices((prev) => ({
                                              ...prev,
                                              [bundle.id]: isNaN(val) ? 0 : val,
                                            }));
                                          }}
                                          className="w-24 p-2 border border-gray-200 rounded-lg font-mono focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                                        />
                                      </div>
                                    </td>
                                    <td className="p-4">
                                      <div className="flex items-center gap-1">
                                        <span className="text-gray-400 font-medium">
                                          GH₵
                                        </span>
                                        <input
                                          type="number"
                                          step="0.1"
                                          value={currentSelling}
                                          onChange={(e) => {
                                            const val = parseFloat(
                                              e.target.value,
                                            );
                                            const newPrice = isNaN(val)
                                              ? 0
                                              : val;
                                            const newBundles = { ...bundles };
                                            newBundles[net.id] = newBundles[
                                              net.id
                                            ].map((b) =>
                                              b.id === bundle.id
                                                ? {
                                                    ...b,
                                                    price: `GH₵${newPrice}`,
                                                  }
                                                : b,
                                            );
                                            setBundles(newBundles);
                                          }}
                                          className="w-24 p-2 border border-blue-200 bg-blue-50/50 rounded-lg font-mono font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        />
                                      </div>
                                    </td>
                                    <td className="p-4 text-right">
                                      <div className="flex flex-col items-end">
                                        <span
                                          className={`font-bold text-lg ${profit >= 0 ? "text-green-600" : "text-red-500"}`}
                                        >
                                          GH₵{profit.toFixed(2)}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                          Margin:{" "}
                                          {currentSelling > 0
                                            ? (
                                                (profit / currentSelling) *
                                                100
                                              ).toFixed(1)
                                            : 0}
                                          %
                                        </span>
                                      </div>
                                    </td>
                                    <td className="p-4">
                                      <button
                                        onClick={() =>
                                          handleDeleteBundle(net.id, bundle.id)
                                        }
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Bundle"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                              {/* Add New Bundle Row */}
                              <tr className="bg-gray-50/50 border-t-2 border-dashed">
                                <td className="p-4">
                                  <input
                                    type="text"
                                    placeholder="e.g. 100GB"
                                    className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500"
                                    value={newBundleInputs[net.id]?.data || ""}
                                    onChange={(e) =>
                                      setNewBundleInputs((prev) => ({
                                        ...prev,
                                        [net.id]: {
                                          ...(prev[net.id] || {}),
                                          data: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-400 text-xs">
                                      GH₵
                                    </span>
                                    <input
                                      type="number"
                                      step="0.1"
                                      placeholder="Cost"
                                      className="w-24 p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500"
                                      value={
                                        newBundleInputs[net.id]?.cost || ""
                                      }
                                      onChange={(e) =>
                                        setNewBundleInputs((prev) => ({
                                          ...prev,
                                          [net.id]: {
                                            ...(prev[net.id] || {}),
                                            cost: e.target.value,
                                          },
                                        }))
                                      }
                                    />
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-400 text-xs">
                                      GH₵
                                    </span>
                                    <input
                                      type="number"
                                      step="0.1"
                                      placeholder="Price"
                                      className="w-24 p-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500"
                                      value={
                                        newBundleInputs[net.id]?.price || ""
                                      }
                                      onChange={(e) =>
                                        setNewBundleInputs((prev) => ({
                                          ...prev,
                                          [net.id]: {
                                            ...(prev[net.id] || {}),
                                            price: e.target.value,
                                          },
                                        }))
                                      }
                                    />
                                  </div>
                                </td>
                                <td className="p-4 text-right" colSpan={2}>
                                  <button
                                    onClick={() => handleAddBundle(net.id)}
                                    disabled={
                                      !newBundleInputs[net.id]?.data ||
                                      !newBundleInputs[net.id]?.price
                                    }
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed mx-auto"
                                  >
                                    <Plus className="w-4 h-4" />
                                    Add
                                  </button>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS VIEW */}
          {activeTab === "settings" && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-purple-600" />
                Change Password
              </h3>
              <form
                onSubmit={handleUpdatePassword}
                className="space-y-4 max-w-md"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full p-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full p-3 border border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newPassword || !confirmPassword}
                  className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition disabled:opacity-50"
                >
                  Update Password
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
