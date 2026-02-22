export const pad2 = n => String(n).padStart(2, "0");
export const toISO = d => d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
export const TODAY = toISO(new Date());

export const fmt = (n, c = "") => `${n < 0 ? '-' : ''}${c === "EUR" ? "€" : "$"}${Math.abs(n).toFixed(2)}`;
export const fmtPnl = (n, c = "") => `${n >= 0 ? '+' : '-'}${c === "EUR" ? "€" : "$"}${Math.abs(n).toFixed(2)}`;
export const fmtPct = n => `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(2)}%`;
export const calcPnlPct = (pnl, basis) => {
    const p = Number(pnl);
    const b = Math.abs(Number(basis));
    if (!Number.isFinite(p) || !Number.isFinite(b) || b === 0) return null;
    return (p / b) * 100;
};

export const parseDate = s => {
    const v = String(s).trim();
    return v.length === 8 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : v;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const normalizeType = val => {
    const raw = String(val || "").toUpperCase().trim();
    if (raw === "B") return "BUY";
    if (raw === "S") return "SELL";
    if (raw === "BUY" || raw === "SELL") return raw;
    return raw;
};

export const formatDateTime = val => {
    if (!val) return '—';
    const raw = String(val).trim();
    let year; let month; let day;
    if (raw.includes(';')) {
        const [datePart] = val.split(';');
        year = datePart.slice(0, 4);
        month = datePart.slice(4, 6);
        day = datePart.slice(6, 8);
    } else if (raw.includes('-')) {
        [year, month, day] = raw.split('T')[0].split('-');
    } else {
        const cleaned = raw.padStart(8, '0');
        year = cleaned.slice(0, 4);
        month = cleaned.slice(4, 6);
        day = cleaned.slice(6, 8);
    }
    const parsedYear = Number(year);
    const parsedMonth = Number(month);
    const parsedDay = Number(day);
    if (Number.isNaN(parsedYear) || Number.isNaN(parsedMonth) || Number.isNaN(parsedDay)) return val;
    const dateObj = new Date(Date.UTC(parsedYear, parsedMonth - 1, parsedDay));
    const dow = WEEKDAYS[dateObj.getUTCDay()];
    const name = MONTHS[parsedMonth - 1] ?? '';
    return `${dow} ${pad2(parsedDay)} ${name}, ${parsedYear}`;
};

export const parseOrderTimestamp = val => {
    if (!val) return null;
    const raw = String(val).trim();
    const [datePart, timePart = '000000'] = raw.split(';');
    if (!datePart || datePart.length < 8) return null;
    const year = datePart.slice(0, 4);
    const month = datePart.slice(4, 6);
    const day = datePart.slice(6, 8);
    const padded = timePart.replace(/[^0-9]/g, '').padEnd(6, '0');
    const hour = padded.slice(0, 2);
    const minute = padded.slice(2, 4);
    const second = padded.slice(4, 6);
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};