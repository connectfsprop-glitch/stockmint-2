// src/lib/market-time.ts

interface MarketHours {
    open: { hour: number; minute: number };
    close: { hour: number; minute: number };
}

// All times are in IST (Indian Standard Time)
const exchangeHours: { [key: string]: MarketHours } = {
    NSE: { open: { hour: 9, minute: 15 }, close: { hour: 15, minute: 30 } },
    BSE: { open: { hour: 9, minute: 15 }, close: { hour: 15, minute: 30 } },
    NFO: { open: { hour: 9, minute: 15 }, close: { hour: 15, minute: 30 } },
    BFO: { open: { hour: 9, minute: 15 }, close: { hour: 15, minute: 30 } },
    MCX: { open: { hour: 9, minute: 0 }, close: { hour: 23, minute: 30 } },
};

// Market holidays for 2024. Format: YYYY-MM-DD
// Source: NSE/BSE/MCX official holiday lists.
const marketHolidays: string[] = [
    "2024-01-26", // Republic Day
    "2024-03-08", // Mahashivratri
    "2024-03-25", // Holi
    "2024-03-29", // Good Friday
    "2024-04-11", // Id-Ul-Fitr
    "2024-04-17", // Ram Navami
    "2024-05-01", // Maharashtra Day
    "2024-06-17", // Bakri Id
    "2024-07-17", // Muharram
    "2024-08-15", // Independence Day
    "2024-10-02", // Mahatma Gandhi Jayanti
    "2024-11-01", // Diwali Laxmi Pujan
    "2024-11-15", // Gurunanak Jayanti
    "2024-12-25", // Christmas
];

function getISTDate(): Date {
    const now = new Date();
    // Convert to IST by adding 5 hours and 30 minutes
    const istTime = now.getTime() + (5.5 * 60 * 60 * 1000);
    return new Date(istTime);
}

export function getMarketStatus(exchange: string): { isOpen: boolean; message: string } {
    const hours = exchangeHours[exchange.toUpperCase()];
    if (!hours) {
        return { isOpen: false, message: `Market hours for ${exchange} are not defined.` };
    }

    const now = getISTDate();
    
    // Get day of the week in IST (0=Sunday, 6=Saturday)
    const day = now.getUTCDay();

    // Check for weekends
    if (day === 0 || day === 6) {
        return { isOpen: false, message: 'Market is closed on weekends.' };
    }

    // Check for holidays
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    if (marketHolidays.includes(today)) {
        return { isOpen: false, message: 'Market is closed for a holiday.' };
    }

    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const openTimeInMinutes = hours.open.hour * 60 + hours.open.minute;
    const closeTimeInMinutes = hours.close.hour * 60 + hours.close.minute;

    const isOpen = currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes;

    return {
        isOpen,
        message: isOpen ? 'Market is open.' : 'Market is closed.',
    };
}
