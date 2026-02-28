<script setup>
import { computed, ref } from "vue";
import {
    lists,
    activeListId,
    renameList,
    deleteList,
    setActiveList,
    reorderLists,
} from "../state";

const dragIndex = ref(null);

const handleRename = async (list, value) => {
    await renameList(list.id, value);
};

const handleDelete = async (list) => {
    if (!window.confirm(`Delete list “${list.name}” permanently?`)) return;
    await deleteList(list.id);
};

const handleActivate = async (list) => {
    await setActiveList(list.id);
};

const handleDragStart = (idx) => {
    dragIndex.value = idx;
};

const handleDrop = async (idx) => {
    if (dragIndex.value === null || dragIndex.value === idx) return;
    const nextOrder = [...lists.value];
    const [moved] = nextOrder.splice(dragIndex.value, 1);
    nextOrder.splice(idx, 0, moved);
    dragIndex.value = null;
    await reorderLists(nextOrder);
};

const handleDropEnd = () => {
    dragIndex.value = null;
};
</script>

<template>
    <div class="space-y-4">
        <div>
            <h1 class="text-2xl font-semibold text-white">Lists</h1>
            <p class="text-sm text-gray-400 mt-1">
                Create lists on the Trades page and come here to rename, reorder,
                or delete them. Use the dropdown in the header to pick which list
                drives the Trades/Summary/Calendar data.
            </p>
        </div>

        <div v-if="!lists.length" class="rounded-xl bg-gray-800 border border-gray-700 p-6">
            <p class="text-gray-400 text-sm">
                No lists yet. Select at least one trade on the Trades page, click
                “Add to list”, and give it a name.
            </p>
        </div>

        <div
            v-for="(list, idx) in lists"
            :key="list.id"
            class="rounded-xl bg-gray-800 border border-gray-700 p-4 flex flex-col gap-3"
            draggable="true"
            @dragstart="handleDragStart(idx)"
            @dragover.prevent
            @drop="handleDrop(idx)"
            @dragend="handleDropEnd"
        >
            <div class="flex flex-col gap-2">
                <div class="flex items-center gap-3">
                    <span
                        class="drag-handle cursor-grab text-xl text-gray-500 select-none"
                        aria-hidden="true"
                    >
                        ☰
                    </span>
                    <input
                        class="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                        :value="list.name"
                        @change="handleRename(list, $event.target.value)"
                    />
                    <button
                        class="text-xs px-2 py-1 rounded border border-gray-600 text-gray-300 hover:border-white"
                        :class="{ 'bg-blue-600 border-blue-500 text-white': activeListId === list.id }"
                        @click="handleActivate(list)"
                    >
                        {{ activeListId === list.id ? "Active" : "Make active" }}
                    </button>
                    <button
                        class="text-xs px-2 py-1 rounded border border-red-600 bg-red-600 text-white hover:bg-red-500"
                        @click="handleDelete(list)"
                    >
                        Delete
                    </button>
                </div>
                <div class="text-xs text-gray-400">
                    {{ list.tradeIds.length }} trade(s)
                </div>
            </div>
        </div>
    </div>
</template>
