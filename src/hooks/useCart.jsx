"use client";

import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);

export function variantText(selection = []) {
  return selection
    .map((v) => `${v.name}: ${v.value}`)
    .join(" · ");
}

export function cartItemKey(productId, selection = []) {
  const ids = selection.map((v) => v.variant_id).sort().join("|");
  return `${productId}::${ids}`;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cart", JSON.stringify(items));
    }
  }, [items]);

  function addItem(product, quantity = 1, selection = []) {
    const adjustment = selection.reduce(
      (sum, v) => sum + Number(v.price_adjustment || 0),
      0,
    );
    const price = Number(product.price) + adjustment;
    const key = cartItemKey(product.id, selection);
    const text = variantText(selection);

    setItems((prev) => {
      const existing = prev.find((i) => i._key === key);
      if (existing) {
        return prev.map((i) =>
          i._key === key ? { ...i, quantity: i.quantity + quantity } : i,
        );
      }
      return [
        ...prev,
        {
          _key: key,
          product_id: product.id,
          product_name: product.name,
          price,
          base_price: Number(product.price),
          price_adjustment: adjustment,
          image_url: product.product_images?.[0]?.image_url || null,
          slug: product.slug,
          quantity,
          variant_text: text || null,
          variant_ids: selection.map((v) => v.variant_id),
        },
      ];
    });
  }

  function removeItem(key) {
    setItems((prev) => prev.filter((i) => i._key !== key));
  }

  function updateQuantity(key, quantity) {
    setItems((prev) =>
      prev.map((i) => (i._key === key ? { ...i, quantity } : i)),
    );
  }

  function clearCart() {
    setItems([]);
  }

  function openCart() {
    setIsOpen(true);
  }

  function closeCart() {
    setIsOpen(false);
  }

  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalAmount,
        itemCount,
        isOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
