import { Button } from "../ui/Button";
import { useApp } from "../../context/AppContext";

export default function ModeSwitcher() {
  const { mode, switchToCustomer, switchToAdmin } = useApp();

  return (
    <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
      <div className="text-xs text-gray-500 mb-2 text-center">Demo Mode</div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={mode === "customer" ? "primary" : "secondary"}
          onClick={switchToCustomer}
        >
          🛒 Customer
        </Button>
        <Button
          size="sm"
          variant={mode === "admin" ? "primary" : "secondary"}
          onClick={switchToAdmin}
        >
          ⚙️ Admin
        </Button>
      </div>
    </div>
  );
}
