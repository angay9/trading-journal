<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import Chart from "chart.js/auto";
import { MONTHS } from "../helpers";
import { sells } from "../state";

const chartRef = ref(null);
let chart = null;

const monthlyPerf = computed(() => {
    const map = {};
    sells.value.forEach((t) => {
        const key = t.date.slice(0, 7);
        if (!map[key])
            map[key] = {
                pnl: 0,
                trades: 0,
                wins: 0,
                currency: t.currency || "USD",
            };
        map[key].pnl += t.pnl;
        map[key].trades += 1;
        if (t.pnl > 0) map[key].wins += 1;
    });

    return Object.entries(map)
        .sort()
        .map(([month, stats]) => ({
            month,
            label: `${MONTHS[+month.slice(5, 7) - 1]}`,
            pnl: +stats.pnl.toFixed(2),
            currency: stats.currency || "USD",
            trades: stats.trades,
            winRate: +((stats.wins / stats.trades) * 100).toFixed(0),
        }));
});

const buildChart = () => {
    if (!chartRef.value) return;
    if (chart) chart.destroy();

    chart = new Chart(chartRef.value, {
        type: "bar",
        data: {
            labels: monthlyPerf.value.map((m) => m.label),
            datasets: [
                {
                    data: monthlyPerf.value.map((m) => m.pnl),
                    backgroundColor: monthlyPerf.value.map((m) =>
                        m.pnl >= 0 ? "#10b981" : "#ef4444"
                    ),
                    borderRadius: 4,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const currency =
                                monthlyPerf.value[ctx.dataIndex]?.currency ||
                                "USD";
                            const symbol = currency === "EUR" ? "€" : "$";
                            return `${
                                ctx.raw >= 0 ? "+" : "-"
                            }${symbol}${Math.abs(ctx.raw).toFixed(2)}`;
                        },
                    },
                },
            },
            scales: {
                x: { grid: { color: "#374151" }, ticks: { color: "#9ca3af" } },
                y: { grid: { color: "#374151" }, ticks: { color: "#9ca3af" } },
            },
        },
    });
};

onMounted(async () => {
    await nextTick();
    buildChart();
});

onUnmounted(() => {
    if (chart) {
        chart.destroy();
        chart = null;
    }
});

watch(monthlyPerf, () => {
    if (!chart) return;
    chart.data.labels = monthlyPerf.value.map((m) => m.label);
    chart.data.datasets[0].data = monthlyPerf.value.map((m) => m.pnl);
    chart.data.datasets[0].backgroundColor = monthlyPerf.value.map((m) =>
        m.pnl >= 0 ? "#10b981" : "#ef4444"
    );
    chart.update();
});
</script>

<template>
    <div>
        <div class="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-4">
            <h2 class="text-sm font-medium text-gray-400 mb-4">Monthly P&L</h2>
            <div
                v-if="monthlyPerf.length"
                style="height: 280px; position: relative"
            >
                <canvas ref="chartRef" />
            </div>
            <div v-else class="text-center py-16 text-gray-500">
                No data yet — upload a CSV first.
            </div>
        </div>

        <div
            v-if="monthlyPerf.length"
            class="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden"
        >
            <div
                class="px-4 py-3 border-b border-gray-700 text-sm font-medium text-gray-300"
            >
                Monthly Breakdown
            </div>
            <table class="w-full text-sm">
                <thead>
                    <tr class="border-b border-gray-700">
                        <th
                            class="px-4 py-2 text-left text-gray-400 font-medium"
                        >
                            Month
                        </th>
                        <th
                            class="px-4 py-2 text-right text-gray-400 font-medium"
                        >
                            P&L
                        </th>
                        <th
                            class="px-4 py-2 text-right text-gray-400 font-medium"
                        >
                            Trades
                        </th>
                        <th
                            class="px-4 py-2 text-right text-gray-400 font-medium"
                        >
                            Win Rate
                        </th>
                        <th
                            class="px-4 py-2 text-right text-gray-400 font-medium"
                        >
                            Status
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="r in [...monthlyPerf].reverse()"
                        :key="r.month"
                        class="border-b border-gray-700 hover:bg-gray-700 transition-colors"
                    >
                        <td class="px-4 py-2 text-gray-200 font-medium">
                            {{ r.label }} 20{{ r.month.slice(2, 4) }}
                        </td>
                        <td
                            class="px-4 py-2 text-right font-semibold"
                            :class="
                                r.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                            "
                        >
                            {{ r.pnl >= 0 ? "+" : "" }}{{ r.pnl.toFixed(2) }}
                        </td>
                        <td class="px-4 py-2 text-right text-gray-300">
                            {{ r.trades }}
                        </td>
                        <td class="px-4 py-2 text-right text-gray-300">
                            {{ r.winRate }}%
                        </td>
                        <td class="px-4 py-2 text-right">
                            <span
                                class="text-xs px-2 py-1 rounded font-medium"
                                :class="
                                    r.pnl >= 0
                                        ? 'bg-green-900 text-green-300'
                                        : 'bg-red-900 text-red-300'
                                "
                                >{{ r.pnl >= 0 ? "Profitable" : "Loss" }}</span
                            >
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
