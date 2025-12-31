/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail
} from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    addDoc,
    query,
    where,
    getDocs,
    deleteDoc
} from 'firebase/firestore';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    // Fetch additional user data from Firestore
                    const userDocRef = doc(db, 'users', firebaseUser.uid);
                    const userDoc = await getDoc(userDocRef);

                    if (userDoc.exists()) {
                        const userData = { id: userDoc.id, ...userDoc.data() };
                        setUser(userData);

                        // Check for Trial Expiration
                        if (userData.storeId) {
                            const storeRef = doc(db, 'stores', userData.storeId);
                            const storeSnap = await getDoc(storeRef);

                            if (storeSnap.exists()) {
                                const storeData = storeSnap.data();
                                if (storeData.plan === 'pro' && storeData.trialEndsAt) {
                                    const trialEnd = new Date(storeData.trialEndsAt);
                                    if (new Date() > trialEnd) {
                                        console.log("Trial expired. Downgrading to Free.");
                                        await updateDoc(storeRef, {
                                            plan: 'free',
                                            trialEndsAt: null // Clear trial
                                        });
                                        // Ideally notify user here, but for now just downgrade
                                    }
                                }
                            }
                        }

                        // 3. Fetch Role Permissions if roleId exists
                        if (userData.roleId) {
                            try {
                                const roleDoc = await getDoc(doc(db, 'roles', userData.roleId));
                                if (roleDoc.exists()) {
                                    const roleData = roleDoc.data();
                                    userData.permissions = { ...userData.permissions, ...roleData.permissions };
                                    userData.roleName = roleData.name;
                                }
                            } catch (err) {
                                console.error("Error fetching permissions for role:", err);
                            }
                        }

                        // Update status to online (Non-blocking)
                        updateDoc(userDocRef, {
                            status: 'online',
                            lastLogin: new Date().toISOString()
                        }).catch(e => console.error("Error updating online status:", e));
                    } else {
                        // Fallback if user exists in Auth but not in Firestore (should rarely happen)
                        console.error("User authenticated but no Firestore profile found.");
                        setUser(null);
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const recordLoginHistory = async (userData, status) => {
        try {
            if (!userData) return;

            await addDoc(collection(db, 'login_history'), {
                userId: userData.id,
                userName: userData.name || 'Unknown',
                userRole: userData.role || 'staff',
                storeId: userData.storeId,
                storeName: userData.storeName || '',
                loginTime: new Date().toISOString(),
                status: status,
                userAgent: navigator.userAgent
            });
        } catch (error) {
            console.error("Error recording login history:", error);
            // Don't block the main flow if history recording fails
        }
    };

    const login = async (email, password) => {
        try {
            // 1. Try Firebase Auth Login
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;

            // 2. Fetch User Profile immediately to update state without waiting for listener
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = { id: userDoc.id, ...userDoc.data() };

                // CHECK PERMISSIONS
                // 1. Super Admin Bypass (Always Allowed)
                if (userData.role === 'super_admin') {
                    // Allowed
                }
                // 2. Regular Users Check
                else if (userData.storeId) {
                    const storeRef = doc(db, 'stores', userData.storeId);
                    const storeSnap = await getDoc(storeRef);

                    if (storeSnap.exists()) {
                        const storeData = storeSnap.data();

                        // Check 1: Store Level (Must be enabled for the store)
                        if (!storeData.petCareEnabled) {
                            await signOut(auth);
                            return {
                                success: false,
                                message: "Akses Ditolak: Fitur Pet Care belum diaktifkan untuk toko ini. Hubungi Admin."
                            };
                        }

                        // Check 2: User Level (Must have granular access)
                        // Note: 'admin' role (Store Owner) implies access if store has access
                        if (userData.role !== 'admin' && !userData.petCareAccess) {
                            await signOut(auth);
                            return {
                                success: false,
                                message: "Akses Ditolak: Akun Anda tidak memiliki izin akses aplikasi Pet Care. Hubungi Manager."
                            };
                        }
                    }
                }

                setUser(userData); // Update state immediately

                // Update status to online (Non-blocking)
                updateDoc(userDocRef, {
                    status: 'online',
                    lastLogin: new Date().toISOString()
                }).catch(e => console.error("Error updating online status:", e));

                // Record login history (Non-blocking)
                recordLoginHistory(userData, 'success');

                return { success: true };
            } else {
                // Fallback: Check if user exists with a different ID (e.g. created via Staff page without Auth)
                // This handles the "Ghost Auth" vs "Firestore Profile" mismatch
                const q = query(collection(db, 'users'), where('email', '==', email));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    // Found a profile with this email but different ID! Migrate it.
                    const oldDoc = querySnapshot.docs[0];
                    const oldData = oldDoc.data();

                    console.log("Migrating user profile from", oldDoc.id, "to", firebaseUser.uid);

                    // 1. Create new doc with Auth UID
                    const newProfile = { ...oldData, id: firebaseUser.uid };
                    await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);

                    // 2. Delete old doc
                    await deleteDoc(doc(db, 'users', oldDoc.id));

                    // 3. Proceed with login
                    setUser(newProfile);

                    // Update status (Non-blocking)
                    updateDoc(doc(db, 'users', firebaseUser.uid), {
                        status: 'online',
                        lastLogin: new Date().toISOString()
                    }).catch(e => console.error("Error updating online status:", e));

                    // Record login history (Non-blocking)
                    recordLoginHistory(newProfile, 'success');

                    return { success: true };
                }

                console.error("User authenticated but no Firestore profile found.");
                await signOut(auth); // Force logout if profile invalid
                return { success: false, message: "Profil pengguna tidak ditemukan. Hubungi Admin." };
            }

        } catch (error) {
            console.error("Login error:", error);

            let errorMessage = "Email atau password salah.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') errorMessage = "Email atau password salah.";
            if (error.code === 'auth/wrong-password') errorMessage = "Password salah.";
            if (error.code === 'auth/invalid-email') errorMessage = "Format email tidak valid.";
            if (error.code === 'auth/too-many-requests') errorMessage = "Terlalu banyak percobaan login. Coba lagi nanti.";

            return { success: false, message: errorMessage };
        }
    };

    const signup = async (email, password, name, storeName, appType = 'pos_petcare') => {
        try {
            // 1. Check if store name already exists
            const storesRef = collection(db, 'stores');
            const storeQuery = query(storesRef, where("name", "==", storeName));
            const storeSnapshot = await getDocs(storeQuery);

            if (!storeSnapshot.empty) {
                return { success: false, message: 'Nama toko sudah digunakan.' };
            }

            // 2. Create Firebase Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;

            // 3. Create Store Document
            const trialEndsAt = new Date();
            trialEndsAt.setDate(trialEndsAt.getDate() + 7); // 7 Days Trial

            const storeRef = await addDoc(collection(db, 'stores'), {
                name: storeName,
                ownerId: firebaseUser.uid,
                ownerName: name,
                email: email,
                createdAt: new Date().toISOString(),
                plan: 'pro', // Start with Pro Trial
                trialEndsAt: trialEndsAt.toISOString(),
                status: 'active',
                settings: {
                    currency: 'IDR',
                    taxRate: 0,
                    appType: appType, // 'pos_petcare' or 'petcare_only'
                    petCareEnabled: true, // Always enable if registering via this app
                    posEnabled: appType === 'pos_petcare'
                }
            });

            // 4. Create User Profile in Firestore
            const newUserProfile = {
                name: name,
                email: email,
                role: 'admin', // Owner is admin
                storeId: storeRef.id,
                storeName: storeName, // Add storeName to user profile for easier access
                createdAt: new Date().toISOString(),
                status: 'online'
            };

            await setDoc(doc(db, 'users', firebaseUser.uid), newUserProfile);

            // Record initial login
            await recordLoginHistory({ id: firebaseUser.uid, ...newUserProfile }, 'success');

            return { success: true, user: { id: firebaseUser.uid, ...newUserProfile } };

        } catch (error) {
            console.error("Signup error:", error);
            let msg = error.message;
            if (error.code === 'auth/email-already-in-use') msg = "Email sudah terdaftar.";
            if (error.code === 'auth/weak-password') msg = "Password terlalu lemah (min 6 karakter).";
            return { success: false, message: msg };
        }
    };

    const logout = async () => {
        try {
            if (user) {
                // Record logout history before signing out
                await recordLoginHistory(user, 'logout');

                // Update status to offline
                const userRef = doc(db, 'users', user.id);
                await updateDoc(userRef, {
                    status: 'offline',
                    lastLogout: new Date().toISOString()
                });
            }
            await signOut(auth);
            setUser(null);
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const resetPassword = async (email) => {
        try {
            await sendPasswordResetEmail(auth, email);
            return { success: true };
        } catch (error) {
            console.error("Reset password error:", error);
            let msg = "Gagal mengirim email reset password.";
            if (error.code === 'auth/user-not-found') msg = "Email tidak terdaftar.";
            if (error.code === 'auth/invalid-email') msg = "Format email tidak valid.";
            return { success: false, message: msg };
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, signup, resetPassword, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
