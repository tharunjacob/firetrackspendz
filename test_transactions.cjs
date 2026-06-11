const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hygypbgsaykfnviigeln.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5Z3lwYmdzYXlrZm52aWlnZWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMDQ2NTEsImV4cCI6MjA4MDU4MDY1MX0.vRwNDpmuu0gC52E9aRE4tfmCR8BabThVxEZpNAc74jY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testTransactions() {
  const dummyUserId = '00000000-0000-0000-0000-000000000000';
  
  const testQueries = [
    {
      name: 'Query with .eq(user_id)',
      run: () => supabase.from('transactions').select('*').eq('user_id', dummyUserId).limit(1)
    },
    {
      name: 'Query with .order(date)',
      run: () => supabase.from('transactions').select('*').order('date', { ascending: false }).limit(1)
    },
    {
      name: 'Query with .range(0, 999)',
      run: () => supabase.from('transactions').select('*').range(0, 999).limit(1)
    },
    {
      name: 'Full query like cloudLoad',
      run: () => supabase.from('transactions').select('*').eq('user_id', dummyUserId).range(0, 999).order('date', { ascending: false })
    }
  ];

  for (const q of testQueries) {
    console.log(`Running test: ${q.name}...`);
    try {
      const { data, error } = await q.run();
      if (error) {
        console.error('  -> PostgREST Error:', error.code, error.message);
      } else {
        console.log('  -> Success! Rows returned:', data.length);
      }
    } catch (err) {
      console.error('  -> Request failed:', err.message);
    }
  }
}

testTransactions();
