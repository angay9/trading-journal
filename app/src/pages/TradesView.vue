<script setup>
import { computed, nextTick, ref, watch } from "vue";
import AppPagination from "../components/AppPagination.vue";
import {
    bulkSetDeleted,
    deletedArr,
    doClearAll,
    hardDeleteAll,
    saveDeleted,
    toggleDelete,
    trades,
    userSettings,
    saveSettings,
} from "../state";
import { calcPnlPct, fmt, fmtPct, fmtPnl, formatDateTime } from "../helpers";

const filter = ref("");
const sortCol = ref("entryDate");
const sortDir = ref("desc");
const selected = ref(new Set());
const showDeleted = ref(false);
const tradeView = ref("grouped");
const pendingAction = ref(null);
const hdrChk = ref(null);

const filteredTrades = computed(() => {
    let list = showDeleted.value
        ? trades.value
        : trades.value.filter((t) => !deletedArr.value.includes(t.id));
    if (filter.value.trim()) {
        const q = filter.value.trim().toUpperCase();
        list = list.filter(
            (t) =>
                t.symbol.toUpperCase().includes(q) ||
                t.description.toUpperCase().includes(q)
        );
    }
    return list;
});

const individualSortMap = {
    symbol: (t) => t.symbol || "",
    date: (t) => t.date || "",
    type: (t) => t.type || "",
    qty: (t) => t.quantity || 0,
    price: (t) => t.avgPrice || 0,
    pnl: (t) => t.pnl || 0,
    description: (t) => t.description || 0,
};

const groupedSortMap = {
    symbol: (t) => t.symbol || "",
    entryDate: (t) => t.entryDate || "",
    exitDate: (t) => t.exitDate || "",
    entryPrice: (t) => t.entryPrice || 0,
    exitPrice: (t) => t.exitPrice || 0,
    qty: (t) => t.qty || 0,
    pnl: (t) => (t.pnl !== null && t.pnl !== undefined ? t.pnl : 0),
    pnlPct: (t) =>
        t.pnlPct !== null && t.pnlPct !== undefined ? t.pnlPct : -Infinity,
    status: (t) => t.status || "",
    description: (t) => t.description || 0,
};

const sortList = (list, key, dir, map) => {
    const accessor = map[key] || ((t) => t[key] ?? "");
    return [...list].sort((a, b) => {
        const av = accessor(a);
        const bv = accessor(b);
        if (av < bv) return dir === "asc" ? -1 : 1;
        if (av > bv) return dir === "asc" ? 1 : -1;
        return 0;
    });
};

const visible = computed(() =>
    sortList(
        filteredTrades.value,
        sortCol.value,
        sortDir.value,
        individualSortMap
    )
);

const groupedTrades = computed(() => {
    const ordered = [...filteredTrades.value].sort((a, b) =>
        String(a?.date || "").localeCompare(String(b?.date || ""))
    );
    const open = {};
    const result = [];

    ordered.forEach((t) => {
        const sym = t.symbol;
        if (t.type === "BUY") {
            if (!open[sym]) {
                open[sym] = {
                    symbol: sym,
                    entryDate: t.date,
                    description: t.description,
                    entryQty: 0,
                    entryValue: 0,
                    currency: t.currency,
                };
            }
            const entry = open[sym];
            entry.entryQty += t.quantity;
            entry.entryValue += t.avgPrice * t.quantity;
            if (!entry.entryDate) entry.entryDate = t.date;
        } else if (t.type === "SELL") {
            const entry = open[sym];
            if (entry) {
                const entryPrice = entry.entryQty
                    ? entry.entryValue / entry.entryQty
                    : t.avgPrice;
                result.push({
                    id: `${sym}-${entry.entryDate}-${t.date}-${t.id}`,
                    symbol: sym,
                    entryDate: entry.entryDate,
                    entryPrice,
                    exitDate: t.date,
                    exitPrice: t.avgPrice,
                    pnl: t.pnl,
                    pnlPct: calcPnlPct(t.pnl, entry.entryValue),
                    currency: t.currency,
                    qty: entry.entryQty || t.quantity,
                    status: "closed",
                    description: t.description,
                });
                delete open[sym];
            } else {
                result.push({
                    id: t.id,
                    symbol: sym,
                    entryDate: t.date,
                    entryPrice: t.avgPrice,
                    exitDate: t.date,
                    exitPrice: t.avgPrice,
                    pnl: t.pnl,
                    pnlPct: calcPnlPct(t.pnl, t.avgPrice * t.quantity),
                    currency: t.currency,
                    qty: t.quantity,
                    status: "closed",
                    description: t.description,
                });
            }
        }
    });

    Object.values(open).forEach((entry) => {
        const entryPrice = entry.entryQty
            ? entry.entryValue / entry.entryQty
            : 0;
        result.push({
            id: `${entry.symbol}-open-${entry.entryDate}`,
            symbol: entry.symbol,
            entryDate: entry.entryDate,
            entryPrice,
            exitDate: null,
            exitPrice: null,
            pnl: null,
            pnlPct: null,
            currency: entry.currency,
            qty: entry.entryQty,
            description: entry.description,
            status: "open",
        });
    });

    return result;
});

