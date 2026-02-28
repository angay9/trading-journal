<script setup>
import { computed, ref, watch } from "vue";
import {
    MONTHS,
    calcPnlPct,
    fmt,
    fmtPct,
    fmtPnl,
    pad2,
} from "../helpers";
import { sells } from "../state";

const now = new Date();
const calMonth = ref(now.getMonth() + 1);
const calYear = ref(now.getFullYear());
const calSelectedDays = ref([]);
const calRangeAnchor = ref(null);
const calSelections = ref({});
const currentMonthKey = computed(
    () => `${calYear.value}-${pad2(calMonth.value)}`
);

const applySelection = (days, anchor = null) => {
    const unique = [...new Set(days)].sort((a, b) => a - b);
    calSelectedDays.value = unique;
    calRangeAnchor.value =
        anchor !== null
            ? anchor
            : unique.length
            ? unique[unique.length - 1]
            : null;

    const next = { ...calSelections.value };
    if (unique.length) {
        next[currentMonthKey.value] = unique;
    } else {
        delete next[currentMonthKey.value];
    }
    calSelections.value = next;
};

watch(
    currentMonthKey,
    (key) => {
        const saved = calSelections.value[key] || [];
        calSelectedDays.value = saved;
        calRangeAnchor.value = saved.length
            ? saved[saved.length - 1]
            : null;
    },
    { immediate: true }
);

const calSells = computed(() =>
    sells.value.filter(
        (t) =>
            +t.date.slice(0, 4) === calYear.value &&
            +t.date.slice(5, 7) === calMonth.value
    )
);
const dailyPnl = computed(() => {
    const map = {};
    calSells.value.forEach((t) => {
        const d = +t.date.slice(8, 10);
        map[d] = (map[d] || 0) + t.pnl;
    });
    return map;
});

const availableDays = computed(() =>
    new Set(calSells.value.map((t) => +t.date.slice(8, 10)))
);

const selectedDaysSorted = computed(() =>
    [...new Set(calSelectedDays.value)].sort((a, b) => a - b)
);

const selectedDaySet = computed(() => new Set(selectedDaysSorted.value));

const selectedGlobalDates = computed(() => {
    const entries = Object.entries(calSelections.value);
    const dates = [];
    entries.forEach(([ym, days]) => {
        days.forEach((day) => {
            dates.push(`${ym}-${pad2(day)}`);
        });
    });
    return dates.sort((a, b) => a.localeCompare(b));
});

const selectedGlobalDateSet = computed(
    () => new Set(selectedGlobalDates.value)
);

const selectedGlobalTrades = computed(() =>
    selectedGlobalDates.value.length
        ? sells.value.filter((t) => selectedGlobalDateSet.value.has(t.date))
        : []
);

const selectedPnl = computed(() =>
    selectedGlobalTrades.value.reduce((sum, t) => sum + (t.pnl || 0), 0)
);

const selectedYears = computed(() =>
    new Set(selectedGlobalDates.value.map((iso) => iso.slice(0, 4)))
);

const contiguousRange = computed(() => {
    const dates = selectedGlobalDates.value;
    if (dates.length <= 1) return false;
    const msPerDay = 24 * 60 * 60 * 1000;
    for (let i = 1; i < dates.length; i += 1) {
        const prev = new Date(dates[i - 1]);
        const current = new Date(dates[i]);
        if ((current - prev) / msPerDay !== 1) {
            return false;
        }
    }
    return true;
});

const formatMonthDay = (iso, includeYear = false) => {
    const month = MONTHS[Number(iso.slice(5, 7)) - 1];
    const day = iso.slice(8, 10);
    const year = iso.slice(0, 4);
    return `${month} ${day}${includeYear ? ` ${year}` : ""}`;
};

const rangeLabel = computed(() => {
    if (!selectedGlobalDates.value.length) return "";
    if (selectedGlobalDates.value.length === 1) {
        return formatMonthDay(selectedGlobalDates.value[0]);
    }
    const first = selectedGlobalDates.value[0];
    const last = selectedGlobalDates.value.at(-1);
    const includeYear = selectedYears.value.size > 1;
    const startLabel =
        includeYear || first.slice(0, 4) !== last.slice(0, 4)
            ? formatMonthDay(first, true)
            : formatMonthDay(first);
    const endLabel =
        includeYear || first.slice(0, 4) !== last.slice(0, 4)
            ? formatMonthDay(last, true)
            : formatMonthDay(last);
    return `${startLabel} → ${endLabel}`;
});

