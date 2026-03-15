export const CAT_COLORS = {
  'Mortgage & Housing': '#4f8ef7',
  'Car Payments': '#f5a623',
  'Auto Insurance': '#f06280',
  'Groceries & Household': '#2dd4a0',
  'Dining & Food': '#fbbf24',
  'Gas & EV Charging': '#a78bfa',
  'Shopping': '#fb7185',
  'Childcare & Education': '#34d399',
  'Kids Activities & Sports': '#60a5fa',
  'Utilities': '#94a3b8',
  'Phone & Cable': '#f59e0b',
  'Subscriptions': '#c084fc',
  'Home Services': '#6ee7b7',
  'Transportation': '#7dd3fc',
  'Health & Medical': '#fda4af',
  'Personal Care & Fitness': '#d8b4fe',
  'Transfers / Personal': '#6b7280',
  'Travel (Non-Recurring)': '#e879f9',
  'Annual Fees (Non-Recurring)': '#fb923c',
  'Home Purchase (One-time)': '#fbbf24',
  'Bank Fees & Interest': '#9ca3af',
  'Other Loan': '#9ca3af',
  'Business / Professional': '#67e8f9',
  'Other': '#6b7280',
}

export const NON_RECURRING = new Set([
  'Home Purchase (One-time)',
  'Travel (Non-Recurring)',
  'Annual Fees (Non-Recurring)',
])

export const ALL_CATEGORIES = [
  'Mortgage & Housing', 'Car Payments', 'Auto Insurance',
  'Groceries & Household', 'Dining & Food', 'Gas & EV Charging',
  'Phone & Cable', 'Utilities', 'Subscriptions', 'Shopping',
  'Childcare & Education', 'Kids Activities & Sports',
  'Health & Medical', 'Personal Care & Fitness', 'Home Services',
  'Transportation', 'Bank Fees & Interest', 'Cash Withdrawal',
  'Other Loan', 'Business / Professional', 'Personal (Tobacco)',
  'Transfers / Personal', 'Entertainment',
  'Home Purchase (One-time)', 'Travel (Non-Recurring)',
  'Annual Fees (Non-Recurring)', 'Other',
]

export const CAT_RULES = {
  'Mortgage & Housing': ['PNC MTG', 'TRUIST', 'AFFIRM'],
  'Car Payments': ['TESLA FINANCE', 'HMF HMFUSA', 'VW FINANCIAL', 'TESLA MOTORS', 'TESLA MOTO'],
  'Auto Insurance': ['GEICO', 'PROGRESSIVE'],
  'Groceries & Household': ['HARRIS TEETER', 'TRADER JOE', 'WEGMANS', 'GIANT', 'LIDL', 'WAL-MART', 'WALMART', 'WHOLE FOODS', 'WHOLEFDS', 'TARGET', 'ALDI', 'SHOPRITE'],
  'Dining & Food': ['CHICK-FIL', 'PANERA', 'SWEETGREEN', 'GRUBHUB', 'DOORDASH', 'DOMINO', 'SHAKE SHACK', 'CHIPOTLE', 'KABOB', 'TST*', 'COFFEE', 'YUMMY', 'LEBANESE', 'PIZZA', 'RESTAURANT', 'POTBELLY', 'WAFFLE HOUSE', 'JERSEY MIKE', 'IHOP', 'MAMAN', 'DOLAN'],
  'Gas & EV Charging': ['TESLA SUPERCHARGER', 'SHELL', 'EXXON', 'SUNOCO', 'CHARGEPOINT', 'WAWA', 'ROYAL FARMS', 'SHEETZ', 'BUC-EE', 'CHEVRON', 'CIRCLE K'],
  'Phone & Cable': ['VERIZON', 'ATT*', 'AT&T', 'T-MOBILE', 'XFINITY'],
  'Utilities': ['WASHINGTON GAS', 'PEPCO', 'DOMINION', 'WSSC', 'PM CONNECT', 'FAIRFAX WATER', 'SPI*FAIRFAX'],
  'Subscriptions': ['NETFLIX', 'SPOTIFY', 'YOUTUBE', 'PLAYSTATION', 'NINTENDO', 'APPLE.COM', 'PELOTON', 'INSTACART', 'FUBOTV', 'PARAMOUNT', 'PRIME VIDEO', 'ROCKET MONEY', 'CLAUDE.AI'],
  'Shopping': ['AMAZON', 'WAYFAIR', 'HOMEGOODS', 'MARSHALLS', 'BURLINGTON', 'NORDSTROM', 'SEPHORA', 'LOWES', 'HOME DEPOT', 'HOMEDEPOT', 'BEST BUY', 'BESTBUY', 'TJMAXX', 'OVERSTOCK'],
  'Childcare & Education': ['INCOURAGE', 'A CHILD', 'NICOLY', 'ANNE DA SILVA', 'VALS.US', 'CULTURAL CARE', 'AUPAIR', 'INTERNATIONAL LANG'],
  'Kids Activities & Sports': ['VYS.ORG', 'WWW.VYS', 'SOCCER SHOTS', 'MCLEAN SOC', 'FCPA PARK', 'EDGAR'],
  'Health & Medical': ['CVS', 'WALGREEN', 'PHARMACY', 'LABCORP', 'AMZNPHARMA'],
  'Personal Care & Fitness': ['BARBER', 'SALON', 'SPA', 'PURE FITNESS', 'UNITED BARBER', 'SUGARING HOUSE', 'HAIR CUTTERY', 'PESTNOW'],
  'Home Services': ['365SVC', 'A&E REPAIR', 'MIRIAN', 'BANEGAS', 'DAN SERVICES'],
  'Transportation': ['METRO', 'PARKING', 'EZPASS', 'COLPARK', 'LYFT', 'UBER', 'AMTRAK', 'MR WASH'],
  'Travel (Non-Recurring)': ['EGYPTAIR', 'GAYLORD', 'AQUAWORLD HOTEL', 'BALIAN SPRINGS', 'CLEARME', 'HOTEL', 'AIRBNB'],
  'Annual Fees (Non-Recurring)': ['ANNUAL MEMBERSHIP FEE', 'CAPITAL ONE MEMBER FEE', 'PRIMARY ANNUAL FEE', 'MYBESTBUY TOTAL', 'DEPARTMENT MOTOR'],
  'Bank Fees & Interest': ['INTEREST CHARGE', 'LATE FEE', 'PAST DUE'],
  'Transfers / Personal': ['VENMO', 'ZELLE'],
}

export function autoCategorize(desc) {
  const d = desc.toUpperCase()
  if (d.includes('ZELLE') && (d.includes('NICOLY') || d.includes('ANNE DA SILVA'))) return 'Childcare & Education'
  if (d.includes('ZELLE') && d.includes('MIRIAN')) return 'Home Services'
  if (d.includes('CULTURAL CARE')) return 'Childcare & Education'
  for (const [cat, keywords] of Object.entries(CAT_RULES)) {
    if (keywords.some(k => d.includes(k))) return cat
  }
  return 'Other'
}

export function catColor(cat) {
  return CAT_COLORS[cat] || '#7a7f9a'
}

export function fmt(n) {
  return '$' + Math.round(Math.abs(n)).toLocaleString()
}

export function fmtS(n) {
  return (n < 0 ? '-' : '+') + '$' + Math.round(Math.abs(n)).toLocaleString()
}

export function fmtDec(n) {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
