import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { type ReactNode } from "react";

// ===========================
//        STRIPE SETUP
// ===========================

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
    "pk_test_51S3G3rJN2Xt1bYo0XRWrrh33HAzV5g17GesA6l9mOpZpDBKyDF7dTbjSVayEHeRKXCd0qrzDE8IL3I819qKcJY8800JM5b2IzL"
);

interface StripeProviderProps {
  children: ReactNode;
}

export default function StripeProvider({ children }: StripeProviderProps) {
  return <Elements stripe={stripePromise}>{children}</Elements>;
}
