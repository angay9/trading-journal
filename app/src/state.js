import Papa from 'papaparse'
import { computed, ref } from 'vue'
import { initializeApp } from 'firebase/app'
import {
    getFirestore,
    collection,
    doc,
    getDocs,
    getDoc,
    writeBatch,
    setDoc,
} from 'firebase/firestore'
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut,
} from 'firebase/auth'
import { normalizeType, parseDate } from './helpers'

// Toggle this to control whether Google authentication is required.
// true  -> users must sign in and data is stored in Firebase per user
// false -> app runs in guest mode and data is stored locally in this browser
export const REQUIRE_GOOGLE_AUTH = true

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};


let db = null
let auth = null
const googleProvider = new GoogleAuthProvider()
try {
    const app = initializeApp(firebaseConfig)
    db = getFirestore(app)
    auth = getAuth(app)
} catch {
    db = null
    auth = null
}

export const trades = ref([])
export const deletedArr = ref([])
export const currentUser = ref(null)
export const authReady = ref(false)
export const active = computed(() => trades.value.filter(t => !deletedArr.value.includes(t.id)))
export const sells = computed(() => active.value.filter(t => t.type === 'SELL'))

let authInitPromise = null
const LOCAL_TRADES_KEY = 'trade-tracker:guest:trades'
const LOCAL_DELETED_KEY = 'trade-tracker:guest:deleted'

const isGuestMode = () => !REQUIRE_GOOGLE_AUTH

const loadGuestState = () => {
    if (typeof window === 'undefined') {
        clearLocalState()
        return
    }

    try {
        const rawTrades = window.localStorage.getItem(LOCAL_TRADES_KEY)
        const parsedTrades = rawTrades ? JSON.parse(rawTrades) : []
        trades.value = Array.isArray(parsedTrades)
            ? parsedTrades.map(t => ({ ...t, type: normalizeType(t.type) }))
            : []
    } catch {
        trades.value = []
    }

    try {
        const rawDeleted = window.localStorage.getItem(LOCAL_DELETED_KEY)
        const parsedDeleted = rawDeleted ? JSON.parse(rawDeleted) : []
        deletedArr.value = Array.isArray(parsedDeleted) ? parsedDeleted : []
    } catch {
        deletedArr.value = []
    }
}

const saveGuestTrades = () => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LOCAL_TRADES_KEY, JSON.stringify(trades.value))
}

const saveGuestDeleted = () => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LOCAL_DELETED_KEY, JSON.stringify(deletedArr.value))
}

const clearLocalState = () => {
    trades.value = []
    deletedArr.value = []
}

const userTradesCollection = uid => collection(db, 'users', uid, 'trades')
const userDeletedDoc = uid => doc(db, 'users', uid, 'meta', 'deleted')

export async function initAuth() {
    if (isGuestMode()) {
        currentUser.value = null
        await initStorage()
        authReady.value = true
        return
    }

    if (!auth) {
        authReady.value = true
        currentUser.value = null
        clearLocalState()
        return
    }

    if (!authInitPromise) {
        authInitPromise = new Promise(resolve => {
            onAuthStateChanged(auth, async user => {
                currentUser.value = user || null
                if (user?.uid) await initStorage(user.uid)
                else clearLocalState()

                if (!authReady.value) {
                    authReady.value = true
                    resolve()
                }
            })
        })
    }

    return authInitPromise
}

export async function signInWithGoogle() {
    if (isGuestMode()) return
    if (!auth) throw new Error('Firebase Auth is not available')
    await signInWithPopup(auth, googleProvider)
}

export async function signOutUser() {
    if (isGuestMode()) return
    if (!auth) return
    await signOut(auth)
}

export async function initStorage(uid = currentUser.value?.uid) {
    if (isGuestMode()) {
        loadGuestState()
        return
    }

    if (!db || !uid) {
        clearLocalState()
        return
    }

    try {
        const tradesSnap = await getDocs(userTradesCollection(uid))
        trades.value = tradesSnap.docs.map(d => ({ ...d.data(), type: normalizeType(d.data().type) }))
    } catch {
        trades.value = []
    }

    try {
        const deletedSnap = await getDoc(userDeletedDoc(uid))
        deletedArr.value = deletedSnap.exists() ? (deletedSnap.data().ids || []) : []
    } catch {
        deletedArr.value = []
    }
}