const sortedGrouped = computed(() =>
    sortList(groupedTrades.value, sortCol.value, sortDir.value, groupedSortMap)
);
const rowCount = computed(() =>
    tradeView.value === "grouped"
        ? sortedGrouped.value.length
        : visible.value.length
);

const currentPage = ref(1);

const paginatedIndividual = computed(() => {
    const ipp = userSettings.value.tradesItemsPerPage || 20;
    if (ipp === "all") return visible.value;
    const start = (currentPage.value - 1) * ipp;
    return visible.value.slice(start, start + ipp);
});

const paginatedGrouped = computed(() => {
    const ipp = userSettings.value.tradesItemsPerPage || 20;
    if (ipp === "all") return sortedGrouped.value;
    const start = (currentPage.value - 1) * ipp;
    return sortedGrouped.value.slice(start, start + ipp);
});

const updateItemsPerPage = (val) => {
    userSettings.value.tradesItemsPerPage = val;
    saveSettings();
    currentPage.value = 1;
};

watch([filter, tradeView, showDeleted], () => {
    currentPage.value = 1;
});

watch(tradeView, () => {
    selected.value = new Set();
    pendingAction.value = null;
    if (hdrChk.value) hdrChk.value.indeterminate = false;
    sortCol.value = tradeView.value === "grouped" ? "entryDate" : "date";
    sortDir.value = "desc";
});

const doSort = (col) => {
    if (sortCol.value === col)
        sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
    else {
        sortCol.value = col;
        sortDir.value = "desc";
    }
};

const sortIco = (col) =>
    sortCol.value !== col ? "⇅" : sortDir.value === "asc" ? "↑" : "↓";
const sortCls = (col) =>
    sortCol.value === col ? "text-blue-400" : "text-gray-600";

const isSel = (id) => selected.value.has(id);
const isDel = (id) => deletedArr.value.includes(id);

const toggleSel = (id) => {
    const next = new Set(selected.value);
    next.has(id) ? next.delete(id) : next.add(id);
    selected.value = next;
};

const allChk = computed(
    () =>
        visible.value.length > 0 &&
        visible.value.every((t) => selected.value.has(t.id))
);
const someChk = computed(
    () => visible.value.some((t) => selected.value.has(t.id)) && !allChk.value
);

watch(
    [allChk, someChk],
    async () => {
        await nextTick();
        if (hdrChk.value) hdrChk.value.indeterminate = someChk.value;
    },
    { immediate: true }
);

const toggleAll = () => {
    const all = allChk.value;
    const next = new Set(selected.value);
    visible.value.forEach((t) => (all ? next.delete(t.id) : next.add(t.id)));
    selected.value = next;
};

const selHasActive = computed(() =>
    [...selected.value].some((id) => !deletedArr.value.includes(id))
);
const selHasDeleted = computed(() =>
    [...selected.value].some((id) => deletedArr.value.includes(id))
);

const execBulk = async () => {
    await bulkSetDeleted(selected.value, pendingAction.value === "delete");
    selected.value = new Set();
    pendingAction.value = null;
};

const cols = [
    { key: "symbol", label: "Symbol", right: false },
    { key: "date", label: "Date", right: false },
    { key: "type", label: "Type", right: false },
    { key: "qty", label: "Qty", right: true },
    { key: "price", label: "Avg Price", right: true },
    { key: "pnl", label: "Realized P&L", right: true },
];

const groupedCols = [
    { key: "symbol", label: "Symbol", right: false, sortable: true },
    { key: "entryDate", label: "Entry Date", right: false, sortable: true },
    { key: "entryPrice", label: "Entry Price", right: true, sortable: true },
    { key: "exitDate", label: "Exit Date", right: false, sortable: true },
    { key: "exitPrice", label: "Exit Price", right: true, sortable: true },
    { key: "qty", label: "Qty", right: true, sortable: true },
    { key: "pnl", label: "P&L", right: true, sortable: true },
    { key: "pnlPct", label: "P&L (%)", right: true, sortable: true },
    { key: "status", label: "Status", right: false, sortable: true },
];

