<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
    active,
    authReady,
    currentUser,
    doImport,
    initAuth,
    REQUIRE_GOOGLE_AUTH,
    signInWithGoogle,
    signOutUser,
} from "./state";
import logoUrl from "./assets/img/logo.png";
import iconUrl from "./assets/img/logo.svg";

const route = useRoute();

const loading = computed(() => !authReady.value);
const authRequired = REQUIRE_GOOGLE_AUTH;
const isAuthed = computed(() => !authRequired || !!currentUser.value);
const uploadMsg = ref("");
const menuOpen = ref(false);
const activeCount = computed(() => active.value.length);
const authErr = ref("");

const navRoutes = [
    { path: "/trades", label: "Trades" },
    { path: "/summary", label: "Summary" },
    { path: "/calendar", label: "Calendar" },
    { path: "/performance", label: "Performance" },
];

const onHashChange = () => {
    menuOpen.value = false;
};

onMounted(async () => {
    await initAuth();
    window.addEventListener("hashchange", onHashChange);
});

onUnmounted(() => {
    window.removeEventListener("hashchange", onHashChange);
});

const handleUpload = async (e) => {
    if (authRequired && !currentUser.value) {
        uploadMsg.value = "Please sign in first";
        setTimeout(() => {
            uploadMsg.value = "";
        }, 2500);
        return;
    }

    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const { added, total } = await doImport(file);
    uploadMsg.value = `✓ Imported ${added} orders (${total} total)`;
    setTimeout(() => {
        uploadMsg.value = "";
    }, 3000);
};

const handleLogin = async () => {
    authErr.value = "";
    try {
        await signInWithGoogle();
    } catch {
        authErr.value = "Google sign-in failed. Please try again.";
    }
};

const handleLogout = async () => {
    authErr.value = "";
    try {
        await signOutUser();
    } catch {
        authErr.value = "Sign out failed. Please try again.";
    }
};
</script>

<template>
    <div
        v-if="loading"
        class="flex items-center justify-center"
        style="min-height: 100vh"
    >
        <p class="text-gray-400">Loading…</p>
    </div>

    <div
        v-else-if="authRequired && !currentUser"
        class="min-h-screen flex items-center justify-center px-4"
    >
        <div
            class="w-full max-w-md bg-gray-800 border border-gray-700 rounded-xl p-6 text-center"
        >
            <div class="flex items-center justify-center gap-2 mb-4">
                <img :src="logoUrl" class="w-10 h-10 rounded-lg" alt="Logo" />
                <h1 class="text-2xl font-bold text-white">Trading Journal</h1>
            </div>
            <p class="text-gray-400 text-sm mb-5">
                Sign in with Google to access your trades.
            </p>
            <button
                class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors"
                @click="handleLogin"
            >
                Continue with Google
            </button>

            <p v-if="authErr" class="mt-3 text-xs text-red-400">
                {{ authErr }}
            </p>
        </div>
    </div>

    <div v-else-if="isAuthed">
        <header class="bg-gray-800 border-b border-gray-700 px-4 py-3">
            <div
                class="max-w-6xl mx-auto flex items-center justify-between gap-3"
            >
                <div>
                    <router-link to="/trades" class="flex items-center gap-2">
                        <img
                            :src="logoUrl"
                            class="w-8 h-8 rounded-lg"
                            alt="Logo"
                        />
                        <span class="text-lg font-semibold text-white"
                            >Trading Journal</span
                        >
                    </router-link>
                    <p class="text-gray-400 text-xs mt-1">
                        {{ activeCount }} active orders
                    </p>
                    <p
                        v-if="!authRequired"
                        class="text-yellow-400 text-xs mt-1"
                    >
                        Guest mode (local-only)
                    </p>
                </div>
                <div class="flex items-center gap-3">
                    <span
                        v-if="currentUser?.email"
                        class="text-xs text-gray-400 hidden sm:inline"
                        >{{ currentUser.email }}</span
                    >
                    <span v-if="uploadMsg" class="text-green-400 text-xs">{{
                        uploadMsg
                    }}</span>
                    <label
                        class="upload-btn cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors text-center"
                    >
                        ↑ Upload CSV
                        <input
                            type="file"
                            accept=".csv,.txt"
                            @change="handleUpload"
                        />
                    </label>
                    <button
                        v-if="authRequired"
                        class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                        @click="handleLogout"
                    >
                        Sign out
                    </button>
                </div>
            </div>
        </header>

        <nav class="bg-gray-800 border-b border-gray-700">
            <div class="max-w-6xl mx-auto px-4">
                <div class="flex flex-col items-start md:block">
                    <button
                        class="md:hidden text-gray-400 hover:text-white focus:outline-none p-2 self-start"
                        aria-label="Toggle menu"
                        @click="menuOpen = !menuOpen"
                    >
                        <svg
                            v-if="!menuOpen"
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        </svg>
                        <svg
                            v-else
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                    <div
                        :class="[
                            'md:flex',
                            'pb-2',
                            'md:pb-0',
                            menuOpen ? 'block' : 'hidden',
                            'w-full',
                        ]"
                    >
                        <router-link
                            v-for="r in navRoutes"
                            :key="r.path"
                            :to="r.path"
                            :class="[
                                'mobile-nav-link block md:inline-block px-2 py-3 text-sm font-medium border-b-2 transition-colors items-center',
                                route.path === r.path
                                    ? 'border-blue-500 text-blue-400'
                                    : 'border-transparent text-gray-400 hover:text-gray-200',
                            ]"
                        >
                            {{ r.label }}
                        </router-link>
                    </div>
                </div>
            </div>
        </nav>

        <main class="max-w-6xl mx-auto px-4 py-5">
            <router-view v-slot="{ Component }">
                <transition name="fade" mode="out-in">
                    <component :is="Component" />
                </transition>
            </router-view>
        </main>
    </div>
</template>
