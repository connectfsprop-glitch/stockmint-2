

export function formatInstrumentName(symbol: string): string {
    if (!symbol) return '';

    // Pattern for weekly options: BANKNIFTY24N2770000PE -> BANKNIFTY 27 NOV 24 70000 PE
    const weeklyOptRegex = /^([A-Z&]+)(\d{2})([1-9OND])(\d{1,2})(\d+)(CE|PE)$/i;
    const weeklyMatch = symbol.match(weeklyOptRegex);
    if (weeklyMatch) {
      const [, name, year, monthChar, day, strike, type] = weeklyMatch;
      const monthMap: { [key: string]: string } = {
        '1': 'JAN', '2': 'FEB', '3': 'MAR', '4': 'APR', '5': 'MAY', '6': 'JUN',
        '7': 'JUL', '8': 'AUG', '9': 'SEP', 'O': 'OCT', 'N': 'NOV', 'D': 'DEC',
      };
      const month = monthMap[monthChar.toUpperCase() as keyof typeof monthMap] || monthChar;
      return `${name} ${day} ${month} ${year} ${strike} ${type}`;
    }

    // Pattern for monthly options: NIFTY25NOV73200CE -> NIFTY 25 NOV 73200 CE
    const monthlyOptRegex = /^([A-Z&]+)(\d{2})([A-Z]{3})(\d+)(CE|PE)$/i;
    const monthlyMatch = symbol.match(monthlyOptRegex);
    if (monthlyMatch) {
        const [, name, year, month, strike, type] = monthlyMatch;
        return `${name} ${'20' + year} ${month} ${strike} ${type}`;
    }
    
    // Pattern: NIFTY24DECFUT -> NIFTY 24 DEC FUT
    const futRegex = /^([A-Z&]+)(\d{2})([A-Z]{3})(FUT)$/i;
    const futMatch = symbol.match(futRegex);
    if (futMatch) {
        const [, name, year, month] = futMatch;
        return `${name} ${'20' + year} ${month} FUT`;
    }


    // For equities or if no match, return the original symbol
    return symbol;
}

export function formatSimpleInstrumentName(instrument: { name?: string, tradingsymbol?: string, strike?: number, instrument_type?: string, expiry?: string | null }): string {
    const name = instrument.name || (instrument.tradingsymbol ? formatInstrumentName(instrument.tradingsymbol) : '');
    if (!name) return '';
    
    // For options, we want a clean "SENSEX 85000 CE" format.
    if ((instrument.instrument_type === 'CE' || instrument.instrument_type === 'PE') && instrument.strike) {
        const baseName = instrument.name || instrument.tradingsymbol?.match(/^([A-Z&]+)/)?.[0] || '';
        return `${baseName} ${instrument.strike} ${instrument.instrument_type}`;
    }
  
    // For other instruments, return the formatted name or trading symbol
    return formatInstrumentName(instrument.tradingsymbol || '');
  }
  

export function formatSearchItemName(instrument: any, expiry: string | undefined): string {
    const instrumentName = (instrument.name || instrument.tradingsymbol).replace(/"/g, '');

    if (['FUT', 'CE', 'PE'].includes(instrument.instrument_type) && expiry) {
        let displayName = `${instrumentName} ${expiry.toUpperCase()}`;
        if (instrument.strike) {
            displayName = `${instrumentName} ${expiry.toUpperCase()} ${instrument.strike}`;
        }
        if (instrument.instrument_type !== 'FUT') {
            displayName += ` ${instrument.instrument_type}`;
        } else {
             displayName += ` FUT`;
        }
        return displayName.replace(/ +/g, ' ').trim();
    }
    return instrument.tradingsymbol;
}
