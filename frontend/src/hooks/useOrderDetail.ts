import { useState, useEffect } from "react";
import { adminOrders } from "../services/adminApi";
import type {
  AdminOrderResponse,
  UpdateOrderStatusRequest,
} from "../types/admin";

export function useOrderDetail(orderId: string) {
  const [order, setOrder] = useState<AdminOrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminOrders.getById(orderId);
      setOrder(response.order);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch order");
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (updateData: UpdateOrderStatusRequest) => {
    try {
      setUpdating(true);
      setError(null);
      const response = await adminOrders.updateStatus(orderId, updateData);
      setOrder(response.order);
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update order");
      return false;
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  return {
    order,
    loading,
    updating,
    error,
    updateOrderStatus,
    refreshOrder: fetchOrder,
  };
}
