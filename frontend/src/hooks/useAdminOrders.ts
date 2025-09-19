import { useState, useEffect } from "react";
import { adminOrders } from "../services/adminApi";
import type {
  AdminOrderResponse,
  OrderFilters,
  OrderListResponse,
} from "../types/admin";

export function useAdminOrders(initialFilters: OrderFilters = {}) {
  const [orders, setOrders] = useState<AdminOrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalPages: 1,
    total: 0,
  });
  const [filters, setFilters] = useState<OrderFilters>(initialFilters);

  const fetchOrders = async (newFilters?: OrderFilters) => {
    try {
      setLoading(true);
      setError(null);

      const currentFilters = newFilters || filters;
      const response = await adminOrders.getAll(currentFilters);

      setOrders(response.orders);
      setPagination({
        ...response.pagination,
        total: response.total,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  const updateFilters = (newFilters: OrderFilters) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 };
    setFilters(updatedFilters);
    fetchOrders(updatedFilters);
  };

  const changePage = (page: number) => {
    const updatedFilters = { ...filters, page };
    setFilters(updatedFilters);
    fetchOrders(updatedFilters);
  };

  const refreshOrders = () => {
    fetchOrders();
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return {
    orders,
    loading,
    error,
    pagination,
    filters,
    updateFilters,
    changePage,
    refreshOrders,
  };
}
