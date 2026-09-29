// Read-only snapshot export. Prints only allowlisted task-design fields, never credentials.
const fs = require('node:fs');
const path = require('node:path');
async function main() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const url = html.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)/)?.[1];
  const key = html.match(/SUPABASE_KEY\s*=\s*['"]([^'"]+)/)?.[1];
  if (!url || !key) throw new Error('Missing existing public database configuration');
  const fields = 'task_type,title,description,difficulty,reward_chopping,reward_items,theme_name,theme_start,theme_end,theme_extra_reward,sort_order';
  const response = await fetch(`${url}/rest/v1/xiu_tasks?audience_role=eq.player_live&status=eq.published&select=${fields}&order=sort_order.asc`, {
    headers: { apikey: key }, signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Task snapshot read failed: HTTP ${response.status}`);
  const rows = await response.json();
  console.log(JSON.stringify(rows.map((row, index) => ({
    id: `demo-task-${index + 1}`, taskType: row.task_type, title: row.title, description: row.description,
    difficulty: row.difficulty, rewardChopping: row.reward_chopping || 0, rewardItems: row.reward_items || [],
    themeName: row.theme_name || null, themeExtraReward: row.theme_extra_reward || [], sortOrder: index + 1,
    // All themes deliberately share a fresh demo window, no source timestamps/identifiers.
  })), null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
