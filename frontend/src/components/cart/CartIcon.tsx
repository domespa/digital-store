import { useCart } from "../../hooks/useCart";

interface CartIcon {
  className?: string;
}

export default function CartIcon({ className = "" }: CartIcon) {
  const { cart, toggleCart, getItemsCount } = useCart();

  const itemsCount = getItemsCount();

  return (
    <button
      onClick={toggleCart}
      className={`relative p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 ${className}`}
      aria-label={`Carrello con ${itemsCount} elementi`}
    >
      {/* ICONA CARRELLO */}
      <svg
        className="w-6 h-6 text-gray-700"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 9M7 13l-1.5 9m0 0h9"
        />
      </svg>

      {/* BADGE NUMERO */}
      {itemsCount > 0 && (
        <div className="absolute -top-2 -right-2 bg-purple-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 animate-pulse">
          {itemsCount > 99 ? "99+" : itemsCount}
        </div>
      )}

      {/* INDICATORE CONVERSIONE */}
      {cart.isConverting && (
        <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full w-3 h-3 animate-spin">
          <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
        </div>
      )}
    </button>
  );
}
