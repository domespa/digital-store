import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAdminOrders } from "../../hooks/useAdminOrders";
import { useApp } from "../../context/AppContext";
import { useState } from "react";

export default function OrdersPage() {
  const { navigateToOrderDetail } = useApp();
  const {
    orders,
    loading,
    error,
    pagination,
    filters,
    updateFilters,
    changePage,
    refreshOrders,
  } = useAdminOrders();

  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchTerm, page: 1 });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PENDING":
        return "warning";
      case "PAID":
        return "info";
      case "COMPLETED":
        return "success";
      case "FAILED":
        return "danger";
      case "REFUNDED":
        return "info";
      default:
        return "default";
    }
  };

  const getPaymentStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PENDING":
        return "warning";
      case "SUCCEEDED":
        return "success";
      case "FAILED":
        return "danger";
      case "REFUNDED":
        return "info";
      default:
        return "default";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  if (error) {
    return (
      <Card>
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={refreshOrders}>Try again</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Orders Management
          </h1>
          <p className="text-gray-600">{pagination.total} total orders</p>
        </div>
        <Button onClick={refreshOrders} variant="secondary">
          🔄 Refresh
        </Button>
      </div>

      {/* Quick Search */}
      <Card>
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by email, name, or order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      {/* Orders Grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Order #{order.id.slice(-8)}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {order.customerFirstName} {order.customerLastName}
                  </p>
                  <p className="text-sm text-gray-500">{order.customerEmail}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {formatPrice(order.total)}
                  </div>
                  {order.paymentProvider && (
                    <div className="text-xs text-gray-500">
                      via {order.paymentProvider}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex space-x-2">
                  <Badge variant={getStatusBadgeVariant(order.status)}>
                    Status: {order.status}
                  </Badge>
                  <Badge
                    variant={getPaymentStatusBadgeVariant(order.paymentStatus)}
                  >
                    Payment: {order.paymentStatus}
                  </Badge>
                </div>
                <div className="text-sm text-gray-500">
                  {formatDate(order.createdAt)}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {order.orderItems.length} item
                    {order.orderItems.length !== 1 ? "s" : ""}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigateToOrderDetail(order.id)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              of {pagination.total} results
            </div>
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => changePage(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Previous
              </Button>
              <span className="px-3 py-1 text-sm text-gray-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => changePage(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      {orders.length === 0 && !loading && (
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-500">
              {filters.search
                ? "No orders found matching your search."
                : "No orders found."}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
