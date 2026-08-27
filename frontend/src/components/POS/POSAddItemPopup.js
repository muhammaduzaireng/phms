import React, { useState, useEffect, useRef, useCallback } from 'react';
import './POSAddItemPopup.css';
import API_BASE_URL from '../../config/api';
import { cacheMedicineSearch, getCachedMedicineSearch } from '../../services/dataSync';

const uniquePOSProducts = (productsArray) => {
  const bestById = new Map();
  productsArray.forEach((p) => {
    const idKey = p.isCustom
      ? `CUST-${p.custom_product_id || p.id}`
      : `MED-${p.reg_number}`;
    const prev = bestById.get(idKey);
    const pQty = Number(p.stock_quantity) || 0;
    const prevQty = prev ? (Number(prev.stock_quantity) || 0) : -1;
    if (!prev || pQty > prevQty) {
      bestById.set(idKey, p);
    }
  });

  const bestByName = new Map();
  bestById.forEach((p) => {
    const nameKey = (p.product_name || p.name || '').trim().toLowerCase()
      || `id:${p.reg_number || p.id}`;
    const prev = bestByName.get(nameKey);
    const pQty = Number(p.stock_quantity) || 0;
    const prevQty = prev ? (Number(prev.stock_quantity) || 0) : -1;
    if (!prev || pQty > prevQty) {
      bestByName.set(nameKey, p);
    }
  });

  return Array.from(bestByName.values());
};

const productName = (p) => (p.product_name || p.name || '').trim();
const productGeneric = (p) => (p.generic_name || p.description || '').trim();

const matchRank = (product, query) => {
  const q = query.toLowerCase();
  const name = productName(product).toLowerCase();
  const generic = productGeneric(product).toLowerCase();
  const words = name.split(/[\s/,-]+/).filter(Boolean);

  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (words.some((word) => word.startsWith(q))) return 2;
  if (name.includes(q)) return 3;
  if (generic === q) return 4;
  if (generic.startsWith(q)) return 5;
  if (generic.includes(q)) return 6;
  return 7;
};

const sortBySearchRelevance = (productsArray, searchQuery) => {
  const q = (searchQuery || '').trim().toLowerCase();
  const list = Array.isArray(productsArray) ? [...productsArray] : [];
  return list.sort((a, b) => {
    if (q) {
      const rankA = matchRank(a, q);
      const rankB = matchRank(b, q);
      if (rankA !== rankB) return rankA - rankB;
    }
    return productName(a).localeCompare(productName(b), undefined, {
      numeric: true,
      sensitivity: 'base'
    });
  });
};

