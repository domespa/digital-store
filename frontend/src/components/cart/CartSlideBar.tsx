import { useCart } from "../../hooks/useCart";
import { useState } from "react";
import { useCheckout } from "../../hooks/useCheckout";
import StripePaymentForm from "../StripePaymentForm";
import type { CheckoutForm } from "../../types/checkout";

interface CartSlideBar {
  className?: string;
}

// STATI DEL CHECKOUT
type CheckoutStep = "cart" | "form" | "stripe" | "paypal" | "success";

export default function CartSlideBar({ className }: CartSlideBar = {}) {
  const {
    cart,
    removeItem,
    updateQuantity,
    toggleCart,
    clearCart,
    getCartTotal,
    getDisplayCurrency,
  } = useCart();

  const { processCheckoutData, isProcessing, error, clearError } =
    useCheckout();

  // STATI LOCALI
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>("cart");
  const [formData, setFormData] = useState<CheckoutForm>({
    customerEmail: "",
    customerFirstName: "",
    customerLastName: "",
    paymentProvider: "STRIPE",
  });

  // PER STRIPE
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(
    null
  );

  // PER SUCCESS
  const [successData, setSuccessData] = useState<{
    id?: string;
    orderId?: string;
    customerEmail?: string;
    total?: number;
    status?: string;
    paymentStatus?: string;
    orderItems?: Array<{
      id: string;
      quantity: number;
      price: number;
      productId: string;
      product: {
        id: string;
        name: string;
        description: string;
        fileName: string;
      } | null;
    }>;
  } | null>(null);

  // ===========================
  //        UTILITY FUNCTIONS
  // ===========================
  // FORMATO PREZZO
  const formatPrice = (amount: number): string => {
    const currency = getDisplayCurrency();
    const currencySymbols: Record<string, string> = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      AUD: "A$",
      CAD: "C$",
    };

    const symbol = currencySymbols[currency] || currency;
    return `${symbol}${amount.toFixed(2)}`;
  };

  // AVVIA CHECKOUT
  const handleCheckout = () => {
    if (cart.items.length === 0) return;
    clearError();
    setCheckoutStep("form");
  };

  // AGGIORNA FORM DATA
  const updateFormData = (field: keyof CheckoutForm, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // PROCESSA CHECKOUT
  const processCheckout = async () => {
    try {
      const result = await processCheckoutData(formData);

      if (result.success) {
        if (result.type === "stripe" && result.clientSecret) {
          // PROCEDI CON STRIPE ELEMENTS
          setStripeClientSecret(result.clientSecret);
          setCheckoutStep("stripe");
        } else if (result.type === "paypal_redirect") {
          // PAYPAL REDIRECT GIÀ GESTITO NEL HOOK
          setCheckoutStep("paypal");
        } else if (result.type === "completed") {
          // PAGAMENTO COMPLETATO
          if (result.order) {
            setSuccessData(result.order);
            setCheckoutStep("success");
          }
        }
      }
    } catch (error) {
      console.error("Checkout error:", error);
    }
  };

  // STRIPE PAYMENT SUCCESS
  const handleStripeSuccess = (paymentIntent: any) => {
    setSuccessData(paymentIntent);
    setCheckoutStep("success");
    clearCart();
  };

  // STRIPE PAYMENT ERROR
  const handleStripeError = (error: string) => {
    console.error("Stripe payment error:", error);
  };

  // RESET CHECKOUT
  const resetCheckout = () => {
    setCheckoutStep("cart");
    setStripeClientSecret(null);
    setSuccessData(null);
    clearError();
  };

  // CHIUDI CARRELLO
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      toggleCart();
      resetCheckout();
    }
  };

  if (!cart.isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 ${className || ""}`}>
      <div
        className="absolute inset-0 bg-black/30 transition-opacity"
        onClick={handleOverlayClick}
      />

      <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl transform transition-transform duration-300 ease-in-out">
        <div className="flex h-full flex-col">
          {/* HEADER */}
          <div className="flex items-center justify-between border-b border-gray-200 p-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {checkoutStep === "cart" && `Carrello (${cart.itemsCount})`}
                {checkoutStep === "form" && "Dati checkout"}
                {checkoutStep === "stripe" && "Pagamento"}
                {checkoutStep === "paypal" && "PayPal"}
                {checkoutStep === "success" && "Completato!"}
              </h2>

              {/* BREADCRUMB */}
              <div className="text-xs text-gray-500 mt-1">
                <span
                  className={checkoutStep === "cart" ? "text-purple-600" : ""}
                >
                  Carrello
                </span>
                <span className="mx-1">→</span>
                <span
                  className={checkoutStep === "form" ? "text-purple-600" : ""}
                >
                  Dati
                </span>
                <span className="mx-1">→</span>
                <span
                  className={
                    checkoutStep === "stripe" || checkoutStep === "paypal"
                      ? "text-purple-600"
                      : ""
                  }
                >
                  Pagamento
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                toggleCart();
                resetCheckout();
              }}
              className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* CONTENUTO DINAMICO */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* ERRORI GENERALI */}
            {error && checkoutStep !== "stripe" && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm text-red-600">{error}</div>
              </div>
            )}

            {/* STEP 1: CARRELLO */}
            {checkoutStep === "cart" && (
              <>
                {cart.isConverting && (
                  <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      Aggiornamento prezzi...
                    </div>
                  </div>
                )}

                {cart.items.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <svg
                        className="h-16 w-16 mx-auto"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 9M7 13l-1.5 9m0 0h9"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Il tuo carrello è vuoto
                    </h3>
                    <p className="text-gray-500 text-sm">
                      Aggiungi alcuni prodotti per iniziare
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex gap-4 p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <span className="text-2xl">
                              {item.image || "📖"}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 text-sm leading-tight">
                            {item.name}
                          </h3>

                          {item.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          )}

                          <div className="flex items-center justify-between mt-3">
                            <div className="font-semibold text-purple-600">
                              {formatPrice(item.displayPrice)}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  updateQuantity(item.id, item.quantity - 1)
                                }
                                className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                              >
                                -
                              </button>

                              <span className="w-8 text-center text-sm font-medium">
                                {item.quantity}
                              </span>

                              <button
                                onClick={() =>
                                  updateQuantity(item.id, item.quantity + 1)
                                }
                                className="w-8 h-8 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                              >
                                +
                              </button>

                              <button
                                onClick={() => removeItem(item.id)}
                                className="ml-2 p-1 text-red-400 hover:text-red-600"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* STEP 2: FORM DATI */}
            {checkoutStep === "form" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Dati per il checkout
                </h3>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome
                      </label>
                      <input
                        type="text"
                        value={formData.customerFirstName}
                        onChange={(e) =>
                          updateFormData("customerFirstName", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Nome"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cognome
                      </label>
                      <input
                        type="text"
                        value={formData.customerLastName}
                        onChange={(e) =>
                          updateFormData("customerLastName", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Cognome"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.customerEmail}
                      onChange={(e) =>
                        updateFormData("customerEmail", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="la-tua-email@esempio.com"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Metodo di pagamento
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateFormData("paymentProvider", "STRIPE")
                      }
                      className={`p-3 border rounded-lg text-sm font-medium transition-all ${
                        formData.paymentProvider === "STRIPE"
                          ? "border-purple-500 bg-purple-50 text-purple-700"
                          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      💳 Carta di credito
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateFormData("paymentProvider", "PAYPAL")
                      }
                      className={`p-3 border rounded-lg text-sm font-medium transition-all ${
                        formData.paymentProvider === "PAYPAL"
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      🅿️ PayPal
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-gray-200">
                  <span className="text-lg font-medium text-gray-900">
                    Totale
                  </span>
                  <span className="text-2xl font-bold text-purple-600">
                    {formatPrice(getCartTotal())}
                  </span>
                </div>
              </div>
            )}

            {/* STEP 3: STRIPE PAYMENT */}
            {checkoutStep === "stripe" && stripeClientSecret && (
              <StripePaymentForm
                clientSecret={stripeClientSecret}
                customerEmail={formData.customerEmail}
                customerName={`${formData.customerFirstName} ${formData.customerLastName}`}
                onPaymentSuccess={handleStripeSuccess}
                onPaymentError={handleStripeError}
                onBack={() => setCheckoutStep("form")}
              />
            )}

            {/* STEP 4: PAYPAL LOADING */}
            {checkoutStep === "paypal" && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Redirecting to PayPal...
                </h3>
                <p className="text-gray-500 text-sm">
                  Please wait while we redirect you to PayPal
                </p>
              </div>
            )}

            {/* STEP 5: SUCCESS */}
            {checkoutStep === "success" && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Pagamento completato!
                </h3>
                <p className="text-gray-600 mb-6">
                  Grazie per il tuo acquisto. Riceverai una email di conferma a
                  breve.
                </p>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="text-sm text-green-800">
                    <div>
                      <strong>Email:</strong> {formData.customerEmail}
                    </div>
                    <div>
                      <strong>Importo:</strong> {formatPrice(getCartTotal())}
                    </div>
                    {successData && (
                      <div>
                        <strong>ID Transazione:</strong>{" "}
                        {successData.id || successData.orderId}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    toggleCart();
                    resetCheckout();
                  }}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Chiudi
                </button>
              </div>
            )}
          </div>

          {/* FOOTER PULSANTI */}
          {(checkoutStep === "cart" || checkoutStep === "form") &&
            cart.items.length > 0 && (
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                {checkoutStep === "cart" && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-lg font-medium text-gray-900">
                        Totale
                      </span>
                      <span className="text-2xl font-bold text-purple-600">
                        {formatPrice(getCartTotal())}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <button
                        onClick={handleCheckout}
                        disabled={cart.isConverting}
                        className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200
                        ${
                          cart.isConverting
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-purple-600 hover:bg-purple-700 hover:shadow-lg"
                        }`}
                      >
                        {cart.isConverting
                          ? "Aggiornando prezzi..."
                          : `Checkout - ${formatPrice(getCartTotal())}`}
                      </button>

                      <button
                        onClick={clearCart}
                        className="w-full py-2 px-4 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors duration-200"
                      >
                        Svuota carrello
                      </button>
                    </div>
                  </>
                )}

                {checkoutStep === "form" && (
                  <div className="space-y-2">
                    <button
                      onClick={processCheckout}
                      disabled={
                        isProcessing ||
                        !formData.customerEmail ||
                        !formData.customerFirstName ||
                        !formData.customerLastName
                      }
                      className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all duration-200
                      ${
                        isProcessing ||
                        !formData.customerEmail ||
                        !formData.customerFirstName ||
                        !formData.customerLastName
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-purple-600 hover:bg-purple-700 hover:shadow-lg"
                      }`}
                    >
                      {isProcessing ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Elaborazione...
                        </div>
                      ) : (
                        `Continua - ${formatPrice(getCartTotal())}`
                      )}
                    </button>

                    <button
                      onClick={() => setCheckoutStep("cart")}
                      disabled={isProcessing}
                      className="w-full py-2 px-4 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors duration-200"
                    >
                      Indietro
                    </button>
                  </div>
                )}

                <div className="mt-4 text-center text-xs text-gray-500">
                  🔒 Pagamento sicuro • Download immediato • Garanzia 30 giorni
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
