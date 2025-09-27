import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Input } from "../../components/ui/Input";
import { useOrderDetail } from "../../hooks/useOrderDetail";
import { useApp } from "../../context/AppContext";
import { useEffect, useState } from "react";
import type { UpdateOrderStatusRequest } from "../../types/admin";

export default function OrderDetailPage() {
  const { selectedOrderId, navigateBackToOrders } = useApp();
  const { order, loading, updating, error, updateOrderStatus } = useOrderDetail(
    selectedOrderId!
  );

  const [formData, setFormData] = useState<UpdateOrderStatusRequest>({
    status: order?.status || "",
    paymentStatus: order?.paymentStatus || "",
  });

  useEffect(() => {
    if (order) {
      setFormData({
        status: order.status,
        paymentStatus: order.paymentStatus,
      });
    }
  }, [order]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
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

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!order) return;

    const updateData: UpdateOrderStatusRequest = {};
    if (formData.status !== order.status) {
      updateData.status = formData.status;
    }
    if (formData.paymentStatus !== order.paymentStatus) {
      updateData.paymentStatus = formData.paymentStatus;
    }
    if (formData.stripePaymentIntentId) {
      updateData.stripePaymentIntentId = formData.stripePaymentIntentId;
    }
    if (formData.paypalOrderId) {
      updateData.paypalOrderId = formData.paypalOrderId;
    }

    if (Object.keys(updateData).length > 0) {
      await updateOrderStatus(updateData);
    }
  };

  const hasChanges =
    order &&
    (formData.status !== order.status ||
      formData.paymentStatus !== order.paymentStatus ||
      formData.stripePaymentIntentId ||
      formData.paypalOrderId);

  const statusOptions = [
    { value: "PENDING", label: "Pending" },
    { value: "PAID", label: "Paid" },
    { value: "COMPLETED", label: "Completed" },
    { value: "FAILED", label: "Failed" },
    { value: "REFUNDED", label: "Refunded" },
  ];

  const paymentStatusOptions = [
    { value: "PENDING", label: "Pending" },
    { value: "SUCCEEDED", label: "Succeeded" },
    { value: "FAILED", label: "Failed" },
    { value: "REFUNDED", label: "Refunded" },
  ];

  if (!selectedOrderId) {
    navigateBackToOrders();
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <Card>
        <div className="text-center py-8">
          <p className="text-red-600 mb-4">{error || "Order not found"}</p>
          <Button onClick={navigateBackToOrders} variant="secondary">
            Back to Orders
          </Button>
        </div>
      </Card>
    );
  }

  const totalItems = order.orderItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Button
              onClick={navigateBackToOrders}
              variant="secondary"
              size="sm"
            >
              ← Back to Orders
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">
              Order #{order.id.slice(-8)}
            </h1>
          </div>
          <p className="text-gray-600">Created {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={getStatusBadgeVariant(order.status)}>
            Status: {order.status}
          </Badge>
          <Badge variant={getPaymentStatusBadgeVariant(order.paymentStatus)}>
            Payment: {order.paymentStatus}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SEZIONE DI SINISTRA */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Customer Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Name:</span>
                <span className="text-sm text-gray-900">
                  {order.customerFirstName} {order.customerLastName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">
                  Email:
                </span>
                <span className="text-sm text-gray-900">
                  {order.customerEmail}
                </span>
              </div>
              {order.user && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">
                      Account:
                    </span>
                    <span className="text-sm text-gray-900">
                      Registered User
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">
                      User ID:
                    </span>
                    <span className="text-sm text-gray-500">
                      {order.user.id.slice(-8)}
                    </span>
                  </div>
                </>
              )}
              {!order.user && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">
                    Account:
                  </span>
                  <Badge variant="default">Guest Order</Badge>
                </div>
              )}
            </div>
          </Card>

          {/* Order Items */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Order Items ({totalItems} item{totalItems !== 1 ? "s" : ""})
            </h3>
            <div className="space-y-4">
              {order.orderItems.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">
                        {item.product?.name || "Product Not Found"}
                      </h4>
                      {item.product?.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {item.product.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm text-gray-500">
                          Product ID: {item.productId.slice(-8)}
                        </span>
                        {item.product?.fileName && (
                          <span className="text-sm text-gray-500">
                            File: {item.product.fileName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm text-gray-600">
                        {formatPrice(item.price)} × {item.quantity}
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formatPrice(item.price * item.quantity)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Total */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">
                  Order Total:
                </span>
                <span className="text-2xl font-bold text-gray-900">
                  {formatPrice(order.total)}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* SEZIONE DESTRA */}
        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Payment Information
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500 block">
                  Total Amount:
                </span>
                <div className="text-xl font-bold text-gray-900">
                  {formatPrice(order.total)}
                </div>
              </div>

              {order.paymentProvider && (
                <div>
                  <span className="text-sm font-medium text-gray-500 block">
                    Payment Method:
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="info">{order.paymentProvider}</Badge>
                  </div>
                </div>
              )}

              <div>
                <span className="text-sm font-medium text-gray-500 block">
                  Payment Status:
                </span>
                <div className="mt-1">
                  <Badge
                    variant={getPaymentStatusBadgeVariant(order.paymentStatus)}
                  >
                    {order.paymentStatus}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Update Order Status
            </h3>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleStatusUpdate} className="space-y-4">
              <Select
                label="Order Status"
                options={statusOptions}
                value={formData.status || ""}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
              />

              <Select
                label="Payment Status"
                options={paymentStatusOptions}
                value={formData.paymentStatus || ""}
                onChange={(e) =>
                  setFormData({ ...formData, paymentStatus: e.target.value })
                }
              />

              <Input
                label="Stripe Payment Intent ID"
                placeholder="pi_..."
                value={formData.stripePaymentIntentId || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stripePaymentIntentId: e.target.value,
                  })
                }
              />

              <Input
                label="PayPal Order ID"
                placeholder="PayPal order ID"
                value={formData.paypalOrderId || ""}
                onChange={(e) =>
                  setFormData({ ...formData, paypalOrderId: e.target.value })
                }
              />

              {hasChanges && (
                <div className="flex gap-2 pt-2">
                  <Button type="submit" loading={updating} className="flex-1">
                    {updating ? "Updating..." : "Update Order"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setFormData({
                        status: order.status,
                        paymentStatus: order.paymentStatus,
                      })
                    }
                  >
                    Reset
                  </Button>
                </div>
              )}
            </form>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Order Timeline
            </h3>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-3 flex-shrink-0"></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    Order Created
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDate(order.createdAt)}
                  </div>
                </div>
              </div>

              {order.updatedAt !== order.createdAt && (
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      Last Updated
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(order.updatedAt)}
                    </div>
                  </div>
                </div>
              )}

              {order.paymentStatus === "PAID" && (
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      Payment Completed
                    </div>
                    <div className="text-xs text-gray-500">
                      via {order.paymentProvider || "Unknown"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* AZIONI */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() =>
                  window.open(`mailto:${order.customerEmail}`, "_blank")
                }
              >
                📧 Contact Customer
              </Button>

              {order.user && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    console.log("Navigate to user:", order.user?.id);
                  }}
                >
                  👤 View Customer Profile
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => {
                  window.print();
                }}
              >
                🖨️ Print Order
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
