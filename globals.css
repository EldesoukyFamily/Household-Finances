// scripts/seed.js
// Run: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... HOUSEHOLD_ID=... node scripts/seed.js

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl     = process.env.SUPABASE_URL
const supabaseKey     = process.env.SUPABASE_SERVICE_KEY  // service role key (bypasses RLS)
const householdId     = process.env.HOUSEHOLD_ID

if (!supabaseUrl || !supabaseKey || !householdId) {
  console.error('Missing env vars. Run:')
  console.error('SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=eyJ... HOUSEHOLD_ID=uuid node scripts/seed.js')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ── V5 transaction data ───────────────────────────────────────────────────────
// This is your full V5 dataset — all 1,039 transactions
// Loaded from the JSON file generated during analysis
async function seed() {
  console.log('Loading V5 transaction data...')

  let transactions
  try {
    const dataPath = path.join(__dirname, '..', 'v5_data.json')
    const raw = fs.readFileSync(dataPath, 'utf8')
    transactions = JSON.parse(raw)
  } catch(e) {
    console.error('Could not find v5_data.json. Make sure you placed it in the project root.')
    console.error('Download it from the setup instructions.')
    process.exit(1)
  }

  console.log(`Seeding ${transactions.length} transactions...`)

  // Insert in batches of 100
  const batchSize = 100
  let inserted = 0
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize).map(t => ({
      household_id: householdId,
      date:         t.d || t.date,
      description:  t.x || t.description,
      amount:       parseFloat(t.a || t.amount),
      account:      t.ac || t.account,
      category:     t.c || t.category,
    }))
    const { error } = await supabase.from('transactions').insert(batch)
    if (error) { console.error('Insert error:', error.message); process.exit(1) }
    inserted += batch.length
    console.log(`  Inserted ${inserted}/${transactions.length}`)
  }

  // Seed baseline (7-month averages per category)
  console.log('\nSeeding baseline targets...')
  const baseline = {
    'Mortgage & Housing':       7600,
    'Shopping':                 2510,
    'Car Payments':             1600,
    'Groceries & Household':    1664,
    'Childcare & Education':    1588,
    'Dining & Food':            1251,
    'Transfers / Personal':      794,
    'Utilities':                 482,
    'Kids Activities & Sports':  390,
    'Auto Insurance':            352,
    'Gas & EV Charging':         330,
    'Phone & Cable':             299,
    'Home Services':             296,
    'Personal Care & Fitness':   285,
    'Subscriptions':             228,
    'Health & Medical':          182,
    'Transportation':            132,
    'Cash Withdrawal':            75,
    'Other Loan':                 32,
    'Business / Professional':    16,
    'Other':                      12,
    'Entertainment':               3,
  }

  const blRows = Object.entries(baseline).map(([category, amount]) => ({
    household_id: householdId,
    category,
    amount,
  }))

  const { error: blErr } = await supabase
    .from('baseline')
    .upsert(blRows, { onConflict: 'household_id,category' })

  if (blErr) { console.error('Baseline error:', blErr.message) }
  else console.log(`  Seeded ${blRows.length} baseline categories`)

  console.log('\n✓ Seed complete! Open your app and you should see all your data.')
}

seed().catch(console.error)
