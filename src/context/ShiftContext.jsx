import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, updateDoc, doc, onSnapshot } from 'firebase/firestore';

import { sendMessage } from '../services/telegram';
import { useAuth } from './AuthContext';
import { useStores } from './StoresContext';

const ShiftContext = createContext(null);

export const ShiftProvider = ({ children }) => {
    const [currentShift, setCurrentShift] = useState(null);
    const [loading, setLoading] = useState(true);
    const { currentStore } = useStores();
    const { user } = useAuth();

    useEffect(() => {
        if (!user || !currentStore) {
            const timer = setTimeout(() => setLoading(false), 0);
            return () => clearTimeout(timer);
        }

        const shiftsRef = collection(db, 'shifts');
        // Filter by status AND storeId to enforce ONE active shift per store
        // We removed cashierId filter so everyone sees the active shift
        const q = query(
            shiftsRef,
            where('status', '==', 'active'),
            where('storeId', '==', currentStore.id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const shifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort to get the latest if multiple exist (though we try to enforce one)
                shifts.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
                setCurrentShift(shifts[0]);
            } else {
                setCurrentShift(null);
            }
            setLoading(false);
        }, (error) => {
            console.error('Error listening to active shift:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, currentStore]);

    // checkActiveShift is no longer needed as we have a listener
    const checkActiveShift = async () => {
        console.log('Active shift check handled by listener');
    };

    const startShift = async (cashierName, initialCash = 0) => {
        try {
            const startTime = new Date().toISOString();
            const shiftData = {
                cashier: cashierName,
                cashierId: user?.id,
                storeId: currentStore?.id,
                startTime: startTime,
                initialCash: initialCash,
                status: 'active',
                transactions: 0,
                totalSales: 0,
                totalCashSales: 0,
                totalNonCashSales: 0,
                totalCashIn: 0,
                totalCashOut: 0,
                totalDiscount: 0
            };

            const docRef = await addDoc(collection(db, 'shifts'), shiftData);
            const newShift = { id: docRef.id, ...shiftData };

            // Telegram Alert
            if (currentStore?.telegramNotifyShift) {
                const msg = `🔓 <b>SHIFT DIBUKA</b>\n\n👤 Kasir: ${cashierName}\n💵 Modal Awal: Rp ${initialCash.toLocaleString()}\n⏰ Waktu: ${new Date(startTime).toLocaleString('id-ID')}`;
                sendMessage(msg, { token: currentStore?.telegramBotToken, chatId: currentStore?.telegramChatId });
            }

            return { success: true, shift: newShift };
        } catch (error) {
            console.error('Error starting shift:', error);
            return { success: false, error };
        }
    };

    const addCashMovement = async (type, amount, reason, category = 'General') => {
        if (!currentShift) return { success: false, error: 'No active shift' };
        try {
            const movementData = {
                shiftId: currentShift.id,
                type, // 'in' or 'out'
                amount: Number(amount),
                reason,
                category,
                date: new Date().toISOString(),
                cashier: currentShift.cashier,
                storeId: currentStore?.id
            };
            const movementDoc = await addDoc(collection(db, 'shift_movements'), movementData);

            // INTEGRATION: Also record in Main Cash Flow (Finance)
            try {
                const cashFlowData = {
                    storeId: currentStore?.id,
                    type: type, // 'in' or 'out'
                    category: category === 'General' ? `Kasir (${type === 'in' ? 'Masuk' : 'Keluar'})` : category,
                    amount: Number(amount),
                    description: `${reason} (Shift #${currentShift.id.slice(0, 6)})`,
                    date: new Date().toISOString().split('T')[0],
                    performedBy: currentShift.cashier || 'Cashier',
                    createdAt: new Date().toISOString(),
                    refId: movementDoc.id, // Reference to shift movement
                    source: 'pos_shift'
                };
                await addDoc(collection(db, 'cash_flow'), cashFlowData);
            } catch (cfError) {
                console.error("Error syncing to cash_flow:", cfError);
                // We don't block the shift movement if this fails, but we log it.
            }

            // Update shift totals
            const shiftRef = doc(db, 'shifts', currentShift.id);
            const updateData = {};
            if (type === 'in') {
                updateData.totalCashIn = (currentShift.totalCashIn || 0) + Number(amount);
            } else {
                updateData.totalCashOut = (currentShift.totalCashOut || 0) + Number(amount);
            }
            await updateDoc(shiftRef, updateData);

            // Optimistic update handled by onSnapshot, but for immediate UI feedback:
            // setCurrentShift(prev => ({ ...prev, ...updateData })); 

            return { success: true };
        } catch (error) {
            console.error('Error adding cash movement:', error);
            return { success: false, error };
        }
    };

    const endShift = async (finalCash = 0, finalNonCash = 0, notes = '') => {
        if (!currentShift) return { success: false, error: 'No active shift' };

        try {
            const shiftRef = doc(db, 'shifts', currentShift.id);
            const endTime = new Date().toISOString();

            const expectedCash = (Number(currentShift.initialCash) || 0) +
                (Number(currentShift.totalCashSales) || 0) +
                (Number(currentShift.totalCashIn) || 0) -
                (Number(currentShift.totalCashOut) || 0);

            const cashDifference = Number(finalCash) - expectedCash;

            const expectedNonCash = Number(currentShift.totalNonCashSales) || 0;
            const nonCashDifference = Number(finalNonCash) - expectedNonCash;

            const endData = {
                endTime: endTime,
                finalCash: Number(finalCash),
                finalNonCash: Number(finalNonCash),
                expectedCash: expectedCash,
                expectedNonCash: expectedNonCash,
                notes: notes,
                status: 'closed',
                cashDifference: cashDifference,
                nonCashDifference: nonCashDifference
            };

            await updateDoc(shiftRef, endData);

            // Telegram Alert
            if (currentStore?.telegramNotifyShift) {
                let msg = `🔒 <b>SHIFT DITUTUP</b>\n\n`;
                msg += `👤 Kasir: ${currentShift.cashier}\n`;
                msg += `⏰ Waktu: ${new Date(endTime).toLocaleString('id-ID')}\n`;
                msg += `💵 Total Penjualan: Rp ${currentShift.totalSales.toLocaleString()}\n`;
                msg += `💵 Tunai Diterima: Rp ${currentShift.totalCashSales.toLocaleString()}\n`;
                msg += `💳 Non-Tunai: Rp ${currentShift.totalNonCashSales.toLocaleString()}\n`;
                msg += `📥 Kas Masuk: Rp ${currentShift.totalCashIn?.toLocaleString() || 0}\n`;
                msg += `📤 Total Pengeluaran: Rp ${currentShift.totalCashOut?.toLocaleString() || 0}\n`;
                msg += `--------------------------------\n`;
                msg += `💰 Uang Fisik (Disetor): Rp ${finalCash.toLocaleString()}\n`;
                msg += `💳 Uang Transfer (Cek): Rp ${finalNonCash.toLocaleString()}\n`;
                msg += `📊 Selisih Tunai: ${cashDifference < 0 ? '🔴' : '🟢'} Rp ${cashDifference.toLocaleString()}\n`;
                if (nonCashDifference !== 0) msg += `📊 Selisih Transfer: ${nonCashDifference < 0 ? '🔴' : '🟢'} Rp ${nonCashDifference.toLocaleString()}\n`;
                if (notes) msg += `📝 Catatan: ${notes}\n`;

                sendMessage(msg, { token: currentStore?.telegramBotToken, chatId: currentStore?.telegramChatId });
            }

            setCurrentShift(null);
            return { success: true };
        } catch (error) {
            console.error('Error ending shift:', error);
            return { success: false, error };
        }
    };

    const terminateShift = async (shiftId, notes = 'Terminated by Admin') => {
        try {
            const shiftRef = doc(db, 'shifts', shiftId);
            const endTime = new Date().toISOString();

            // We might not know the exact final cash, so we assume 0 or just close it.
            // Since it's a forced termination, we can set a flag or note.

            const endData = {
                endTime: endTime,
                status: 'closed',
                notes: notes,
                terminatedByAdmin: true
            };

            await updateDoc(shiftRef, endData);

            // If the terminated shift was the current one, clear it
            if (currentShift && currentShift.id === shiftId) {
                setCurrentShift(null);
            }

            // Telegram Alert
            if (currentStore?.telegramNotifyShift) {
                const msg = `🛑 <b>SHIFT DIHENTIKAN ADMIN</b>\n\n🆔 Shift ID: #${shiftId.slice(0, 8)}\n📝 Catatan: ${notes}\n⏰ Waktu: ${new Date(endTime).toLocaleString('id-ID')}`;
                sendMessage(msg, { token: currentStore?.telegramBotToken, chatId: currentStore?.telegramChatId });
            }

            return { success: true };
        } catch (error) {
            console.error('Error terminating shift:', error);
            return { success: false, error };
        }
    };

    const updateShiftStats = async (transactionAmount, paymentMethod = 'cash', discountAmount = 0, splitDetails = null) => {
        if (!currentShift) return;

        try {
            const shiftRef = doc(db, 'shifts', currentShift.id);
            const updatedStats = {
                transactions: currentShift.transactions + 1,
                totalSales: currentShift.totalSales + transactionAmount
            };

            if (paymentMethod === 'split' && splitDetails) {
                // Handle Split Payment
                let cashAdd = 0;
                let nonCashAdd = 0;

                // Check method 1
                if (splitDetails.method1 === 'cash') cashAdd += Number(splitDetails.amount1);
                else nonCashAdd += Number(splitDetails.amount1);

                // Check method 2
                if (splitDetails.method2 === 'cash') cashAdd += Number(splitDetails.amount2);
                else nonCashAdd += Number(splitDetails.amount2);

                updatedStats.totalCashSales = (currentShift.totalCashSales || 0) + cashAdd;
                updatedStats.totalNonCashSales = (currentShift.totalNonCashSales || 0) + nonCashAdd;

            } else if (paymentMethod === 'cash') {
                updatedStats.totalCashSales = (currentShift.totalCashSales || 0) + transactionAmount;
            } else {
                updatedStats.totalNonCashSales = (currentShift.totalNonCashSales || 0) + transactionAmount;
            }

            if (discountAmount > 0) {
                updatedStats.totalDiscount = (currentShift.totalDiscount || 0) + discountAmount;
            }

            await updateDoc(shiftRef, updatedStats);
            // Optimistic update handled by onSnapshot
        } catch (error) {
            console.error('Error updating shift stats:', error);
        }
    };

    return (
        <ShiftContext.Provider value={{
            currentShift,
            loading,
            startShift,
            endShift,
            terminateShift,
            updateShiftStats,
            addCashMovement,
            checkActiveShift
        }}>
            {children}
        </ShiftContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useShift = () => useContext(ShiftContext);