const listLabel = computed(() => {
    const years = selectedYears.value;
    if (!years.size) return "";
    const grouped = [];
    selectedGlobalDates.value.forEach((iso) => {
        const year = iso.slice(0, 4);
        let group = grouped.find((g) => g.year === year);
        if (!group) {
            group = { year, dates: [] };
            grouped.push(group);
        }
        group.dates.push(iso);
    });

    const includeYear = years.size > 1;
    const parts = grouped.map((group) => {
        const formatted = group.dates.map((iso, idx) => {
            const isLastInGroup = idx === group.dates.length - 1;
            return formatMonthDay(iso, includeYear && isLastInGroup);
        });
        return formatted.join(", ");
    });
    return parts.join(", ");
});

const selectionLabel = computed(() => {
    if (!selectedGlobalDates.value.length) return "";
    if (contiguousRange.value) {
        return rangeLabel.value;
    }
    return listLabel.value;
});

const dims = computed(() => ({
    days: new Date(calYear.value, calMonth.value, 0).getDate(),
    first: new Date(calYear.value, calMonth.value - 1, 1).getDay(),
}));

const dayTrades = computed(() =>
    selectedGlobalDates.value.length ? selectedGlobalTrades.value : []
);

const daySortCol = ref("symbol");
const daySortDir = ref("asc");

const daySortMap = {
    symbol: (t) => t.symbol || "",
    type: (t) => t.type || "",
    qty: (t) => t.quantity || 0,
    avgPrice: (t) => t.avgPrice || 0,
    pnl: (t) => t.pnl || 0,
    pnlPct: (t) => t.pnlPct ?? -Infinity,
    result: (t) => (t.pnl >= 0 ? 1 : 0),
};

const doDaySort = (col) => {
    if (daySortCol.value === col)
        daySortDir.value = daySortDir.value === "asc" ? "desc" : "asc";
    else {
        daySortCol.value = col;
        daySortDir.value = col === "pnl" ? "desc" : "asc";
    }
};

const daySortIco = (col) =>
    daySortCol.value !== col ? "⇅" : daySortDir.value === "asc" ? "↑" : "↓";

const daySortCls = (col) =>
    daySortCol.value === col ? "text-blue-400" : "text-gray-600";

const sortedDayTrades = computed(() => {
    const accessor =
        daySortMap[daySortCol.value] || ((t) => t[daySortCol.value]);
    const rows = dayTrades.value.map((t) => ({
        ...t,
        pnlPct:
            t.type === "SELL"
                ? calcPnlPct(t.pnl, t.avgPrice * t.quantity)
                : null,
    }));

    return [...rows].sort((a, b) => {
        const av = accessor(a);
        const bv = accessor(b);
        if (av < bv) return daySortDir.value === "asc" ? -1 : 1;
        if (av > bv) return daySortDir.value === "asc" ? 1 : -1;
        return 0;
    });
});

const prev = () => {
    if (calMonth.value === 1) {
        calMonth.value = 12;
        calYear.value -= 1;
    } else calMonth.value -= 1;
};

const next = () => {
    if (calMonth.value === 12) {
        calMonth.value = 1;
        calYear.value += 1;
    } else calMonth.value += 1;
};

const clickDay = (day, event) => {
    if (!availableDays.value.has(day)) return;
    const ctrl = event?.metaKey || event?.ctrlKey;
    const shift = event?.shiftKey;
    if (shift) {
        const anchor = calRangeAnchor.value ?? day;
        const [from, to] =
            anchor <= day ? [anchor, day] : [day, anchor];
        const range = [];
        for (let d = from; d <= to; d += 1) {
            if (availableDays.value.has(d)) {
                range.push(d);
            }
        }
        applySelection(range, anchor);
        return;
    }

    if (ctrl) {
        const next = new Set(calSelectedDays.value);
        if (next.has(day)) {
            next.delete(day);
        } else {
            next.add(day);
        }
        const result = [...next].sort((a, b) => a - b);
        applySelection(result, result.length ? day : null);
        return;
    }

    if (
        calSelectedDays.value.length === 1 &&
        calSelectedDays.value[0] === day
    ) {
        applySelection([], null);
    } else {
        applySelection([day], day);
    }
};

const clearSelection = () => {
    applySelection([], null);
};
</script>

