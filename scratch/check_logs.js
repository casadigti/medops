
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rlygbfossyzqljdtlvfk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJseWdiZm9zc3l6cWxqZHRsdmZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NTc2MjUsImV4cCI6MjA5MzIzMzYyNX0.AW2RsfUsZtNAbCBgPD07r5D4EGvpkcbzbBV8l2FMfps';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkLogs() {
  console.log('Fetching logs from:', supabaseUrl);
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching logs:', error);
  } else {
    console.log('Last 20 Audit Logs:');
    data.forEach(log => {
      console.log(`[${log.created_at}] ${log.action} - ${log.entity_type} (${log.entity_id}): ${JSON.stringify(log.details)}`);
    });
  }
}

checkLogs();
