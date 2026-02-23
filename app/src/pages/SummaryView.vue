<script setup>
import { computed, ref } from "vue";
import DateRangePicker from "../components/DateRangePicker.vue";
import AppPagination from "../components/AppPagination.vue";
import {
    TODAY,
    calcPnlPct,
    fmt,
    fmtPct,
    fmtPnl,
    formatDateTime,
    pad2,
} from "../helpers";
import { sells, userSettings, saveSettings } from "../state";

const now = new Date();
const sumStart = ref(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`);
const sumEnd = ref(TODAY);

const sumSells = computed(() =>
    sells.value.filter(
        (t) =>
            (!sumStart.value || t.date >= sumStart.value) &&
            (!sumEnd.value || t.date <= sumEnd.value)
    )
);

const sumSortCol = ref("date");
const sumSortDir = ref("desc");

const sumSortMap = {
    symbol: (t) => t.symbol || "",
    date: (t) => t.date || "",
    qty: (t) => t.quantity || 0,
    avgPrice: (t) => t.avgPrice || 0,
    pnl: (t) => t.pnl || 0,
    pnlPct: (t) => t.pnlPct ?? -Infinity,
    result: (t) => (t.pnl >= 0 ? 1 : 0),
};

const doSumSort = (col) => {
    if (sumSortCol.value === col)
        sumSortDir.value = sumSortDir.value === "asc" ? "desc" : "asc";
    else {
        sumSortCol.value = col;
        sumSortDir.value = col === "date" ? "desc" : "asc";
    }
};

const sumSortIco = (col) =>
    sumSortCol.value !== col ? "⇅" : sumSortDir.value === "asc" ? "↑" : "↓";

const sumSortCls = (col) =>
    sumSortCol.value === col ? "text-blue-400" : "text-gray-600";
const totalPnl = computed(() => sumSells.value.reduce((s, t) => s + t.pnl, 0));
const wins = computed(() => sumSells.value.filter((t) => t.pnl > 0));
const losses = computed(() => sumSells.value.filter((t) => t.pnl <= 0));
const winRate = computed(() =>
    sumSells.value.length
        ? (wins.value.length / sumSells.value.length) * 100
        : 0
);
const avgWin = computed(() =>
    wins.value.length
        ? wins.value.reduce((s, t) => s + t.pnl, 0) / wins.value.length
        : 0
);
const avgLoss = computed(() =>
    losses.value.length
        ? losses.value.reduce((s, t) => s + t.pnl, 0) / losses.value.length
        : 0
);

const cards = computed(() => {
    const currency = sumSells.value[0]?.currency || "USD";
    return [
        {
            label: "Total P&L",
            val: fmtPnl(totalPnl.value, currency),
            color: totalPnl.value >= 0 ? "text-green-400" : "text-red-400",
            sub: `${sumSells.value.length} sells`,
        },
        {
            label: "Win Rate",
            val: `${winRate.value.toFixed(1)}%`,
            color: "text-blue-400",
            sub: `${wins.value.length}W / ${losses.value.length}L`,
        },
        {
            label: "Avg Win",
            val: wins.value.length
                ? `+${currency === "EUR" ? "€" : "$"}${avgWin.value.toFixed(2)}`
                : "—",
            color: "text-green-400",
            sub: "per winning trade",
        },
        {
            label: "Avg Loss",
            val: losses.value.length
                ? `-${currency === "EUR" ? "€" : "$"}${Math.abs(
                      avgLoss.value
                  ).toFixed(2)}`
                : "—",
            color: "text-red-400",
            sub: "per losing trade",
        },
    ];
});

const sumRows = computed(() =>
    sumSells.value.map((t) => ({
        ...t,
        pnlPct: calcPnlPct(t.pnl, t.avgPrice * t.quantity),
    }))
);

const sorted = computed(() => {
    const accessor =
        sumSortMap[sumSortCol.value] || ((t) => t[sumSortCol.value]);
    return [...sumRows.value].sort((a, b) => {
        const av = accessor(a);
        const bv = accessor(b);
        if (av < bv) return sumSortDir.value === "asc" ? -1 : 1;
        if (av > bv) return sumSortDir.value === "asc" ? 1 : -1;
        return 0;
    });
});

const onRange = (start, end) => {
    sumStart.value = start;
    sumEnd.value = end;
};

const currentPage = ref(1);
const paginatedRows = computed(() => {
    const ipp = userSettings.value.summaryItemsPerPage || 20;
    if (ipp === "all") return sorted.value;
    const start = (currentPage.value - 1) * ipp;
    return sorted.value.slice(start, start + ipp);
});

const updateItemsPerPage = (val) => {
    userSettings.value.summaryItemsPerPage = val;
    saveSettings();
};
</script>

<template>
    <div>
        <div class="flex items-center gap-3 mb-5 flex-col sm:flex-row">
            <DateRangePicker
                :start="sumStart"
                :end="sumEnd"
                @change="onRange"
            />
            <span v-if="sumStart" class="text-xs text-gray-400"
                >{{ sumSells.length }} sell trades</span
            >
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div
                v-for="c in cards"
                :key="c.label"
                class="bg-gray-800 border border-gray-700 rounded-xl p-3 sm:p-4"
            >
                <div class="summary-card-label text-gray-400 text-xs mb-1">
                    {{ c.label }}
                </div>
                <div
                    class="summary-card-value text-2xl font-bold"
                    :class="c.color"
                >
                    {{ c.val }}
                </div>
                <div class="summary-card-sub text-gray-500 text-xs mt-1">
                    {{ c.sub }}
                </div>
            </div>
        </div>

        <div
            class="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden"
        >
            <div
                class="px-4 py-3 border-b border-gray-700 text-sm font-medium text-gray-300"
            >
                Sell Trades{{
                    sumStart && sumEnd ? ` · ${sumStart} → ${sumEnd}` : ""
                }}
            </div>

            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-gray-700">
                            <th
                                class="px-4 py-2 text-left text-gray-400 font-medium cursor-pointer select-none hover:text-white"
                                @click="doSumSort('symbol')"
                            >
                                Symbol
                                <span
                                    class="text-xs ml-1"
                                    :class="sumSortCls('symbol')"
                                    >{{ sumSortIco("symbol") }}</span
                                >
                            </th>
                            <th
                                class="px-4 py-2 text-left text-gray-400 font-medium cursor-pointer select-none hover:text-white"
                                @click="doSumSort('date')"
                            >
                                Date
                                <span
                                    class="text-xs ml-1"
                                    :class="sumSortCls('date')"
                                    >{{ sumSortIco("date") }}</span
                                >
                            </th>
                            <th
                                class="px-4 py-2 text-right text-gray-400 font-medium cursor-pointer select-none hover:text-white"
                                @click="doSumSort('qty')"
                            >
                                Qty
                                <span
                                    class="text-xs ml-1"
                                    :class="sumSortCls('qty')"
                                    >{{ sumSortIco("qty") }}</span
                                >
                            </th>
                            <th
                                class="px-4 py-2 text-right text-gray-400 font-medium cursor-pointer select-none hover:text-white"
                                @click="doSumSort('avgPrice')"
                            >
                                Avg Price
                                <span
                                    class="text-xs ml-1"
                                    :class="sumSortCls('avgPrice')"
                                    >{{ sumSortIco("avgPrice") }}</span
                                >
                            </th>
                            <th
                                class="px-4 py-2 text-right text-gray-400 font-medium cursor-pointer select-none hover:text-white"
                                @click="doSumSort('pnl')"
                            >
                                P&L
                                <span
                                    class="text-xs ml-1"
                                    :class="sumSortCls('pnl')"
                                    >{{ sumSortIco("pnl") }}</span
                                >
                            </th>
                            <th
                                class="px-4 py-2 text-right text-gray-400 font-medium cursor-pointer select-none hover:text-white"
                                @click="doSumSort('pnlPct')"
                            >
                                P&L (%)
                                <span
                                    class="text-xs ml-1"
                                    :class="sumSortCls('pnlPct')"
                                    >{{ sumSortIco("pnlPct") }}</span
                                >
                            </th>
                            <th
                                class="px-4 py-2 text-center text-gray-400 font-medium cursor-pointer select-none hover:text-white"
                                @click="doSumSort('result')"
                            >
                                Result
                                <span
                                    class="text-xs ml-1"
                                    :class="sumSortCls('result')"
                                    >{{ sumSortIco("result") }}</span
                                >
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="t in paginatedRows"
                            :key="t.id"
                            class="border-b border-gray-700 hover:bg-gray-700"
                        >
                            <td class="px-4 py-2 font-semibold text-blue-400">
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
                            <td class="px-4 py-2 text-right text-gray-300">
                                {{ t.quantity.toFixed(2) }}
                            </td>
                            <td class="px-4 py-2 text-right text-gray-300">
                                {{ fmt(t.avgPrice, t.currency) }}
                            </td>
                            <td
                                class="px-4 py-2 text-right font-semibold"
                                :class="
                                    t.pnl >= 0
                                        ? 'text-green-400'
                                        : 'text-red-400'
                                "
                            >
                                {{ fmtPnl(t.pnl, t.currency) }}
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
                                {{ t.pnlPct !== null ? fmtPct(t.pnlPct) : "—" }}
                            </td>
                            <td class="px-4 py-2 text-center">
                                <span
                                    class="inline-block text-xs px-2 py-1 rounded font-medium"
                                    :class="
                                        t.pnl >= 0
                                            ? 'bg-green-900 text-green-300'
                                            : 'bg-red-900 text-red-300'
                                    "
                                    >{{ t.pnl >= 0 ? "✓ Win" : "✗ Loss" }}</span
                                >
                            </td>
                        </tr>

                        <tr v-if="!sorted.length">
                            <td
                                colspan="7"
                                class="px-4 py-10 text-center text-gray-500"
                            >
                                No sell trades for this period.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <AppPagination
                :total-items="sorted.length"
                :items-per-page="userSettings.summaryItemsPerPage"
                v-model="currentPage"
                @update:items-per-page="updateItemsPerPage"
            />
        </div>
    </div>
</template>
