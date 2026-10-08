/**
 * Built-in keyword highlight presets, offered next to keyword import/export.
 * Applying a preset adds its rules after the user's existing ones (skipping
 * rules already present), so it never discards custom keywords.
 */

export const keywordPresets = [
  {
    name: 'Networking',
    description: 'Switch/router CLI output (Cisco, Hirschmann, Moxa and similar): link state, errors, syslog severity, IPs, MACs, interfaces',
    keywords: [
      // syslog severity: %FACILITY-<severity>-MNEMONIC
      { keyword: '%[A-Z0-9_]+-[0-3]-[A-Z0-9_]+', color: 'red' },
      { keyword: '%[A-Z0-9_]+-4-[A-Z0-9_]+', color: 'yellow' },
      { keyword: '%[A-Z0-9_]+-[5-7]-[A-Z0-9_]+', color: 'cyan' },
      // link / port state
      { keyword: '\\b(administratively down|err-?disabled|notconnect|not connected|link down|down)\\b', color: 'red' },
      { keyword: '\\b(errors?|fail(ed|ure|s)?|denied|deny|invalid|incomplete|unreachable|timeout|timed out|crc|runts|giants|collisions?|input errors|output errors|discard(s|ed)?|drop(s|ped)?|blocking|blk|bkn|broken|alarm|critical|access denied)\\b', color: 'red' },
      { keyword: '\\b(up|connected|link up|permit(ted)?|forwarding|fwd|full|established|active|success(ful)?|enabled?|ok|online|reachable|root)\\b', color: 'green' },
      { keyword: '\\b(warning|warn|half|learning|lrn|listening|lis|standby|disabled?|shutdown|pending|unknown|desg|altn|alternate|backup)\\b', color: 'yellow' },
      // MAC addresses: aa:bb:cc:dd:ee:ff, aa-bb-..., aabb.ccdd.eeff
      { keyword: '\\b([0-9a-f]{2}[:-]){5}[0-9a-f]{2}\\b|\\b[0-9a-f]{4}\\.[0-9a-f]{4}\\.[0-9a-f]{4}\\b', color: 'magenta' },
      // IPv4 with optional prefix length
      { keyword: '\\b(25[0-5]|2[0-4]\\d|1?\\d?\\d)(\\.(25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}(/\\d{1,2})?\\b', color: 'cyan' },
      // interface names: Gi1/0/1, GigabitEthernet1/0/1, Vlan600, Po1, ...; slot/port (1/1)
      { keyword: '\\b(GigabitEthernet|TenGigabitEthernet|TwentyFiveGigE|FortyGigabitEthernet|HundredGigE|FastEthernet|Ethernet|Port-channel|Loopback|Tunnel|Vlan|Gi|Te|Twe|Fo|Hu|Fa|Eth|Po|Lo|Tu|Vl)\\s?\\d+(/\\d+){0,3}(\\.\\d+)?\\b', color: 'blue' },
      { keyword: '\\b(cpu|vlan|lag|ch)\\s?/?\\d+(/\\d+)?\\b|\\b\\d/\\d{1,2}\\b', color: 'blue' }
    ]
  }
]

// Append a preset's rules to existing keywords, skipping duplicates and the
// empty placeholder row the settings form starts with.
export function mergeKeywordPreset (existing = [], preset) {
  const kept = existing.filter(k => k && k.keyword)
  const seen = new Set(kept.map(k => k.keyword))
  const added = preset.keywords.filter(k => !seen.has(k.keyword))
  return [...kept, ...added.map(k => ({ ...k }))]
}
