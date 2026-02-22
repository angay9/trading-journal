<script setup>
import { computed, ref } from "vue";
import { MONTHS, TODAY, pad2, toISO } from "../helpers";

const props = defineProps({ start: String, end: String });
const emit = defineEmits(["change"]);

const open = ref(false);
const hov = ref(null);
const now = new Date();
const view = ref({ year: now.getFullYear(), month: now.getMonth() });

const dims = computed(() => ({
    days: new Date(view.value.year, view.value.month + 1, 0).getDate(),
    first: new Date(view.value.year, view.value.month, 1).getDay(),
}));

const prev = () => {
    if (view.value.month === 0)
        view.value = { year: view.value.year - 1, month: 11 };
    else view.value = { ...view.value, month: view.value.month - 1 };
};

const next = () => {
    if (view.value.month === 11)
        view.value = { year: view.value.year + 1, month: 0 };
    else view.value = { ...view.value, month: view.value.month + 1 };
};

const iso = (day) =>
    `${view.value.year}-${pad2(view.value.month + 1)}-${pad2(day)}`;
const clickDay = (d) => {
    if (!props.start || (props.start && props.end)) emit("change", d, null);
    else {
        emit(
            "change",
            d < props.start ? d : props.start,
            d < props.start ? props.start : d
        );
        open.value = false;
        hov.value = null;
    }
};

const isSt = (d) => d === props.start;
const isEn = (d) =>
    d === props.end || (!props.end && hov.value && d === hov.value);
const inRng = (d) => {
    const e = hov.value || props.end;
    if (!props.start || !e) return false;
    const [lo, hi] = props.start <= e ? [props.start, e] : [e, props.start];
    return d > lo && d < hi;
};

const label = computed(() =>
    props.start && props.end
        ? `${props.start} → ${props.end}`
        : props.start
        ? `${props.start} → …`
        : "Select date range"
);

const quick = [
    {
        l: "This month",
        f: () => {
            const n = new Date();
            emit(
                "change",
                `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-01`,
                TODAY
            );
            open.value = false;
        },
    },
    {
        l: "Last month",
        f: () => {
            const n = new Date();
            n.setDate(1);
            n.setMonth(n.getMonth() - 1);
            const e = new Date(n.getFullYear(), n.getMonth() + 1, 0);
            emit("change", toISO(n), toISO(e));
            open.value = false;
        },
    },
    {
        l: "Last 7 days",
        f: () => {
            const s = new Date();
            s.setDate(s.getDate() - 6);
            emit("change", toISO(s), TODAY);
            open.value = false;
        },
    },
    {
        l: "Last 30 days",
        f: () => {
            const s = new Date();
            s.setDate(s.getDate() - 29);
            emit("change", toISO(s), TODAY);
            open.value = false;
        },
    },
    {
        l: "This year",
        f: () => {
            emit("change", `${new Date().getFullYear()}-01-01`, TODAY);
            open.value = false;
        },
    },
    {
        l: "All time",
        f: () => {
            emit("change", "2000-01-01", TODAY);
            open.value = false;
        },
    },
];

const clearRange = () => emit("change", null, null);
</script>

<template>
    <div class="relative">
        <button
            class="flex items-center gap-2 bg-gray-700 border border-gray-600 hover:border-blue-500 rounded-lg px-3 py-2 text-sm text-white transition-colors"
            style="min-width: 220px"
            @click="open = !open"
        >
            <span class="text-gray-400">📅</span>
            <span :class="props.start ? 'text-white' : 'text-gray-400'">{{
                label
            }}</span>
            <span class="ml-auto text-gray-500 text-xs">{{
                open ? "▲" : "▼"
            }}</span>
        </button>

        <div v-if="open" class="fixed inset-0 z-40" @click="open = false" />

        <div
            v-if="open"
            class="absolute z-50 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl flex"
            style="top: 2.75rem; left: 0; min-width: 480px"
        >
            <div
                class="border-r border-gray-700 p-3 flex flex-col gap-1"
                style="min-width: 130px"
            >
                <div class="text-xs text-gray-500 font-medium mb-1 px-1">
                    Quick select
                </div>
                <button
                    v-for="q in quick"
                    :key="q.l"
                    class="text-left text-xs text-gray-300 hover:text-white hover:bg-gray-700 px-2 py-1 rounded transition-colors whitespace-nowrap"
                    @click.stop="q.f()"
                >
                    {{ q.l }}
                </button>
            </div>

            <div class="p-4" @click.stop>
                <div class="flex items-center justify-between mb-3">
                    <button
                        class="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white text-sm"
                        @click="prev"
                    >
                        ‹
                    </button>
                    <span class="text-sm font-semibold text-white"
                        >{{ MONTHS[view.month] }} {{ view.year }}</span
                    >
                    <button
                        class="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white text-sm"
                        @click="next"
                    >
                        ›
                    </button>
                </div>

                <div class="grid grid-cols-7 mb-1">
                    <div
                        v-for="d in ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']"
                        :key="d"
                        class="drp-cell text-gray-500 font-medium"
                    >
                        {{ d }}
                    </div>
                </div>

                <div class="grid grid-cols-7">
                    <div
                        v-for="i in dims.first"
                        :key="`e${i}`"
                        class="drp-cell"
                    />
                    <button
                        v-for="day in dims.days"
                        :key="day"
                        class="drp-cell transition-colors cursor-pointer"
                        :class="
                            isSt(iso(day)) || isEn(iso(day))
                                ? 'bg-blue-600 text-white font-bold'
                                : inRng(iso(day))
                                ? 'bg-blue-900 text-blue-200'
                                : 'text-gray-300 hover:bg-gray-700'
                        "
                        @click="clickDay(iso(day))"
                        @mouseenter="
                            props.start && !props.end && (hov = iso(day))
                        "
                        @mouseleave="hov = null"
                    >
                        {{ day }}
                    </button>
                </div>

                <div
                    v-if="props.start"
                    class="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between"
                >
                    <span class="text-xs text-gray-400"
                        >{{ props.start
                        }}{{ props.end ? ` → ${props.end}` : "" }}</span
                    >
                    <button
                        class="text-xs text-gray-500 hover:text-white"
                        @click="clearRange"
                    >
                        Clear
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>