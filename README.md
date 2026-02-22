# Trading Journal

A professional trade log and performance tracking application designed for stock traders to analyze their activity and improve their edge.

## 🚀 Technologies Used

- **Frontend**: [Vue.js 3](https://vuejs.org/) (Composition API)
- **Styling**: [TailwindCSS](https://tailwindcss.com/) & Vanilla CSS
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Backend / DB**: [Firebase Firestore](https://firebase.google.com/products/firestore)
- **Authentication**: [Firebase Auth](https://firebase.google.com/products/auth) (Google Sign-In)
- **Parsing**: [PapaParse](https://www.papaparse.com/) for CSV processing

## 🛠️ How It Works

### App Purpose

The **Trading Journal** allows traders to move beyond simple spreadsheets. By importing trade data directly from brokers (like Interactive Brokers), users can visualize their performance, identify patterns, and maintain a disciplined log of their trading history.

### Workflow

1.  **Secure Login**: Users authenticate via Google using Firebase Auth.
2.  **Data Import**: Export trade reports from Interactive Brokers and upload the CSV to the app.
3.  **Analysis**: View individual trade details, grouped performance summaries, and a visual calendar of trading days.

### Technical Architecture

The application is built as a reactive Single Page Application (SPA):

- **Vue.js** handles the reactive UI and state management.
- **Firebase Auth** manages user sessions and secures data access.
- **Firestore** provides a real-time NoSQL database where trades are stored and synced per user.
- **Integration**: When a user logs in, the app initializes a connection to their specific Firestore collection, ensuring data privacy and persistence across devices.

## 📸 Screenshots

### 1. Secure Authentication

The entry point of the application, utilizing Google Auth for a seamless and secure experience.

![Login](/screenshots/login.png)

---

### 2. Trade Log

Detailed view of all imported trades, including symbols, dates, quantities, and realized P&L.

![Trades List 1](/screenshots/trades-1.png)
![Trades List 2](/screenshots/trades-2.png)
![Trades List 3](/screenshots/trades-3.png)
![Trades List 4](/screenshots/trades-4.png)

---

### 3. Summary Dashboard

High-level overview of trading performance, including win rates and profit metrics.

![Summary 1](/screenshots/summary-1.png)
![Summary 2](/screenshots/summary-2.png)

---

### 4. Trading Calendar

A visual representation of daily performance, helping traders identify their most (and least) successful days.

![Calendar 1](/screenshots/calendar-1.png)
![Calendar 2](/screenshots/calendar-2.png)

---

### 5. Performance Metrics

Data visualizations to track growth and strategy efficacy.

![Performance](/screenshots/performance.png)
