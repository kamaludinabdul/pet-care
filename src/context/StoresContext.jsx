import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { normalizePermissions } from '../utils/permissions';
import { checkPlanLimit } from '../utils/planLimits';
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth as getAuthSecondary, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from '../firebase';

const StoresContext = createContext(null);

export const StoresProvider = ({ children }) => {
    const { user } = useAuth();
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);

    // For Super Admin to switch views
    const [selectedStoreId, setSelectedStoreId] = useState(null);

    // Determine the effective store ID to use for queries
    const activeStoreId = user?.storeId || selectedStoreId;
    const currentStore = stores.find(s => s.id === activeStoreId) || null;

    const fetchStores = useCallback(async () => {
        try {
            const snapshot = await getDocs(collection(db, 'stores'));
            const storesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStores(storesData);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching stores:", error);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStores();
    }, [fetchStores]);

    const addStore = async (storeData) => {
        try {
            const docRef = await addDoc(collection(db, 'stores'), {
                ...storeData,
                createdAt: new Date().toISOString()
            });
            fetchStores();
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error("Error adding store:", error);
            return { success: false, error };
        }
    };

    const updateStore = async (id, data) => {
        try {
            const storeRef = doc(db, 'stores', id);
            await updateDoc(storeRef, data);
            fetchStores();
            return { success: true };
        } catch (error) {
            console.error("Error updating store:", error);
            return { success: false, error };
        }
    };

    const deleteStore = async (id) => {
        try {
            await deleteDoc(doc(db, 'stores', id));
            fetchStores();
            return { success: true };
        } catch (error) {
            console.error("Error deleting store:", error);
            return { success: false, error };
        }
    };

    const updateStoreSettings = async (settings) => {
        if (!activeStoreId) {
            return { success: false, error: 'No active store ID' };
        }
        try {
            const storeRef = doc(db, 'stores', activeStoreId);
            await updateDoc(storeRef, settings);
            fetchStores();
            return { success: true };
        } catch (error) {
            console.error("Error updating store settings:", error);
            return { success: false, error };
        }
    };

    // Helper to safely fetch and log errors (Moved here if needed globally, or keep in specific contexts)
    // Keeping it simple for now.

    const addUser = async (userData) => {
        try {
            // Check Plan Limits
            const targetStore = stores.find(s => s.id === userData.storeId);
            const storePlan = targetStore?.plan || 'free';

            // Get current user count for this store
            const q = query(collection(db, 'users'), where('storeId', '==', userData.storeId));
            const snapshot = await getDocs(q);
            const currentCount = snapshot.size;

            const limitCheck = checkPlanLimit(storePlan, 'users', currentCount);

            if (!limitCheck.allowed) {
                return {
                    success: false,
                    error: 'Plan limit reached. Upgrade to add more users. (Limit: ' + limitCheck.limit + ')',
                    isLimitError: true,
                    limitType: 'users',
                    debugInfo: {
                        plan: storePlan,
                        limit: limitCheck.limit,
                        currentCount: currentCount
                    }
                };
            }

            // Check Role Limits
            const roleCheck = checkPlanLimit(storePlan, 'roles', userData.role);
            if (!roleCheck.allowed) {
                return {
                    success: false,
                    error: 'Role \'' + userData.role + '\' tidak tersedia di paket ' + storePlan + '. Upgrade untuk akses.',
                    isLimitError: true,
                    limitType: 'roles'
                };
            }

            // Create Firebase Auth User
            // We need a secondary app to create user without logging out current user
            // UNLESS we are using a cloud function. Client-side creation requires secondary app or re-login.
            // Simplified for this context:

            let uid = null;

            if (userData.email && userData.password) {
                try {
                    const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp" + Date.now());
                    const secondaryAuth = getAuthSecondary(secondaryApp);

                    try {
                        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, userData.password);
                        uid = userCredential.user.uid;
                        await deleteApp(secondaryApp);
                    } catch (createError) {
                        if (createError.code === 'auth/email-already-in-use') {
                            // Try to link/login logic not fully implemented here for brevity, 
                            // but assuming we fail or handle existing users.
                            // For now, let's just throw or return error
                            await deleteApp(secondaryApp);
                            return { success: false, error: "Email already in use." };
                        }
                        throw createError;
                    }

                } catch (error) {
                    console.error("Auth creation failed:", error);
                    return { success: false, error: error.message };
                }
            }

            const newUser = {
                ...userData,
                createdAt: new Date().toISOString()
            };

            if (uid) {
                await setDoc(doc(db, 'users', uid), newUser);
            } else {
                await addDoc(collection(db, 'users'), newUser);
            }

            return { success: true };
        } catch (error) {
            console.error("Error adding user:", error);
            return { success: false, error };
        }
    };

    const fetchUsersByStore = async (storeId) => {
        try {
            const q = query(collection(db, 'users'), where('storeId', '==', storeId));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) {
            console.error("Error fetching users:", error);
            return [];
        }
    };

    const value = {
        stores,
        activeStoreId,
        currentStore,
        loading,
        selectedStoreId,
        setSelectedStoreId,
        addStore,
        updateStore,
        deleteStore,
        updateStoreSettings,
        refreshStores: fetchStores,
        addUser,
        fetchUsersByStore
    };

    return (
        <StoresContext.Provider value={value}>
            {children}
        </StoresContext.Provider>
    );
};

export const useStores = () => {
    const context = useContext(StoresContext);
    if (!context) {
        throw new Error('useStores must be used within a StoresProvider');
    }
    return context;
};
