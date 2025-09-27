import { useState, useEffect } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { adminProducts } from "../../services/adminApi";
import type {
  Product,
  CreateProductRequest,
  ApiError,
} from "../../types/admin";

interface CreateProductForm {
  name: string;
  description: string;
  price: string;
  fileName: string;
  filePath: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<CreateProductForm>({
    name: "",
    description: "",
    price: "",
    fileName: "",
    filePath: "",
  });
  const [formLoading, setFormLoading] = useState(false);

  // SEARCH
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await adminProducts.getAll();
      setProducts(response.products || []);
    } catch (err: unknown) {
      const error = err as ApiError;
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to load products"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      const productData: CreateProductRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        price: parseFloat(formData.price),
        fileName: formData.fileName.trim(),
        filePath: formData.filePath.trim(),
      };

      await adminProducts.create(productData);
      await loadProducts();
      resetForm();
      setShowCreateForm(false);
    } catch (err: unknown) {
      const error = err as ApiError;
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to create product"
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setFormLoading(true);

    try {
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        price: parseFloat(formData.price),
        fileName: formData.fileName.trim(),
        filePath: formData.filePath.trim(),
      };

      await adminProducts.update(editingProduct.id, productData);
      await loadProducts();
      resetForm();
      setEditingProduct(null);
    } catch (err: unknown) {
      const error = err as ApiError;
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to update product"
      );
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      await adminProducts.delete(productId);
      await loadProducts();
    } catch (err: unknown) {
      const error = err as ApiError;
      setError(
        error.response?.data?.message ||
          error.message ||
          "Failed to delete product"
      );
    }
  };

  const startEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      fileName: product.fileName,
      filePath: product.filePath,
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      fileName: "",
      filePath: "",
    });
    setEditingProduct(null);
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = showInactive || product.isActive;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Products Management
          </h1>
          <p className="text-gray-600">{products.length} total products</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadProducts} variant="secondary">
            Refresh
          </Button>
          <Button
            onClick={() => {
              resetForm();
              setShowCreateForm(true);
            }}
          >
            + Add Product
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <div className="text-red-600 bg-red-50 p-4 rounded border border-red-200">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-800 hover:text-red-900"
            >
              ✕
            </button>
          </div>
        </Card>
      )}

      {/* SEARCH */}
      <Card>
        <div className="flex gap-4 items-center">
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
        </div>
      </Card>

      {/* FORM  */}
      {showCreateForm && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {editingProduct ? "Edit Product" : "Create New Product"}
            </h3>
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateForm(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>

          <form
            onSubmit={
              editingProduct ? handleUpdateProduct : handleCreateProduct
            }
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Product Name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
              <Input
                label="Price (EUR)"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value })
                }
                required
              />
            </div>

            <Input
              label="Description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="File Name"
                value={formData.fileName}
                onChange={(e) =>
                  setFormData({ ...formData, fileName: e.target.value })
                }
                placeholder="product.pdf"
                required
              />
              <Input
                label="File Path"
                value={formData.filePath}
                onChange={(e) =>
                  setFormData({ ...formData, filePath: e.target.value })
                }
                placeholder="/uploads/products/product.pdf"
                required
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" loading={formLoading}>
                {formLoading
                  ? "Saving..."
                  : editingProduct
                  ? "Update Product"
                  : "Create Product"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* LISTA */}
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
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className="hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {product.description}
                    </p>
                  )}
                </div>
                <Badge variant={product.isActive ? "success" : "default"}>
                  {product.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Price:</span>
                  <span className="font-semibold text-gray-900">
                    {formatPrice(product.price)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>File:</span>
                  <span>{product.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span>{formatDate(product.createdAt)}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => startEditProduct(product)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => handleDeleteProduct(product.id)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {filteredProducts.length === 0 && !loading && (
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-500">
              {searchTerm
                ? "No products found matching your search."
                : "No products found."}
            </p>
            {!showCreateForm && (
              <Button
                className="mt-4"
                onClick={() => {
                  resetForm();
                  setShowCreateForm(true);
                }}
              >
                Create your first product
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
