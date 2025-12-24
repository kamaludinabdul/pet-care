
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, setDoc, updateDoc, deleteDoc, doc, query, where, writeBatch, increment, getDoc, limit, orderBy } from 'firebase/firestore';


import { useAuth } from './AuthContext';
import { useStores } from './StoresContext';
import { normalizePermissions } from '../utils/permissions';
import { checkPlanLimit, PLAN_LIMITS } from '../utils/planLimits';


const POSContext = createContext(null);

export const POSProvider = ({ children }) => {
    const { user } = useAuth();
    // Use Stores Context for Store Data
    const {
        activeStoreId,
        currentStore
    } = useStores();

    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [customers, setCustomers] = useState([]);
    // const [stores, setStores] = useState([]); // Moved to StoresContext
    const [stockMovements, setStockMovements] = useState([]);
    const [salesTargets, setSalesTargets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastFetchError, setLastFetchError] = useState(null);

    // activeStoreId is now from useStores()
    // currentStore is now from useStores()

    const fetchStockMovements = useCallback(async () => {
        if (!activeStoreId) return;
        try {
            const q = query(collection(db, 'stock_movements'), where('storeId', '==', activeStoreId), limit(500));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const sorted = data.sort((a, b) => new Date(b.date) - new Date(a.date));
            setStockMovements(sorted);
        } catch (error) {
            console.error("Failed to fetch stock movements:", error);
        }
    }, [activeStoreId]);



    const fetchData = useCallback(async (shouldSetLoading = false) => {
        if (!user) {
            setLoading(false);
            return;
        }

        if (shouldSetLoading) setLoading(true);
        try {
            console.log("Fetching data for user:", user?.email, "Role:", user?.role, "StoreId:", user?.storeId);

            // Store Fetching Logic Removed (Handled by StoresContext)

            // 2. Fetch Operational Data
            // Only fetch operational data if we have an active store context
            console.log("Active Store ID:", activeStoreId);
            if (activeStoreId) {
                setLastFetchError(null);

                // Helper to safely fetch and log errors
                const safeFetch = async (name, queryFn, setterFn, processFn = (d) => d) => {
                    try {
                        const snapshot = await getDocs(queryFn);
                        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        const processed = processFn(data);
                        setterFn(processed);
                    } catch (e) {
                        console.error('Failed to fetch:', e);
                    }
                };

                await Promise.all([
                    // Categories
                    safeFetch('categories',
                        query(collection(db, 'categories'), where('storeId', '==', activeStoreId)),
                        setCategories
                    ),
                    // Products
                    safeFetch('products',
                        query(collection(db, 'products'), where('storeId', '==', activeStoreId), limit(2000)),
                        setProducts,
                        (data) => data.filter(p => !p.isDeleted)
                    ),
                    // Transactions - Reduced limit for performance
                    // Dashboard and Reports now fetch their own data.
                    // POS uses this for smart recommendations (recent 20 is sufficient for basic trends or can be refactored later)
                    safeFetch('transactions',
                        query(
                            collection(db, 'transactions'),
                            where('storeId', '==', activeStoreId),
                            orderBy('date', 'desc'),
                            limit(20)
                        ),
                        (data) => {
                            console.log("Fetched Transactions:", data.length);
                            setTransactions(data);
                        },
                        (data) => data.sort((a, b) => new Date(b.date) - new Date(a.date))
                    ),
                    // Customers
                    safeFetch('customers',
                        query(collection(db, 'customers'), where('storeId', '==', activeStoreId), limit(2000)),
                        setCustomers
                    ),

                    // Sales Targets
                    safeFetch('sales_targets',
                        query(collection(db, 'sales_targets'), where('storeId', '==', activeStoreId)),
                        setSalesTargets
                    )
                ]);

            } else {
                // Reset data if no store selected (e.g. Super Admin dashboard view)
                setCategories([]);
                setProducts([]);
                setTransactions([]);
                setCustomers([]);
                setStockMovements([]);
                setSalesTargets([]);
            }
        } catch (error) {
            console.error("Failed to fetch data from Firebase:", error);
            setLastFetchError(error.message);
        } finally {
            setLoading(false);
        }
    }, [user, activeStoreId]);

    useEffect(() => {
        fetchData(true);
    }, [fetchData]);


    // --- Operational Data Management ---

    const addCategory = async (categoryData) => {
        if (!activeStoreId) return { success: false, error: "No active store selected" };
        try {
            const name = typeof categoryData === 'string' ? categoryData : categoryData.name;
            const docRef = await addDoc(collection(db, 'categories'), { name, storeId: activeStoreId });
            // Optimistic update
            setCategories(prev => [...prev, { id: docRef.id, name, storeId: activeStoreId }]);
            return { success: true };
        } catch (error) {
            console.error("Error adding category:", error);
            return { success: false, error: error.message };
        }
    };

    const updateCategory = async (id, name) => {
        try {
            const catRef = doc(db, 'categories', id);
            await updateDoc(catRef, { name });
            // Optimistic update
            setCategories(prev => prev.map(cat => cat.id === id ? { ...cat, name } : cat));
        } catch (error) {
            console.error("Error updating category:", error);
        }
    };

    const deleteCategory = async (id) => {
        try {
            await deleteDoc(doc(db, 'categories', id));
            // Optimistic update
            setCategories(prev => prev.filter(cat => cat.id !== id));
        } catch (error) {
            console.error("Error deleting category:", error);
        }
    };

    const addProduct = async (product) => {
        if (!activeStoreId) return { success: false, error: "No active store" };
        try {
            const storePlan = currentStore?.plan || 'free';
            const limitCheck = checkPlanLimit(storePlan, 'products', products.length);

            if (!limitCheck.allowed) {
                return {
                    success: false,
                    error: 'Plan limit reached.Upgrade to add more products. (Limit: ' + limitCheck.limit + ')'
                };
            }

            // Check for duplicate barcode
            if (product.barcode) {
                const isDuplicate = products.some(p => p.barcode === product.barcode && p.storeId === activeStoreId && !p.isDeleted);
                if (isDuplicate) {
                    return {
                        success: false,
                        error: 'Barcode \'' + product.barcode + '\' sudah digunakan oleh produk lain.'
                    };
                }
            }

            const batch = writeBatch(db);

            // Add product
            const productRef = doc(collection(db, 'products'));
            batch.set(productRef, { ...product, storeId: activeStoreId });

            // If product has initial stock, create batch and movement
            if (product.stock && product.stock > 0) {
                // Create stock movement
                const movementRef = doc(collection(db, 'stock_movements'));
                batch.set(movementRef, {
                    storeId: activeStoreId,
                    productId: productRef.id,
                    type: 'in',
                    qty: product.stock,
                    date: new Date().toISOString(),
                    note: 'Initial Stock',
                    refId: productRef.id
                });

                // Create FIFO batch
                const batchRef = doc(collection(db, 'batches'));
                batch.set(batchRef, {
                    storeId: activeStoreId,
                    productId: productRef.id,
                    initialQty: product.stock,
                    currentQty: product.stock,
                    buyPrice: product.buyPrice || 0,
                    date: new Date().toISOString(),
                    note: 'Initial Stock'
                });
            }

            await batch.commit();

            // Optimistic update for product list
            const newProduct = { id: productRef.id, ...product, storeId: activeStoreId };
            setProducts(prev => [...prev, newProduct]);

            // If stock movement was created, we should ideally add it to movements state too
            // But for now, just updating product list is the priority to save quota

            return { success: true };
        } catch (error) {
            console.error("Error adding product:", error);
            return { success: false, error };
        }
    };

    const updateProduct = async (id, data) => {
        try {
            // Exclude stock from direct updates to maintain FIFO consistency
            // Stock should only be modified via addStockBatch or reduceStockFIFO
            const { stock: _stock, ...updateData } = data;

            // Check for duplicate barcode
            if (updateData.barcode) {
                const isDuplicate = products.some(p => p.barcode === updateData.barcode && p.id !== id && p.storeId === activeStoreId && !p.isDeleted);
                if (isDuplicate) {
                    return {
                        success: false,
                        error: 'Barcode \'' + updateData.barcode + '\' sudah digunakan oleh produk lain.'
                    };
                }
            }

            const prodRef = doc(db, 'products', id);
            await updateDoc(prodRef, updateData);

            // Optimistic update
            setProducts(prev => prev.map(prod => prod.id === id ? { ...prod, ...updateData } : prod));

            return { success: true };
        } catch (error) {
            console.error("Error updating product:", error);
            return { success: false, error };
        }
    };

    const deleteProduct = async (id) => {
        try {
            const prodRef = doc(db, 'products', id);
            await updateDoc(prodRef, {
                isDeleted: true,
                deletedAt: new Date().toISOString()
            });
            // Optimistic update
            setProducts(prev => prev.filter(prod => prod.id !== id));
            return { success: true };
        } catch (error) {
            console.error("Error deleting product:", error);
            return { success: false, error };
        }
    };

    const addTransaction = async (transaction) => {
        if (!activeStoreId) return;
        try {
            await addDoc(collection(db, 'transactions'), {
                ...transaction,
                storeId: activeStoreId,
                date: new Date().toISOString()
            });
            fetchData();
            return { success: true };
        } catch (error) {
            console.error("Error adding transaction:", error);
            return { success: false, error };
        }
    };

    const processRefund = async (transactionId, reason) => {
        if (!activeStoreId) return;
        try {
            const batch = writeBatch(db);
            const transactionRef = doc(db, 'transactions', transactionId);
            const transactionDoc = await getDoc(transactionRef);

            if (!transactionDoc.exists()) {
                throw new Error("Transaksi tidak ditemukan");
            }

            const transactionData = transactionDoc.data();

            if (transactionData.status === 'refunded') {
                throw new Error("Transaksi sudah di-refund sebelumnya");
            }

            // 1. Mark Transaction as Refunded
            batch.update(transactionRef, {
                status: 'refunded',
                refundReason: reason,
                refundDate: new Date().toISOString(),
                refundBy: user.name
            });

            // 2. Reverse Stock (Add back to stock)
            for (const item of transactionData.items) {
                const product = products.find(p => p.id === item.id);
                const isService = item.type === 'service' || product?.type === 'service';

                if (isService) continue;

                const productRef = doc(db, 'products', item.id);
                batch.update(productRef, { stock: increment(item.qty) });

                // Add 'refund' movement
                const movementRef = doc(collection(db, 'stock_movements'));
                batch.set(movementRef, {
                    storeId: activeStoreId,
                    productId: item.id,
                    type: 'in', // Stock comes back
                    qty: item.qty,
                    date: new Date().toISOString(),
                    note: 'Refund Transaksi #' + transactionId.slice(-6),
                    refId: transactionId
                });
            }

            // 3. Reverse Customer Data (if applicable)
            if (transactionData.customerId) {
                const customerRef = doc(db, 'customers', transactionData.customerId);
                const customerDoc = await getDoc(customerRef);

                if (customerDoc.exists()) {
                    const updates = {
                        totalSpent: increment(-transactionData.total),
                        points: increment(-(transactionData.pointsEarned || 0))
                    };

                    if (transactionData.paymentMethod === 'debt') {
                        updates.debt = increment(-transactionData.total);
                    }

                    batch.update(customerRef, updates);
                }
            }

            await batch.commit();

            // Optimistic Updates
            setTransactions(prev => prev.map(t =>
                t.id === transactionId ? { ...t, status: 'refunded', refundReason: reason } : t
            ));

            setProducts(prev => prev.map(p => {
                const item = transactionData.items.find(i => i.id === p.id);
                if (item && p.type !== 'service') {
                    return { ...p, stock: (p.stock || 0) + item.qty };
                }
                return p;
            }));

            return { success: true };
        } catch (error) {
            console.error("Error processing refund:", error);
            return { success: false, error };
        }
    };

    // --- Customer Management ---

    const addCustomer = async (customerData) => {
        if (!activeStoreId) {
            return { success: false, error: "No active store selected" };
        }

        // Phone number is mandatory for ID
        const customerId = customerData.phone ? customerData.phone.replace(/[^0-9]/g, '') : '';

        if (!customerId) {
            return { success: false, error: "Nomor HP wajib diisi sebagai ID." };
        }

        try {
            const custRef = doc(db, 'customers', customerId);
            const custSnap = await getDoc(custRef);

            if (custSnap.exists()) {
                return { success: false, error: "Pelanggan dengan nomor HP ini sudah terdaftar." };
            }

            const newCustomer = {
                id: customerId,
                ...customerData,
                storeId: activeStoreId,
                createdAt: new Date().toISOString(),
                totalSpent: 0,
                debt: 0,
                loyaltyPoints: 0,
                totalLifetimePoints: 0 // Track total points earned from transactions (never decreases)
            };

            await setDoc(custRef, newCustomer);

            // Optimistic update
            // Optimistic update (prevent duplicates)
            setCustomers(prev => {
                if (prev.some(c => c.id === newCustomer.id)) {
                    return prev.map(c => c.id === newCustomer.id ? newCustomer : c);
                }
                return [...prev, newCustomer];
            });

            return { success: true };
        } catch (error) {
            console.error("Error adding customer:", error);
            return { success: false, error: error.message };
        }
    };

    const updateCustomer = async (id, data) => {
        try {
            const custRef = doc(db, 'customers', id);
            await updateDoc(custRef, data);

            // Optimistic update
            setCustomers(prev => prev.map(cust => cust.id === id ? { ...cust, ...data } : cust));

            return { success: true };
        } catch (error) {
            console.error("Error updating customer:", error);
            return { success: false, error };
        }
    };

    const deleteCustomer = async (id) => {
        try {
            await deleteDoc(doc(db, 'customers', id));
            // Optimistic update
            setCustomers(prev => prev.filter(cust => cust.id !== id));
            return { success: true };
        } catch (error) {
            console.error("Error deleting customer:", error);
            return { success: false, error };
        }
    };

    // --- Loyalty Points Management ---

    /**
     * Adjust customer points manually (add or deduct)
     * @param {string} customerId - Customer ID
     * @param {number} amount - Amount to adjust (positive for addition, negative for deduction)
     * @param {string} reason - Reason for adjustment
     * @param {string} type - Type: 'addition', 'deduction', or 'expiry_reset'
     */
    const adjustCustomerPoints = async (customerId, amount, reason, type = 'deduction') => {
        if (!activeStoreId || !user) {
            return { success: false, error: 'No active store or user' };
        }

        // Only admins can adjust points
        if (user.role !== 'admin' && user.role !== 'super_admin') {
            return { success: false, error: 'Insufficient permissions' };
        }

        if (amount === 0) {
            return { success: false, error: 'Amount cannot be zero' };
        }

        if (!reason || reason.trim() === '') {
            return { success: false, error: 'Reason is required' };
        }

        try {
            // Get current customer data
            const customerRef = doc(db, 'customers', customerId);
            const customerSnap = await getDoc(customerRef);

            if (!customerSnap.exists()) {
                return { success: false, error: 'Customer not found' };
            }

            const customerData = customerSnap.data();
            const previousBalance = customerData.loyaltyPoints || customerData.points || 0;
            const newBalance = Math.max(0, previousBalance + amount); // Prevent negative points

            // Update customer points - update BOTH fields for backward compatibility
            await updateDoc(customerRef, {
                loyaltyPoints: newBalance,
                points: newBalance // Also update old field for backward compatibility
            });

            // Create adjustment record
            await addDoc(collection(db, 'point_adjustments'), {
                customerId,
                customerName: customerData.name,
                storeId: activeStoreId,
                type,
                amount,
                reason: reason.trim(),
                performedBy: user.id || 'unknown',
                performedByName: user.name || user.email || 'Unknown',
                date: new Date().toISOString(),
                previousBalance,
                newBalance
            });

            // Optimistic update - update both fields
            setCustomers(prev => prev.map(cust =>
                cust.id === customerId
                    ? { ...cust, loyaltyPoints: newBalance, points: newBalance }
                    : cust
            ));

            return { success: true, newBalance };
        } catch (error) {
            console.error("Error adjusting customer points:", error);
            return { success: false, error };
        }
    };

    /**
     * Get point adjustment history for a customer
     * @param {string} customerId - Customer ID
     * @param {number} limitCount - Number of records to fetch (default 100)
     */
    const getPointAdjustmentHistory = async (customerId, limitCount = 100) => {
        if (!activeStoreId) {
            return { success: false, error: 'No active store', data: [] };
        }

        try {
            const q = query(
                collection(db, 'point_adjustments'),
                where('customerId', '==', customerId),
                where('storeId', '==', activeStoreId),
                orderBy('date', 'desc'),
                limit(limitCount)
            );

            const snapshot = await getDocs(q);
            const history = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            return { success: true, data: history };
        } catch (error) {
            console.error("Error fetching point adjustment history:", error);
            return { success: false, error, data: [] };
        }
    };

    /**
     * Check and reset expired points if expiry date has passed
     */
    const checkAndResetExpiredPoints = async () => {
        if (!activeStoreId || !currentStore) {
            return { success: false, error: 'No active store' };
        }

        const loyaltySettings = currentStore.loyaltySettings || {};

        if (!loyaltySettings.expiryEnabled || !loyaltySettings.expiryDate) {
            return { success: false, error: 'Point expiry not enabled' };
        }

        const expiryDate = new Date(loyaltySettings.expiryDate);
        const now = new Date();

        // Check if expiry date has passed
        if (now < expiryDate) {
            return { success: false, error: 'Expiry date not reached yet' };
        }

        try {
            // Get all customers with points
            const customersWithPoints = customers.filter(c =>
                c.storeId === activeStoreId && (c.loyaltyPoints || 0) > 0
            );

            if (customersWithPoints.length === 0) {
                return { success: true, message: 'No customers with points to reset' };
            }

            // Batch update
            const batch = writeBatch(db);
            const adjustments = [];

            for (const customer of customersWithPoints) {
                const customerRef = doc(db, 'customers', customer.id);
                const previousBalance = customer.loyaltyPoints || 0;

                // Reset points to 0
                batch.update(customerRef, { loyaltyPoints: 0 });

                // Create adjustment record
                const adjustmentRef = doc(collection(db, 'point_adjustments'));
                batch.set(adjustmentRef, {
                    customerId: customer.id,
                    customerName: customer.name,
                    storeId: activeStoreId,
                    type: 'expiry_reset',
                    amount: -previousBalance,
                    reason: `Automatic reset - Points expired on ${expiryDate.toLocaleDateString()}`,
                    performedBy: 'system',
                    performedByName: 'System (Auto-Expiry)',
                    date: new Date().toISOString(),
                    previousBalance,
                    newBalance: 0
                });

                adjustments.push({
                    customerId: customer.id,
                    customerName: customer.name,
                    previousBalance
                });
            }

            // Update store settings with last reset date
            const storeRef = doc(db, 'stores', activeStoreId);
            batch.update(storeRef, {
                'loyaltySettings.lastResetDate': new Date().toISOString()
            });

            await batch.commit();

            // Refresh data
            await fetchData();

            return {
                success: true,
                message: `Reset ${customersWithPoints.length} customers' points`,
                adjustments
            };
        } catch (error) {
            console.error("Error resetting expired points:", error);
            return { success: false, error };
        }
    };

    // --- Advanced Stock Management (FIFO) ---

    const addStockBatch = async (productId, qty, buyPrice, sellPrice, note = '') => {
        if (!activeStoreId) return;
        try {
            const batch = writeBatch(db);
            const batchRef = doc(collection(db, 'batches'));
            batch.set(batchRef, {
                storeId: activeStoreId,
                productId,
                initialQty: qty,
                currentQty: qty,
                buyPrice: Number(buyPrice),
                date: new Date().toISOString(),
                note
            });
            const movementRef = doc(collection(db, 'stock_movements'));
            batch.set(movementRef, {
                storeId: activeStoreId,
                productId,
                type: 'in',
                qty: qty,
                date: new Date().toISOString(),
                note: note || 'Stok Masuk (Batch)',
                refId: batchRef.id
            });
            const productRef = doc(db, 'products', productId);
            const productDoc = await getDocs(query(collection(db, 'products'), where('__name__', '==', productId)));
            if (!productDoc.empty) {
                const currentStock = parseInt(productDoc.docs[0].data().stock || 0);
                batch.update(productRef, {
                    stock: currentStock + qty,
                    buyPrice: Number(buyPrice),
                    sellPrice: Number(sellPrice),
                    price: Number(sellPrice)
                });
            }
            await batch.commit();

            // Optimistic update
            // 1. Update Product Stock
            setProducts(prev => prev.map(p => {
                if (p.id === productId) {
                    return {
                        ...p,
                        stock: (parseInt(p.stock) || 0) + qty,
                        buyPrice: Number(buyPrice),
                        sellPrice: Number(sellPrice),
                        price: Number(sellPrice)
                    };
                }
                return p;
            }));

            // 2. Add Stock Movement
            const newMovement = {
                id: movementRef.id,
                storeId: activeStoreId,
                productId: productId,
                type: 'in',
                qty: qty,
                date: new Date().toISOString(),
                note: note || 'Stok Masuk (Batch)',
                refId: batchRef.id
            };
            setStockMovements(prev => [newMovement, ...prev]);

            return { success: true };
        } catch (error) {
            console.error("Error adding stock batch:", error);
            return { success: false, error };
        }
    };

    const processSale = async (transactionData) => {
        if (!activeStoreId) {
            console.error("Process Sale Failed: No active store selected.");
            return { success: false, error: "No active store selected" };
        }
        try {
            // 1. Validate Stock (Server-Side Check)
            for (const item of transactionData.items) {
                // Skip validation for services
                if (item.type === 'service') continue;

                const productRef = doc(db, 'products', item.id);
                const productSnap = await getDoc(productRef);

                if (!productSnap.exists()) {
                    return { success: false, error: 'Produk \"' + item.name + '\" tidak ditemukan di database.' };
                }

                const currentStock = parseInt(productSnap.data().stock || 0);
                if (currentStock < item.qty) {
                    return {
                        success: false,
                        error: 'Stok tidak cukup untuk \"' + item.name + '\".Sisa: ' + currentStock + ', Diminta: ' + item.qty
                    };
                }
            }

            const batch = writeBatch(db);
            const itemsWithCOGS = [];
            for (const item of transactionData.items) {
                // Check type from item or lookup in products
                const product = products.find(p => p.id === item.id);
                const isService = item.type === 'service' || product?.type === 'service';

                // Skip stock updates for services
                if (isService) {
                    itemsWithCOGS.push({ ...item, buyPrice: 0 }); // Services have 0 COGS usually, or we can use item.buyPrice if set
                    continue;
                }

                let remainingQtyToDeduct = item.qty;
                let totalItemCOGS = 0;
                const batchSnapshot = await getDocs(query(collection(db, 'batches'), where('productId', '==', item.id)));
                let batches = batchSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                batches.sort((a, b) => new Date(a.date) - new Date(b.date));
                batches = batches.filter(b => b.currentQty > 0);
                for (const b of batches) {
                    if (remainingQtyToDeduct <= 0) break;
                    const deduct = Math.min(b.currentQty, remainingQtyToDeduct);
                    totalItemCOGS += (deduct * b.buyPrice);
                    const batchRef = doc(db, 'batches', b.id);
                    batch.update(batchRef, { currentQty: b.currentQty - deduct });
                    remainingQtyToDeduct -= deduct;
                }
                if (remainingQtyToDeduct > 0) {
                    const product = products.find(p => p.id === item.id);
                    const fallbackBuyPrice = product ? product.buyPrice : 0;
                    totalItemCOGS += (remainingQtyToDeduct * fallbackBuyPrice);
                }
                const productRef = doc(db, 'products', item.id);
                // Use increment for atomic update to prevent race conditions
                batch.update(productRef, { stock: increment(-item.qty) });
                const avgBuyPrice = totalItemCOGS / item.qty;
                itemsWithCOGS.push({
                    ...item,
                    buyPrice: avgBuyPrice
                });
            }
            const transRef = doc(collection(db, 'transactions'));
            batch.set(transRef, {
                ...transactionData,
                items: itemsWithCOGS,
                storeId: activeStoreId,
                date: new Date().toISOString()
            });
            itemsWithCOGS.forEach(item => {
                const movementRef = doc(collection(db, 'stock_movements'));
                batch.set(movementRef, {
                    storeId: activeStoreId,
                    productId: item.id,
                    type: 'sale',
                    qty: -item.qty,
                    date: new Date().toISOString(),
                    note: 'Penjualan #' + transRef.id.slice(-6),
                    refId: transRef.id
                });
            });

            // 4. Update Customer Data (Points, Total Spent, Debt)
            if (transactionData.customerId) {
                const customerRef = doc(db, 'customers', transactionData.customerId);
                const updates = {
                    totalSpent: increment(transactionData.total),
                    loyaltyPoints: increment(transactionData.pointsEarned || 0),
                    totalLifetimePoints: increment(transactionData.pointsEarned || 0),
                    points: increment(transactionData.pointsEarned || 0) // Legacy
                };
                if (transactionData.paymentMethod === 'debt') {
                    updates.debt = increment(transactionData.total);
                }
                batch.update(customerRef, updates);
            }

            await batch.commit();

            // Optimistic Updates

            // 1. Update Products Stock
            setProducts(prev => prev.map(p => {
                const soldItem = transactionData.items.find(item => item.id === p.id);
                if (soldItem) {
                    return { ...p, stock: p.stock - soldItem.qty };
                }
                return p;
            }));

            // 2. Add Transaction
            const newTransaction = {
                id: transRef.id,
                ...transactionData,
                items: itemsWithCOGS,
                storeId: activeStoreId,
                date: new Date().toISOString()
            };
            setTransactions(prev => [newTransaction, ...prev]);

            // 3. Add Stock Movements
            const newMovements = itemsWithCOGS.map(item => ({
                id: 'temp - ' + Date.now() + '-' + item.id, // Temporary ID until refresh
                storeId: activeStoreId,
                productId: item.id,
                type: 'sale',
                qty: -item.qty,
                date: new Date().toISOString(),
                note: 'Penjualan #' + transRef.id.slice(-6),
                refId: transRef.id
            }));
            setStockMovements(prev => [...newMovements, ...prev]);

            // 4. Update Customers Optimistically
            if (transactionData.customerId) {
                setCustomers(prev => prev.map(c => {
                    if (c.id === transactionData.customerId) {
                        const newDebt = transactionData.paymentMethod === 'debt'
                            ? (c.debt || 0) + transactionData.total
                            : (c.debt || 0);
                        return {
                            ...c,
                            totalSpent: (c.totalSpent || 0) + transactionData.total,
                            loyaltyPoints: (c.loyaltyPoints || 0) + (transactionData.pointsEarned || 0),
                            points: (c.points || 0) + (transactionData.pointsEarned || 0), // Legacy
                            debt: newDebt
                        };
                    }
                    return c;
                }));
            }

            return { success: true, transactionId: transRef.id };
        } catch (error) {
            console.error("Error processing sale:", error);
            return { success: false, error };
        }
    };

    const voidTransaction = async (transactionId, reason) => {
        if (!activeStoreId) return;
        try {
            const batch = writeBatch(db);
            const transactionRef = doc(db, 'transactions', transactionId);
            const transactionDoc = await getDoc(transactionRef);

            if (!transactionDoc.exists()) {
                throw new Error("Transaksi tidak ditemukan");
            }

            const transactionData = transactionDoc.data();

            if (transactionData.status === 'void') {
                throw new Error("Transaksi sudah dibatalkan sebelumnya");
            }

            // 1. Mark Transaction as Void
            batch.update(transactionRef, {
                status: 'void',
                voidReason: reason,
                voidedAt: new Date().toISOString(),
                voidBy: user.name
            });

            // 2. Restore Stock (FIFO Logic)
            // For simplicity in void, we just increment current stock.
            // Ideally we should restore exact batches, but that's complex.
            // We'll treat it as stock correction.
            for (const item of transactionData.items) {
                // Check type from item or lookup in products
                const product = products.find(p => p.id === item.id);
                const isService = item.type === 'service' || product?.type === 'service';

                if (isService) continue;

                const productRef = doc(db, 'products', item.id);
                // We use increment because other transactions might have happened
                batch.update(productRef, { stock: increment(item.qty) });

                // Record restoration movement
                const movementRef = doc(collection(db, 'stock_movements'));
                batch.set(movementRef, {
                    storeId: activeStoreId,
                    productId: item.id,
                    type: 'in', // Returned stock
                    qty: item.qty,
                    date: new Date().toISOString(),
                    note: `Void Transaksi #${transactionId.slice(-6)}`,
                    refId: transactionId
                });
            }

            // 3. Reverse Customer Data (if applicable)
            if (transactionData.customerId) {
                const customerRef = doc(db, 'customers', transactionData.customerId);
                const customerDoc = await getDoc(customerRef);

                if (customerDoc.exists()) {
                    const custData = customerDoc.data();
                    const updates = {
                        totalSpent: increment(-transactionData.total),
                        loyaltyPoints: increment(-(transactionData.pointsEarned || 0)),
                        totalLifetimePoints: increment(-(transactionData.pointsEarned || 0)),
                        points: increment(-(transactionData.pointsEarned || 0))
                    };

                    if (transactionData.paymentMethod === 'debt') {
                        updates.debt = increment(-transactionData.total);
                    }

                    batch.update(customerRef, updates);

                    // 4. Record Point Deduction History for Customer Dialog
                    if (transactionData.pointsEarned > 0) {
                        const adjustmentRef = doc(collection(db, 'point_adjustments'));
                        batch.set(adjustmentRef, {
                            storeId: activeStoreId,
                            customerId: transactionData.customerId,
                            type: 'deduction',
                            amount: -transactionData.pointsEarned,
                            reason: `Void Transaksi #${transactionId.slice(-6)}`,
                            performedBy: user.id || 'system',
                            performedByName: user.name || 'System',
                            date: new Date().toISOString()
                        });
                    }
                }
            }

            await batch.commit();

            // Optimistic Updates
            setTransactions(prev => prev.map(t =>
                t.id === transactionId ? { ...t, status: 'void', voidReason: reason } : t
            ));

            setProducts(prev => prev.map(p => {
                const item = transactionData.items.find(i => i.id === p.id);
                if (item && p.type !== 'service') {
                    return { ...p, stock: (p.stock || 0) + item.qty };
                }
                return p;
            }));

            if (transactionData.customerId) {
                setCustomers(prev => prev.map(c => {
                    if (c.id === transactionData.customerId) {
                        const updates = {
                            totalSpent: Math.max(0, (c.totalSpent || 0) - transactionData.total)
                        };

                        if (transactionData.pointsEarned > 0) {
                            const newPoints = Math.max(0, (c.loyaltyPoints || 0) - transactionData.pointsEarned);
                            updates.loyaltyPoints = newPoints;
                            updates.points = newPoints;
                        }
                        return { ...c, ...updates };
                    }
                    return c;
                }));
            }

            return { success: true };
        } catch (error) {
            console.error("Error voiding transaction:", error);
            return { success: false, error: error.message };
        }
    };



    const processDebtPayment = async (customerId, amount, paymentMethod) => {
        if (!activeStoreId) return;
        try {
            const batch = writeBatch(db);

            // 1. Create Transaction Record for Debt Payment
            const transRef = doc(collection(db, 'transactions'));
            const transactionData = {
                storeId: activeStoreId,
                customerId,
                type: 'debt_payment',
                total: amount,
                paymentMethod,
                date: new Date().toISOString(),
                status: 'completed',
                items: [] // No items for debt payment
            };
            batch.set(transRef, transactionData);

            // 2. Update Customer Debt
            const customerRef = doc(db, 'customers', customerId);
            batch.update(customerRef, {
                debt: increment(-amount)
            });

            await batch.commit();

            // Optimistic Updates
            setTransactions(prev => [{ id: transRef.id, ...transactionData }, ...prev]);
            setCustomers(prev => prev.map(c =>
                c.id === customerId ? { ...c, debt: (c.debt || 0) - amount } : c
            ));

            return { success: true };
        } catch (error) {
            console.error("Error processing debt payment:", error);
            return { success: false, error: error.message };
        }
    };

    const bulkAddProducts = async (newProducts) => {
        if (!activeStoreId) return;
        try {
            const storePlan = currentStore?.plan || 'free';
            const limits = PLAN_LIMITS[storePlan] || PLAN_LIMITS.free;

            if (limits.maxProducts !== Infinity && (products.length + newProducts.length) > limits.maxProducts) {
                return {
                    success: false,
                    error: 'Cannot add ' + newProducts.length + ' products.Plan limit is ' + limits.maxProducts + '.Current: ' + products.length
                };
            }

            const batch = writeBatch(db);
            const productsRef = collection(db, 'products');
            const categoriesRef = collection(db, 'categories');
            const batchesRef = collection(db, 'batches');

            // Sanitize and normalize categories from new products
            const productsToImport = newProducts.map(p => ({
                ...p,
                category: typeof p.category === 'string' ? p.category.trim() : p.category
            }));

            const uniqueCategories = [...new Set(productsToImport.map(p => p.category).filter(c => c && typeof c === 'string'))];
            // Normalize existing categories for comparison
            const existingCategoryNames = categories.map(c => (c?.name ? String(c.name).trim().toLowerCase() : ''));
            let newCategoriesCount = 0;

            // Add new categories
            uniqueCategories.forEach(catName => {
                if (typeof catName === 'string' && !existingCategoryNames.includes(catName.trim().toLowerCase())) {
                    const newCatRef = doc(categoriesRef);
                    batch.set(newCatRef, { name: catName.trim(), storeId: activeStoreId });
                    existingCategoryNames.push(catName.trim().toLowerCase());
                    newCategoriesCount++;
                }
            });

            // Add products with FIFO batch tracking
            productsToImport.forEach(product => {
                const docRef = doc(productsRef);
                batch.set(docRef, { ...product, storeId: activeStoreId });

                // Create stock movement
                if (product.stock > 0) {
                    const movementRef = doc(collection(db, 'stock_movements'));
                    batch.set(movementRef, {
                        storeId: activeStoreId,
                        productId: docRef.id,
                        type: 'in',
                        qty: product.stock,
                        date: new Date().toISOString(),
                        note: 'Initial Stock (Bulk Import)',
                        refId: docRef.id
                    });

                    // Create FIFO batch for initial stock
                    const batchRef = doc(batchesRef);
                    batch.set(batchRef, {
                        storeId: activeStoreId,
                        productId: docRef.id,
                        initialQty: product.stock,
                        currentQty: product.stock,
                        buyPrice: product.buyPrice || 0,
                        date: new Date().toISOString(),
                        note: 'Initial Stock (Bulk Import)'
                    });
                }
            });

            await batch.commit();
            fetchData();
            return { success: true, count: productsToImport.length, newCategories: newCategoriesCount };
        } catch (error) {
            console.error("Error bulk adding products:", error);
            return { success: false, error };
        }
    };

    const adjustStock = async (productId, qtyChange, type, note) => {
        if (!activeStoreId) return;
        try {
            const batch = writeBatch(db);
            const productRef = doc(db, 'products', productId);
            const product = products.find(p => p.id === productId);
            if (!product) return { success: false, error: 'Product not found' };
            const newStock = (parseInt(product.stock) || 0) + qtyChange;
            batch.update(productRef, { stock: newStock });
            const movementRef = doc(collection(db, 'stock_movements'));
            batch.set(movementRef, {
                storeId: activeStoreId,
                productId,
                type: type,
                qty: qtyChange,
                date: new Date().toISOString(),
                note: note || 'Manual Adjustment',
                refId: null
            });
            await batch.commit();

            // Optimistic update
            // 1. Update Product Stock
            setProducts(prev => prev.map(p => {
                if (p.id === productId) {
                    return { ...p, stock: newStock };
                }
                return p;
            }));

            // 2. Add Stock Movement
            const newMovement = {
                id: movementRef.id,
                storeId: activeStoreId,
                productId,
                type: type,
                qty: qtyChange,
                date: new Date().toISOString(),
                note: note || 'Manual Adjustment',
                refId: null
            };
            setStockMovements(prev => [newMovement, ...prev]);

            return { success: true };
        } catch (error) {
            console.error("Error adjusting stock:", error);
            return { success: false, error };
        }
    };

    const reduceStockFIFO = async (productId, qty, note) => {
        if (!activeStoreId) return { success: false, error: 'No active store' };
        try {
            const batch = writeBatch(db);

            // Get all batches for this product
            const batchSnapshot = await getDocs(
                query(
                    collection(db, 'batches'),
                    where('productId', '==', productId),
                    where('storeId', '==', activeStoreId)
                )
            );

            let batches = batchSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Sort by date (FIFO - oldest first)
            batches.sort((a, b) => new Date(a.date) - new Date(b.date));

            // Filter only batches with stock
            batches = batches.filter(b => b.currentQty > 0);

            let remainingQtyToDeduct = qty;
            let totalCOGS = 0;

            // Deduct from batches using FIFO
            for (const b of batches) {
                if (remainingQtyToDeduct <= 0) break;

                const deduct = Math.min(b.currentQty, remainingQtyToDeduct);
                totalCOGS += (deduct * b.buyPrice);

                const batchRef = doc(db, 'batches', b.id);
                batch.update(batchRef, { currentQty: b.currentQty - deduct });

                remainingQtyToDeduct -= deduct;
            }

            // If still have remaining qty (no batches), use product's buyPrice as fallback
            if (remainingQtyToDeduct > 0) {
                const product = products.find(p => p.id === productId);
                const fallbackBuyPrice = product ? (product.buyPrice || 0) : 0;
                totalCOGS += (remainingQtyToDeduct * fallbackBuyPrice);
            }

            // Update product stock
            const productRef = doc(db, 'products', productId);
            const product = products.find(p => p.id === productId);
            if (product) {
                batch.update(productRef, { stock: product.stock - qty });
            }

            // Record stock movement
            const movementRef = doc(collection(db, 'stock_movements'));
            batch.set(movementRef, {
                storeId: activeStoreId,
                productId,
                type: 'out',
                qty: -qty,
                date: new Date().toISOString(),
                note: note || 'Pengurangan Stok (FIFO)',
                refId: null
            });

            await batch.commit();

            // Optimistic update
            // 1. Update Product Stock
            setProducts(prev => prev.map(p => {
                if (p.id === productId) {
                    return { ...p, stock: (parseInt(p.stock) || 0) - qty };
                }
                return p;
            }));

            // 2. Add Stock Movement
            const newMovement = {
                id: movementRef.id,
                storeId: activeStoreId,
                productId,
                type: 'out',
                qty: -qty,
                date: new Date().toISOString(),
                note: note || 'Pengurangan Stok (FIFO)',
                refId: null
            };
            setStockMovements(prev => [newMovement, ...prev]);

            return { success: true, cogs: totalCOGS };
        } catch (error) {
            console.error("Error reducing stock:", error);
            return { success: false, error };
        }
    };

    // --- Sales Targets Management ---

    const addSalesTarget = async (targetData) => {
        if (!activeStoreId) return;
        try {
            const docRef = await addDoc(collection(db, 'sales_targets'), {
                ...targetData,
                storeId: activeStoreId,
                createdAt: new Date().toISOString()
            });
            // Optimistic update
            setSalesTargets(prev => [...prev, { id: docRef.id, ...targetData, storeId: activeStoreId }]);
            return { success: true };
        } catch (error) {
            console.error("Error adding sales target:", error);
            return { success: false, error };
        }
    };

    const updateSalesTarget = async (id, data) => {
        try {
            const targetRef = doc(db, 'sales_targets', id);
            await updateDoc(targetRef, data);
            // Optimistic update
            setSalesTargets(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
            return { success: true };
        } catch (error) {
            console.error("Error updating sales target:", error);
            return { success: false, error };
        }
    };

    const deleteSalesTarget = async (id) => {
        try {
            await deleteDoc(doc(db, 'sales_targets', id));
            // Optimistic update
            setSalesTargets(prev => prev.filter(t => t.id !== id));
            return { success: true };
        } catch (error) {
            console.error("Error deleting sales target:", error);
            return { success: false, error };
        }
    };

    return (
        <POSContext.Provider value={{
            categories,
            products,
            transactions,
            stockMovements, // Still provided but might be empty initially
            fetchStockMovements, // Exposed for lazy loading
            customers,
            loading,
            voidTransaction,
            processRefund,
            processDebtPayment,
            addCategory,
            updateCategory,
            deleteCategory,
            addProduct,
            updateProduct,
            deleteProduct,
            addTransaction,
            addCustomer,
            updateCustomer,
            deleteCustomer,
            adjustCustomerPoints,
            getPointAdjustmentHistory,
            checkAndResetExpiredPoints,
            addStockBatch,
            adjustStock,
            reduceStockFIFO,
            processSale,
            bulkAddProducts,
            refreshData: fetchData,
            checkPlanLimit,
            salesTargets,
            addSalesTarget,
            updateSalesTarget,
            deleteSalesTarget,
            lastFetchError
        }}>
            {children}
        </POSContext.Provider>
    );
};

export const usePOS = () => useContext(POSContext);