<template>
    <div>
        <div class="flex items-center gap-2 sm:gap-4 mb-4">
            <button
                class="calendar-nav-btn w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white"
                @click="prev"
            >
                ‹
            </button>
            <span
                class="text-sm sm:text-md font-semibold text-white"
                style="width: 9rem; text-align: center"
                >{{ MONTHS[calMonth - 1] }} {{ calYear }}</span
            >
            <button
                class="calendar-nav-btn w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white"
                @click="next"
            >
                ›
            </button>
            <div class="flex gap-4 ml-4">
                <div class="flex items-center gap-1 text-xs text-gray-400">
                    <div
                        class="w-3 h-3 rounded bg-green-900 border border-green-600"
                    />
                    Profit
                </div>
                <div class="flex items-center gap-1 text-xs text-gray-400">
                    <div
                        class="w-3 h-3 rounded bg-red-900 border border-red-700"
                    />
                    Loss
                </div>
            </div>
            <button
                v-if="selectedGlobalDates.length"
                class="calendar-clear-btn ml-auto text-xs text-gray-400 hover:text-white border border-gray-600 px-2 py-1 rounded transition-colors"
                @click="clearSelection"
            >
                Clear selection
            </button>
        </div>

        <div
            class="bg-gray-800 border border-gray-700 rounded-xl calendar-board p-4 mb-4"
        >
            <div class="grid grid-cols-7 mb-1">
                <div
                    v-for="d in [
                        'Sun',
                        'Mon',
                        'Tue',
                        'Wed',
                        'Thu',
                        'Fri',
                        'Sat',
                    ]"
                    :key="d"
                    class="text-center text-xs text-gray-500 py-2 font-medium"
                >
                    {{ d }}
                </div>
            </div>
            <div class="grid grid-cols-7 gap-1">
                <div v-for="i in dims.first" :key="`e${i}`" />
                <div
                    v-for="day in dims.days"
                    :key="day"
                    class="calendar-day-cell min-h-14 rounded-lg p-2 flex flex-col border transition-colors break-all"
                    :class="[
                        availableDays.has(day) ? 'cursor-pointer' : '',
                        selectedDaySet.has(day) ? 'ring-2 ring-blue-400' : '',
                        dailyPnl[day] !== undefined
                            ? dailyPnl[day] >= 0
                                ? 'bg-green-900 border-green-700 hover:bg-green-800'
                                : 'bg-red-900 border-red-800 hover:bg-red-800'
                            : 'bg-gray-700 border-gray-600 hover:bg-gray-600',
                    ]"
                    @click="clickDay(day, $event)"
                >
                    <span class="text-xs text-gray-400 font-medium">{{
                        day
                    }}</span>
                    <span
                        v-if="dailyPnl[day] !== undefined"
                        class="text-xs font-bold mt-auto calendar-pnl"
                        :class="
                            dailyPnl[day] >= 0
                                ? 'text-green-300'
                                : 'text-red-300'
                        "
                    >
                        {{ dailyPnl[day] >= 0 ? "+" : "-"
                        }}{{
                            calSells.find((t) => +t.date.slice(8, 10) === day)
                                ?.currency === "EUR"
                                ? "€"
                                : "$"
                        }}{{ Math.abs(dailyPnl[day]).toFixed(2) }}
                    </span>
                </div>
            </div>
        </div>

        <div
            v-if="selectedGlobalDates.length"
            class="bg-gray-800 border border-blue-700 rounded-xl overflow-hidden mb-4"
        >
            <div
                class="px-4 py-3 border-b border-gray-700 flex items-center justify-between"
            >
                <span class="text-sm font-semibold text-white"
                    >{{ selectionLabel }} —
                    {{ dayTrades.length }} trade{{
                        dayTrades.length !== 1 ? "s" : ""
                    }}</span
                >
                <span
                    class="text-sm font-bold"
                    :class="
                        selectedPnl >= 0 ? 'text-green-400' : 'text-red-400'
                    "
                    >{{
                        fmtPnl(selectedPnl, dayTrades[0]?.currency)
                    }}</span
                >
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-gray-700">
                            <th
                                class="px-4 py-2 text-left text-gray-400 font-medium cursor-pointer select-none hover:text-white"
                                @click="doDaySort('symbol')"
                            >
                                Symbol
                                <span
                                    class="text-xs ml-1"
                                    :class="daySortCls('symbol')"
                                    >{{ daySortIco("symbol") }}</span
                                >
                            </th>
                            <th
                                class="px-4 py-2 text-left text-gray-400 font-medium cursor-pointer select-none hover:text-white"
                                @click="doDaySort('type')"
                            >
                                Type
                                <span
                                    class="text-xs ml-1"
                                    :class="daySortCls('type')"
                                    >{{ daySortIco("type") }}</span
                                >
                            </th>
                            <th
                                class="px-4 py-2 text-right text-gray-400 font-medium cursor-pointer select-none hover:text-white"
                                @click="doDaySort('qty')"
                            >
                                Qty
                                <span
                                    class="text-xs ml-1"
                                    :class="daySortCls('qty')"
                                    >{{ daySortIco("qty") }}</span
                                >
                            </th>
                            <th
                                class="px-4 py-2 text-right text-gray-400 font-medium cursor-pointer select-none hover:text-white"
                                @click="doDaySort('avgPrice')"
                            >
                                Avg Price
                                <span
                                    class="text-xs ml-1"
                                    :class="daySortCls('avgPrice')"
                                    >{{ daySortIco("avgPrice") }}</span
                                >
                            </th>
                            <th
                                class="px-4 py-2 text-right text-gray-400 font-medium cursor-pointer select-none hover:text-white"
                                @click="doDaySort('pnl')"
                            >
                                P&L
                                <span
                                    class="text-xs ml-1"
                                    :class="daySortCls('pnl')"
                                    >{{ daySortIco("pnl") }}</span
                                >
                            </th>
                            <th
                                class="px-4 py-2 text-right text-gray-400 font-medium cursor-pointer select-none hover:text-white"
                                @click="doDaySort('pnlPct')"
                            >
                                P&L (%)
                                <span
                                    class="text-xs ml-1"
                                    :class="daySortCls('pnlPct')"
                                    >{{ daySortIco("pnlPct") }}</span
                                >
                            </th>
                            <th
                                class="px-4 py-2 text-center text-gray-400 font-medium cursor-pointer select-none hover:text-white"
                                @click="doDaySort('result')"
                            >
                                Result
                                <span
                                    class="text-xs ml-1"
                                    :class="daySortCls('result')"
                                    >{{ daySortIco("result") }}</span
                                >
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="t in sortedDayTrades"
                            :key="t.id"
                            class="border-b border-gray-700 hover:bg-gray-700"
                        >
                            <td class="px-4 py-2 font-semibold text-blue-400">
                                <div class="flex items-center gap-2">
                                    {{ t.symbol }}
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
                            <td class="px-4 py-2">
                                <span
                                    class="px-2 py-1 rounded text-xs font-bold"
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
                            <td
                                class="px-4 py-2 text-right font-semibold"
                                :class="
                                    t.type === 'SELL'
                                        ? t.pnlPct >= 0
                                            ? 'text-green-400'
                                            : 'text-red-400'
                                        : 'text-gray-600'
                                "
                            >
                                {{
                                    t.type === "SELL" && t.pnlPct !== null
                                        ? fmtPct(t.pnlPct)
                                        : "—"
                                }}
                            </td>
                            <td class="px-4 py-2 text-center">
                                <template v-if="t.type === 'SELL'">
                                    <span
                                        class="inline-block text-xs px-2 py-1 rounded font-medium"
                                        :class="
                                            t.pnl >= 0
                                                ? 'bg-green-900 text-green-300'
                                                : 'bg-red-900 text-red-300'
                                        "
                                        >{{
                                            t.pnl >= 0 ? "✓ Win" : "✗ Loss"
                                        }}</span
                                    >
                                </template>
                                <span v-else class="text-xs text-gray-600"
                                    >—</span
                                >
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div
            v-if="calSells.length && !selectedGlobalDates.length"
            class="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden"
        >
            <div
                class="px-4 py-3 border-b border-gray-700 text-sm font-medium text-gray-300"
            >
                Daily Breakdown — {{ MONTHS[calMonth - 1] }} {{ calYear }}
            </div>
            <div
                v-for="[day, pnl] in Object.entries(dailyPnl).sort(
                    (a, b) => +a[0] - +b[0]
                )"
                :key="day"
                class="px-4 py-2 border-b border-gray-700 flex items-center justify-between hover:bg-gray-700 cursor-pointer transition-colors"
                @click="clickDay(+day, $event)"
            >
                <div>
                    <span
                        class="calendar-day-label text-gray-300 text-sm font-medium"
                        >{{ MONTHS[calMonth - 1] }} {{ day }}</span
                    >
                    <span class="text-gray-500 text-xs ml-2"
                        >({{
                            calSells
                                .filter((t) => +t.date.slice(8, 10) === +day)
                                .map((t) => t.symbol)
                                .join(", ")
                        }})</span
                    >
                </div>
                <div class="flex items-center gap-3">
                    <span
                        class="font-semibold text-sm"
                        :class="pnl >= 0 ? 'text-green-400' : 'text-red-400'"
                        >{{
                            fmtPnl(
                                pnl,
                                calSells.find(
                                    (t) => +t.date.slice(8, 10) === +day
                                )?.currency
                            )
                        }}</span
                    >
                    <span class="text-gray-600 text-xs">→</span>
                </div>
            </div>
        </div>
    </div>
</template>
