<script setup>
import { computed } from "vue";

const props = defineProps({
    totalItems: {
        type: Number,
        required: true,
    },
    itemsPerPage: {
        type: [Number, String],
        required: true,
    },
    modelValue: {
        type: Number,
        required: true,
    },
});

const emit = defineEmits(["update:modelValue", "update:itemsPerPage"]);

const isAll = computed(() => props.itemsPerPage === "all");

const totalPages = computed(() => {
    if (isAll.value || props.itemsPerPage <= 0) return 1;
    return Math.ceil(props.totalItems / props.itemsPerPage);
});

const startItem = computed(() => {
    if (props.totalItems === 0) return 0;
    if (isAll.value) return 1;
    return (props.modelValue - 1) * props.itemsPerPage + 1;
});

const endItem = computed(() => {
    if (isAll.value) return props.totalItems;
    return Math.min(props.modelValue * props.itemsPerPage, props.totalItems);
});

const pages = computed(() => {
    const range = [];
    const maxVisible = 5;

    if (totalPages.value <= maxVisible) {
        for (let i = 1; i <= totalPages.value; i++) range.push(i);
    } else {
        let start = Math.max(1, props.modelValue - 2);
        let end = Math.min(totalPages.value, start + maxVisible - 1);

        if (end === totalPages.value) {
            start = Math.max(1, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) range.push(i);
    }
    return range;
});

const setPage = (p) => {
    if (p >= 1 && p <= totalPages.value) {
        emit("update:modelValue", p);
    }
};

const onItemsPerPageChange = (e) => {
    const val = e.target.value;
    const num = val === "all" ? "all" : parseInt(val);
    emit("update:itemsPerPage", num);
    emit("update:currentPage", 1);
};
</script>

<template>
    <div
        class="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-gray-900 border-t border-gray-700"
    >
        <div class="flex items-center gap-3 text-xs text-gray-400">
            <span>Show:</span>
            <select
                :value="itemsPerPage"
                @change="onItemsPerPageChange"
                class="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
            >
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
                <option value="all">All</option>
            </select>
            <span v-if="totalItems > 0">
                Showing {{ startItem }}-{{ endItem }} of {{ totalItems }}
            </span>
            <span v-else>No items to show</span>
        </div>

        <div v-if="!isAll && totalPages > 1" class="flex items-center gap-1">
            <button
                @click="setPage(modelValue - 1)"
                :disabled="modelValue === 1"
                class="px-2 py-1 rounded border border-gray-700 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs text-gray-300"
            >
                Prev
            </button>

            <div class="flex items-center gap-1">
                <button
                    v-for="p in pages"
                    :key="p"
                    @click="setPage(p)"
                    class="min-w-[2rem] px-2 py-1 rounded border transition-colors text-xs"
                    :class="
                        p === modelValue
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'border-gray-700 hover:bg-gray-800 text-gray-300'
                    "
                >
                    {{ p }}
                </button>
            </div>

            <button
                @click="setPage(modelValue + 1)"
                :disabled="modelValue === totalPages"
                class="px-2 py-1 rounded border border-gray-700 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs text-gray-300"
            >
                Next
            </button>
        </div>
    </div>
</template>
