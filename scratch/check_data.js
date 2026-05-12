
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rlygbfossyzqljdtlvfk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJseWdiZm9zc3l6cWxqZHRsdmZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NTc2MjUsImV4cCI6MjA5MzIzMzYyNX0.AW2RsfUsZtNAbCBgPD07r5D4EGvpkcbzbBV8l2FMfps';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
  console.log('Checking implants table...');
  const { data, error } = await supabase.from('implants').select('*');
  if (error) console.error('Error:', error);
  else console.log('Implants found:', data.length);

  console.log('Checking implant_lots table...');
  const { data: lots, error: lotsError } = await supabase.from('implant_lots').select('*');
  if (lotsError) console.error('Error:', lotsError);
  else console.log('Lots found:', lots.length);
}

checkData();
