import AdminLayout from "../../layout/AdminLayout";
import { useApp } from "../../context/AppContext";
import DashboardPage from "../../pages/admin/DashboardPage";
import OrdersPage from "../../pages/admin/OrdersPage";
import OrderDetailPage from "../../pages/admin/OrderDetailPage";
import UsersOnlinePage from "../../pages/admin/UsersOnlinePage";
import UserMapPage from "../../pages/admin/UserMapPage";

export default function AdminApp() {
  const { adminPage, navigateToAdminPage } = useApp();

  const renderPage = () => {
    switch (adminPage) {
      case "dashboard":
        return <DashboardPage />;
      case "orders":
        return <OrdersPage />;
      case "order-detail":
        return <OrderDetailPage />;
      case "users-online":
        return <UsersOnlinePage />;
      case "user-map":
        return <UserMapPage />;
      case "analytics":
        return <div>Analytics Page (Coming Soon)</div>;
      case "support":
        return <div>Support Page (Coming Soon)</div>;
      case "products":
        return <div>Products Page (Coming Soon)</div>;
      case "settings":
        return <div>Settings Page (Coming Soon)</div>;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <AdminLayout currentPage={adminPage} onNavigate={navigateToAdminPage}>
      {renderPage()}
    </AdminLayout>
  );
}