export async function saveTrades() {
    if (isGuestMode()) {
        saveGuestTrades()
        return
    }

    const uid = currentUser.value?.uid
    if (!db || !uid) return
    const batch = writeBatch(db)
    const tradesCol = userTradesCollection(uid)
    const existing = await getDocs(tradesCol)
    existing.forEach(d => batch.delete(d.ref))
    trades.value.forEach(t => batch.set(doc(db, 'users', uid, 'trades', t.id), t))
    await batch.commit()
}

export async function saveDeleted() {
    if (isGuestMode()) {
        saveGuestDeleted()
        return
    }

    const uid = currentUser.value?.uid
    if (!db || !uid) return
    await setDoc(userDeletedDoc(uid), { ids: deletedArr.value })
}

export async function toggleDelete(id) {
    if (deletedArr.value.includes(id)) deletedArr.value = deletedArr.value.filter(x => x !== id)
    else deletedArr.value.push(id)
    await saveDeleted()
}

export async function bulkSetDeleted(ids, del) {
    if (del) ids.forEach(id => { if (!deletedArr.value.includes(id)) deletedArr.value.push(id) })
    else deletedArr.value = deletedArr.value.filter(id => !ids.has(id))
    await saveDeleted()
}

export async function doClearAll() {
    trades.value = []
    deletedArr.value = []
    await saveTrades()
    await saveDeleted()
}

export async function hardDeleteAll() {
    if (typeof window !== 'undefined' && !window.confirm('This will permanently delete ALL trades and cannot be undone. Proceed?')) return
    await doClearAll()
}

export function doImport(file) {
    return new Promise(resolve => {
        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: async ({ data }) => {
                const str = v => String(v ?? '').trim()

                const map = {}
                data.forEach((r, rowIndex) => {
                    const tradeId = str(r.TradeID)
                    const identifier = tradeId || `ROW-${rowIndex}`
                    if (!map[identifier]) map[identifier] = []
                    map[identifier].push(r)
                })

                const parsed = Object.entries(map).map(([id, rows]) => {
                    const r0 = rows[0]
                    const tradeId = str(r0.TradeID)
                    const qty = rows.reduce((s, r) => s + Math.abs(parseFloat(r.Quantity) || 0), 0)
                    const money = rows.reduce((s, r) => s + Math.abs(parseFloat(r.TradeMoney) || 0), 0)
                    const pnl = rows.reduce((s, r) => s + (parseFloat(r.FifoPnlRealized) || 0), 0)
                    return {
                        id: tradeId ? `TRADE-${tradeId}` : id,
                        tradeId,
                        assetClass: str(r0.AssetClass).toUpperCase(),
                        symbol: str(r0.Symbol),
                        description: str(r0.Description),
                        date: parseDate(r0.TradeDate),
                        type: normalizeType(r0['Buy/Sell']),
                        quantity: qty,
                        avgPrice: qty > 0 ? money / qty : 0,
                        pnl,
                        currency: str(r0.CurrencyPrimary || 'USD'),
                    }
                }).filter(t => t.symbol && t.date)

                const existingByTradeId = new Map()
                trades.value.forEach((t, idx) => {
                    if (t.tradeId) existingByTradeId.set(t.tradeId, idx)
                })

                const newRecords = []
                let deletedChanged = false
                const markDeleted = id => {
                    if (!deletedArr.value.includes(id)) {
                        deletedArr.value.push(id)
                        deletedChanged = true
                    }
                }

                parsed.forEach(record => {
                    const matchIndex = (record.tradeId && existingByTradeId.has(record.tradeId))
                        ? existingByTradeId.get(record.tradeId)
                        : null

                    if (matchIndex !== null) {
                        const existingRecord = trades.value[matchIndex]
                        const wasDeleted = deletedArr.value.includes(existingRecord.id)
                        const updatedRecord = { ...existingRecord, ...record }
                        trades.value[matchIndex] = updatedRecord
                        if (wasDeleted) markDeleted(updatedRecord.id)
                    } else newRecords.push(record)

                    if (record.assetClass === 'CASH') markDeleted(record.id)
                })

                if (newRecords.length) trades.value.push(...newRecords)
                await saveTrades()
                if (deletedChanged) await saveDeleted()
                resolve({ added: newRecords.length, total: trades.value.length })
            },
            error: () => resolve({ added: 0, total: trades.value.length }),
        })
    })
}