import { createRouter, createWebHashHistory } from 'vue-router'
import TradesView from './pages/TradesView.vue'
import SummaryView from './pages/SummaryView.vue'
import CalendarView from './pages/CalendarView.vue'
import PerformanceView from './pages/PerformanceView.vue'
import ListsView from './pages/ListsView.vue'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: '/', redirect: '/trades' },
        { path: '/trades', component: TradesView },
        { path: '/summary', component: SummaryView },
        { path: '/calendar', component: CalendarView },
        { path: '/performance', component: PerformanceView },
        { path: '/lists', component: ListsView },
    ],
})

export default router
