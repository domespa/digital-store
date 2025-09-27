import { useState } from "react";
import {
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from "@stripe/react-stripe-js";
import type {
  StripeCardNumberElement,
  StripeCardNumberElementChangeEvent,
} from "@stripe/stripe-js";
import { useCart } from "../hooks/useCart";

interface StripePaymentFormProps {
  clientSecret: string;
  customerEmail: string;
  customerName: string;
  onPaymentSuccess: (paymentIntent: any) => void;
  onPaymentError: (error: string) => void;
  onBack: () => void;
}

export default function StripePaymentForm({
  clientSecret,
  customerEmail,
  customerName,
  onPaymentSuccess,
  onPaymentError,
  onBack,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { getCartTotal, getDisplayCurrency } = useCart();

  const [isProcessing, setIsProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

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

  // STILE ELEMENTI STRIPE
  const elementOptions = {
    style: {
      base: {
        fontSize: "16px",
        color: "#424770",
        "::placeholder": {
          color: "#aab7c4",
        },
      },
      invalid: {
        color: "#9e2146",
      },
    },
  };

  // PROCESSA PAGAMENTO
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      onPaymentError("Stripe non è stato caricato correttamente");
      return;
    }

    // CORRETTO: Type assertion specifica per CardNumberElement
    const card = elements.getElement(
      CardNumberElement
    ) as StripeCardNumberElement | null;
    if (!card) {
      onPaymentError("Elemento carta non trovato");
      return;
    }

    setIsProcessing(true);
    setCardError(null);

    try {
      // CONFERMA PAGAMENTO CON CLIENT SECRET
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: card,
            billing_details: {
              name: customerName,
              email: customerEmail,
            },
          },
        }
      );

      if (error) {
        console.error("Payment failed:", error);
        const errorMessage = error.message || "Payment error";
        setCardError(errorMessage);
        onPaymentError(errorMessage);
      } else {
        console.log("Payment successful:", paymentIntent);
        onPaymentSuccess(paymentIntent);
      }
    } catch (error) {
      console.error("Payment error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknow error";
      setCardError(errorMessage);
      onPaymentError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Secure checkout 🔒
        </h3>
        <p className="text-sm text-gray-600">
          Enter your credit or debit card details
        </p>
      </div>

      {/* RIEPILOGO ORDINE */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="font-medium text-gray-900">Total amount:</span>
          <span className="text-xl font-bold text-purple-600">
            {formatPrice(getCartTotal())}
          </span>
        </div>
        <div className="text-sm text-gray-500 mt-1">
          Customer: {customerName} ({customerEmail})
        </div>
      </div>

      {/* ERRORI */}
      {cardError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-sm text-red-600">{cardError}</div>
        </div>
      )}

      {/* FORM PAGAMENTO */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* NUMERO CARTA */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card number
          </label>
          <div className="border border-gray-300 rounded-lg px-3 py-2 bg-white">
            <CardNumberElement
              options={elementOptions}
              onChange={(event: StripeCardNumberElementChangeEvent) =>
                setCardError(event.error?.message || null)
              }
            />
          </div>
        </div>

        {/* SCADENZA E CVC */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expiration date
            </label>
            <div className="border border-gray-300 rounded-lg px-3 py-2 bg-white">
              <CardExpiryElement options={elementOptions} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CVC
            </label>
            <div className="border border-gray-300 rounded-lg px-3 py-2 bg-white">
              <CardCvcElement options={elementOptions} />
            </div>
          </div>
        </div>

        {/* PULSANTI */}
        <div className="space-y-3 pt-4">
          <button
            type="submit"
            disabled={!stripe || isProcessing}
            className={`
              w-full py-3 px-4 rounded-lg font-semibold text-white 
              transition-all duration-200
              ${
                !stripe || isProcessing
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 hover:shadow-lg"
              }
            `}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Processing payment…
              </div>
            ) : (
              `Pay now ${formatPrice(getCartTotal())}`
            )}
          </button>

          <button
            type="button"
            onClick={onBack}
            disabled={isProcessing}
            className="w-full py-2 px-4 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors duration-200"
          >
            Back
          </button>
        </div>
      </form>

      {/* SICUREZZA */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          SSL-encrypted payment
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Your data is protected by Stripe
        </div>
      </div>
    </div>
  );
}