const viewOptions = [
    { value: "grouped", label: "Grouped" },
    { value: "individual", label: "Individual" },
];
</script>

<template>
    <div>
        <div class="flex flex-wrap items-center gap-2 mb-4">
            <div class="relative">
                <span
                    class="absolute text-gray-500 text-sm"
                    style="left: 0.75rem; top: 50%; transform: translateY(-50%)"
                    >🔍</span
                >
                <input
                    v-model="filter"
                    placeholder="Filter by ticker…"
                    class="bg-gray-600 border border-gray-500 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    style="padding: 0.5rem 0.75rem 0.5rem 2rem; width: 11rem"
                />
                <button
                    v-if="filter"
                    class="absolute text-gray-400 hover:text-white text-xs"
                    style="right: 0.5rem; top: 50%; transform: translateY(-50%)"
                    @click="filter = ''"
                >
                    ✕
                </button>
            </div>

            <button
                class="px-3 py-2 text-xs rounded-lg border transition-colors"
                :class="
                    showDeleted
                        ? 'bg-gray-600 border-gray-500 text-white'
                        : 'bg-gray-600 border-gray-500 text-gray-400 hover:text-white'
                "
                @click="showDeleted = !showDeleted"
            >
                {{ showDeleted ? "Showing all" : "Active only" }}
            </button>

            <div class="flex-1" />

            <template v-if="selected.size > 0 && !pendingAction">
                <div
                    class="flex items-center gap-2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-xs"
                >
                    <span class="text-gray-300 font-medium"
                        >{{ selected.size }} selected</span
                    >
                    <button
                        v-if="selHasActive"
                        class="bg-red-700 hover:bg-red-600 text-red-100 px-2 py-1 rounded"
                        @click="pendingAction = 'delete'"
                    >
                        Delete
                    </button>
                    <button
                        v-if="selHasDeleted"
                        class="bg-green-800 hover:bg-green-700 text-green-200 px-2 py-1 rounded"
                        @click="pendingAction = 'restore'"
                    >
                        Restore
                    </button>
                    <button
                        class="text-gray-400 hover:text-white ml-1"
                        @click="selected = new Set()"
                    >
                        ✕
                    </button>
                </div>
            </template>

            <template v-if="pendingAction">
                <div
                    class="flex items-center gap-2 bg-gray-700 border border-yellow-700 rounded-lg px-3 py-1 text-xs"
                >
                    <span class="text-yellow-300 font-medium"
                        >{{
                            pendingAction === "delete" ? "Delete" : "Restore"
                        }}
                        {{ selected.size }} trade(s)?</span
                    >
                    <button
                        class="px-2 py-1 rounded font-medium text-white"
                        :class="
                            pendingAction === 'delete'
                                ? 'bg-red-700 hover:bg-red-600'
                                : 'bg-green-700 hover:bg-green-600'
                        "
                        @click="execBulk"
                    >
                        Confirm
                    </button>
                    <button
                        class="text-gray-400 hover:text-white"
                        @click="pendingAction = null"
                    >
                        Cancel
                    </button>
                </div>
            </template>

            <span class="text-gray-500 text-xs">{{ rowCount }} shown</span>

            <div class="flex items-center text-xs text-gray-400 gap-1">
                <span>View:</span>
                <select
                    v-model="tradeView"
                    class="bg-gray-600 border border-gray-500 rounded-lg text-xs text-white px-2 py-1 focus:outline-none"
                >
                    <option
                        v-for="o in viewOptions"
                        :key="o.value"
                        :value="o.value"
                    >
                        {{ o.label }}
                    </option>
                </select>
            </div>
        </div>

        <div
            class="bg-gray-800 rounded-xl overflow-hidden border border-gray-700"
        >
            <div class="overflow-x-auto">
                <table v-if="tradeView === 'individual'" class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-gray-700">
                            <th class="px-4 py-3 w-10">
                                <input
                                    ref="hdrChk"
                                    type="checkbox"
                                    :checked="allChk"
                                    @change="toggleAll"
                                />
                            </th>
                            <th
                                v-for="c in cols"
                                :key="c.key"
                                class="px-4 py-3 font-medium cursor-pointer select-none hover:text-white transition-colors text-gray-400"
                                :class="c.right ? 'text-right' : 'text-left'"
                                @click="doSort(c.key)"
                            >
                                <span class="flex items-center gap-1">
                                    {{ c.label }}
                                    <span
                                        class="text-xs"
                                        :class="sortCls(c.key)"
                                        >{{ sortIco(c.key) }}</span
                                    >
                                </span>
                            </th>
                            <th
                                class="px-4 py-3 text-center text-gray-400 font-medium"
                            >
                                Action
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="t in paginatedIndividual"
                            :key="t.id"
                            class="border-b border-gray-700 cursor-pointer transition-colors"
                            :class="[
                                isSel(t.id)
                                    ? 'bg-blue-900 bg-opacity-40'
                                    : 'hover:bg-gray-700',
                                isDel(t.id) ? 'opacity-40' : '',
                            ]"
                            @click="toggleSel(t.id)"
                        >
                            <td class="px-4 py-2" @click.stop>
                                <input
                                    type="checkbox"
                                    :checked="isSel(t.id)"
                                    @change="toggleSel(t.id)"
                                />
                            </td>
                            <td class="px-4 py-2">
                                <div class="flex items-center gap-2">
                                    <span class="font-semibold text-blue-400">{{
                                        t.symbol
                                    }}</span>
                                    <a
                                        :href="`https://tradingview.com/chart/?symbol=${encodeURIComponent(
                                            t.symbol
                                        )}`"
                                        class="text-gray-400 hover:text-white"
                                        style="border: none"
                                        title="Open on TradingView"
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            class="h-3.6 w-3.6 rounded external-link text-black"
                                            viewBox="0 0 16 16"
                                            width="16px"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="1.2"
                                        >
                                            <path
                                                d="M5 11l6-6"
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                            />
                                            <path
                                                d="M5 5h6v6"
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                            />
                                        </svg>
                                    </a>
                                </div>
                                <div
                                    class="text-xs text-gray-500 truncate"
                                    style="max-width: 8rem"
                                >
                                    {{ t.description }}
                                </div>
                            </td>
                            <td class="px-4 py-2 text-gray-300 text-xs">
                                {{ formatDateTime(t.date) }}
                            </td>
                            <td class="px-4 py-2">
                                <span
                                    class="trade-type-pill px-2 py-1 rounded text-xs font-bold"
                                    :class="
                                        t.type === 'BUY'
                                            ? 'bg-green-900 text-green-300'
                                            : 'bg-red-900 text-red-300'
                                    "
                                    >{{ t.type }}</span
                                >
                            </td>
                            <td class="px-4 py-2 text-right text-gray-300">
                                {{ t.quantity.toFixed(2) }}
                            </td>
                            <td class="px-4 py-2 text-right text-gray-300">
                                {{ fmt(t.avgPrice, t.currency) }}
                            </td>
                            <td
                                class="px-4 py-2 text-right font-semibold"
                                :class="
                                    t.type === 'SELL'
                                        ? t.pnl >= 0
                                            ? 'text-green-400'
                                            : 'text-red-400'
                                        : 'text-gray-600'
                                "
                            >
                                {{
                                    t.type === "SELL"
                                        ? fmtPnl(t.pnl, t.currency)
                                        : "—"
                                }}
                            </td>
                            <td class="px-4 py-2 text-center" @click.stop>
                                <button
                                    class="text-xs px-2 py-1 rounded transition-colors"
                                    :class="
                                        isDel(t.id)
                                            ? 'bg-green-800 hover:bg-green-700 text-green-200'
                                            : 'bg-gray-700 hover:bg-red-800 text-gray-400 hover:text-red-200'
                                    "
                                    @click="toggleDelete(t.id)"
                                >
                                    {{ isDel(t.id) ? "Restore" : "Delete" }}
                                </button>
                            </td>
                        </tr>

                        <tr v-if="visible.length === 0">
                            <td colspan="8" class="px-4 py-16 text-center">
                                <div class="text-4xl mb-3">
                                    {{ trades.length === 0 ? "📂" : "🔍" }}
                                </div>
                                <div class="text-gray-400 text-sm">
                                    {{
                                        trades.length === 0
                                            ? "No trades yet. Upload a CSV export from IBKR."
                                            : "No trades match your filter."
                                    }}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <table v-else class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-gray-700">
                            <th
                                v-for="c in groupedCols"
                                :key="c.key"
                                class="px-4 py-3 font-medium cursor-pointer select-none hover:text-white transition-colors text-gray-400"
                                :class="[
                                    c.right ? 'text-right' : 'text-left',
                                    c.sortable
                                        ? ''
                                        : 'cursor-default hover:text-gray-400',
                                ]"
                                @click="c.sortable && doSort(c.key)"
                            >
                                <span class="flex items-center gap-1">
                                    {{ c.label }}
                                    <span
                                        v-if="c.sortable"
                                        class="text-xs"
                                        :class="sortCls(c.key)"
                                        >{{ sortIco(c.key) }}</span
                                    >
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="t in paginatedGrouped"
                            :key="t.id"
                            class="border-b border-gray-700 hover:bg-gray-700"
                        >
                            <td class="px-4 py-2 font-semibold text-blue-400">
                                <div class="flex items-center gap-2">
                                    <span>{{ t.symbol }}</span>
                                    <a
                                        :href="`https://tradingview.com/chart/?symbol=${encodeURIComponent(
                                            t.symbol
                                        )}`"
                                        class="text-gray-400 hover:text-white"
                                        style="border: none"
                                        title="Open on TradingView"
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            class="h-3.6 w-3.6 rounded external-link text-black"
                                            viewBox="0 0 16 16"
                                            width="16px"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="1.2"
                                        >
                                            <path
                                                d="M5 11l6-6"
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                            />
                                            <path
                                                d="M5 5h6v6"
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                            />
                                        </svg>
                                    </a>
                                </div>
                                <div
                                    class="text-xs text-gray-500 truncate"
                                    style="max-width: 8rem"
                                >
                                    {{ t.description }}
                                </div>
                            </td>
                            <td class="px-4 py-2 text-xs text-gray-300">
                                {{ formatDateTime(t.entryDate) }}
                            </td>
                            <td class="px-4 py-2 text-right text-gray-300">
                                {{
                                    t.entryPrice
                                        ? fmt(t.entryPrice, t.currency)
                                        : "—"
                                }}
                            </td>
                            <td class="px-4 py-2 text-xs text-gray-300">
                                {{
                                    t.exitDate
                                        ? formatDateTime(t.exitDate)
                                        : "—"
                                }}
                            </td>
                            <td class="px-4 py-2 text-right text-gray-300">
                                {{
                                    t.exitPrice
                                        ? fmt(t.exitPrice, t.currency)
                                        : "—"
                                }}
                            </td>
                            <td class="px-4 py-2 text-right text-gray-300">
                                {{ t.qty?.toFixed(2) || "0.00" }}
                            </td>
                            <td
                                class="px-4 py-2 text-right font-semibold"
                                :class="
                                    t.pnl === null
                                        ? 'text-gray-500'
                                        : t.pnl >= 0
                                        ? 'text-green-400'
                                        : 'text-red-400'
                                "
                            >
                                {{
                                    t.pnl !== null
                                        ? fmtPnl(t.pnl, t.currency)
                                        : "–"
                                }}
                            </td>
                            <td
                                class="px-4 py-2 text-right font-semibold"
                                :class="
                                    t.pnlPct === null
                                        ? 'text-gray-500'
                                        : t.pnlPct >= 0
                                        ? 'text-green-400'
                                        : 'text-red-400'
                                "
                            >
                                {{ t.pnlPct !== null ? fmtPct(t.pnlPct) : "–" }}
                            </td>
                            <td
                                class="px-4 py-2 text-center text-xs uppercase text-gray-400"
                            >
                                <span
                                    v-if="t.status === 'open'"
                                    class="text-yellow-300"
                                    >Open</span
                                >
                                <span v-else class="text-blue-300">Closed</span>
                            </td>
                        </tr>

                        <tr v-if="!groupedTrades.length">
                            <td colspan="9" class="px-4 py-16 text-center">
                                <div class="text-4xl mb-3">
                                    {{ trades.length === 0 ? "📂" : "🔍" }}
                                </div>
                                <div class="text-gray-400 text-sm">
                                    {{
                                        trades.length === 0
                                            ? "No trades yet. Upload a CSV export from IBKR."
                                            : "No trades match your filter."
                                    }}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div
                v-if="trades.length"
                class="px-4 py-3 bg-gray-900 border-t border-gray-700 flex justify-end"
            >
                <button
                    type="button"
                    class="text-xs text-white bg-red-600 hover:bg-red-500 border border-red-800 px-3 py-1 rounded transition-colors"
                    @click="hardDeleteAll"
                >
                    Permanently Delete All
                </button>
            </div>

            <AppPagination
                :total-items="rowCount"
                :items-per-page="userSettings.tradesItemsPerPage"
                v-model="currentPage"
                @update:items-per-page="updateItemsPerPage"
            />
        </div>
    </div>
</template>