const POSAddItemPopup = ({ token, onAddToCart, onClose, searchTerm, onSearchTermChange }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [quantities, setQuantities] = useState({});
  const [justAdded, setJustAdded] = useState('');
  const searchInputRef = useRef(null);
  const qtyInputRefs = useRef({});
  const rowRefs = useRef({});

  const authToken = token || localStorage.getItem('pharmacyToken');

  useEffect(() => {
    searchInputRef.current?.focus();
    if (searchTerm) {
      const el = searchInputRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }
  }, []);

  const getQty = (product) => {
    const key = product.reg_number || product.id;
    const n = parseInt(quantities[key], 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  };

  const setQty = (product, value) => {
    const key = product.reg_number || product.id;
    setQuantities((prev) => ({ ...prev, [key]: value }));
  };

  const resetForNextItem = () => {
    onSearchTermChange('');
    setProducts([]);
    setSelectedIndex(0);
    setQuantities({});
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const addSelected = (product) => {
    if (!product) return;
    const qty = getQty(product);
    onAddToCart(product, qty);
    const name = product.product_name || product.name || 'Product';
    setJustAdded(`Added ${qty} × ${name}`);
    resetForNextItem();
  };

  const searchProducts = useCallback(async () => {
    const searchQuery = searchTerm.trim();
    if (searchQuery.length < 2 && !/^\d{4,}$/.test(searchQuery)) {
      setProducts([]);
      setLoading(false);
      return;
    }

    if (!authToken) {
      setProducts([]);
      return;
    }

    try {
      setLoading(true);

      if (!navigator.onLine) {
        const cached = getCachedMedicineSearch(searchQuery);
        setProducts(sortBySearchRelevance(cached ? uniquePOSProducts(cached) : [], searchQuery));
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      params.append('search', searchQuery);
      params.append('limit', '50');

      const response = await fetch(`${API_BASE_URL}/api/pos/products?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        const cached = getCachedMedicineSearch(searchQuery);
        setProducts(sortBySearchRelevance(cached ? uniquePOSProducts(cached) : [], searchQuery));
        setLoading(false);
        return;
      }

      const data = await response.json();
      const list = sortBySearchRelevance(
        uniquePOSProducts(Array.isArray(data.products) ? data.products : []),
        searchQuery
      );
      setProducts(list);
      setSelectedIndex(0);
      if (searchQuery.length > 0) {
        cacheMedicineSearch(searchQuery, list);
      }
    } catch (err) {
      const cached = getCachedMedicineSearch(searchQuery);
      setProducts(sortBySearchRelevance(cached ? uniquePOSProducts(cached) : [], searchQuery));
    } finally {
      setLoading(false);
    }
  }, [searchTerm, authToken]);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    const isBarcode = /^\d{4,}$/.test(trimmed);
    if (trimmed.length < 2 && !isBarcode) {
      setProducts([]);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      searchProducts();
    }, isBarcode ? 0 : 120);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchProducts]);

  useEffect(() => {
    const row = rowRefs.current[selectedIndex];
    if (row) {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (!justAdded) return undefined;
    const t = setTimeout(() => setJustAdded(''), 1800);
    return () => clearTimeout(t);
  }, [justAdded]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 2
    }).format(price || 0);
  };

  const stockLabel = (product) => {
    const qty = Number(product.stock_quantity);
    if (!Number.isFinite(qty) || qty <= 0) return { text: 'Out of stock', className: 'out' };
    return { text: String(qty), className: 'in' };
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (products.length === 0) return;
      setSelectedIndex((prev) => (prev < products.length - 1 ? prev + 1 : 0));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (products.length === 0) return;
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : products.length - 1));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (products.length === 0) return;
      const product = products[selectedIndex] || products[0];
      const qtyEl = qtyInputRefs.current[product.reg_number || product.id];
      if (qtyEl && document.activeElement !== qtyEl) {
        qtyEl.focus();
        qtyEl.select();
        return;
      }
      addSelected(product);
    }

    if (e.key === 'Tab' && products.length > 0) {
      const product = products[selectedIndex] || products[0];
      const qtyEl = qtyInputRefs.current[product.reg_number || product.id];
      if (qtyEl) {
        e.preventDefault();
        qtyEl.focus();
        qtyEl.select();
      }
    }
  };

  const handleQtyKeyDown = (e, product) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      searchInputRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      const next = products.length === 0
        ? 0
        : (selectedIndex + delta + products.length) % products.length;
      setSelectedIndex(next);
      const nextProduct = products[next];
      const nextQty = qtyInputRefs.current[nextProduct.reg_number || nextProduct.id];
      if (nextQty) {
        nextQty.focus();
        nextQty.select();
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      addSelected(product);
    }
  };

  return (
    <div className="add-item-overlay">
      <div className="add-item-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="add-item-header">
          <div>
            <h2>Add product to cart</h2>
            <p className="add-item-hint">
              Search → set quantity → <strong>Enter</strong> to add. Popup stays open for the next item. <strong>Esc</strong> closes.
            </p>
          </div>
          <button type="button" className="add-item-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {justAdded && <div className="add-item-toast">{justAdded}</div>}

        <div className="add-item-search-row">
          <label htmlFor="pos-add-item-search">Product</label>
          <input
            id="pos-add-item-search"
            ref={searchInputRef}
            type="text"
            className="add-item-search-input"
            placeholder="Type product name, generic, or barcode…"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            autoComplete="off"
          />
        </div>

        <div className="add-item-table-wrap">
          <table className="add-item-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Description</th>
                <th>Stock</th>
                <th>Price</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="5" className="add-item-empty">Searching…</td>
                </tr>
              )}
              {!loading && searchTerm.trim().length < 2 && (
                <tr>
                  <td colSpan="5" className="add-item-empty">
                    Type at least 2 characters to search
                  </td>
                </tr>
              )}
              {!loading && searchTerm.trim().length >= 2 && products.length === 0 && (
                <tr>
                  <td colSpan="5" className="add-item-empty">
                    No products found for “{searchTerm.trim()}”
                  </td>
                </tr>
              )}
              {!loading && products.map((product, index) => {
                const key = product.reg_number || product.id;
                const stock = stockLabel(product);
                const selected = index === selectedIndex;
                return (
                  <tr
                    key={key}
                    ref={(el) => { rowRefs.current[index] = el; }}
                    className={selected ? 'is-selected' : ''}
                    onClick={() => setSelectedIndex(index)}
                    onDoubleClick={() => addSelected(product)}
                  >
                    <td>
                      <div className="add-item-name">{product.product_name || product.name}</div>
                      <div className="add-item-meta">
                        {product.isCustom ? 'Custom' : (product.manufacturer || '')}
                      </div>
                    </td>
                    <td>{product.generic_name || product.description || '—'}</td>
                    <td>
                      <span className={`add-item-stock ${stock.className}`}>{stock.text}</span>
                    </td>
                    <td className="add-item-price">
                      {formatPrice(product.price_rs || product.price)}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        className="add-item-qty"
                        ref={(el) => { qtyInputRefs.current[key] = el; }}
                        value={quantities[key] ?? 1}
                        onChange={(e) => setQty(product, e.target.value)}
                        onFocus={() => setSelectedIndex(index)}
                        onKeyDown={(e) => handleQtyKeyDown(e, product)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="add-item-footer">
          <span>↑↓ select row · Tab quantity · Enter add to cart</span>
          <button
            type="button"
            className="add-item-submit"
            disabled={products.length === 0}
            onClick={() => addSelected(products[selectedIndex] || products[0])}
          >
            Add to cart ↵
          </button>
        </div>
      </div>
    </div>
  );
};

export default POSAddItemPopup;
