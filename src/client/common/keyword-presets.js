/**
 * Built-in keyword highlight presets, offered next to keyword import/export.
 * Applying a preset adds its rules after the user's existing ones (skipping
 * rules already present), so it never discards custom keywords.
 */

export const keywordPresets = [
  {
    name: 'Networking',
    description: 'Switch and router CLI output (Cisco, Juniper, Arista, HPE Aruba and Comware, Huawei, Ubiquiti EdgeOS, MikroTik, Hirschmann, Moxa and similar): link state, errors, syslog severity, IPs, MACs, interfaces',
    keywords: [
      // syslog severity: %FACILITY-<severity>-MNEMONIC
      { keyword: '%[A-Z0-9_]+-[0-3]-[A-Z0-9_]+', color: 'red' },
      { keyword: '%[A-Z0-9_]+-4-[A-Z0-9_]+', color: 'yellow' },
      { keyword: '%[A-Z0-9_]+-[5-7]-[A-Z0-9_]+', color: 'cyan' },
      // link / port state. Comware "ADM" and EdgeOS "A/D" are admin down,
      // EdgeOS "u/D" is admin up with the link down, "u/u" is up/up
      { keyword: '\\b(administratively down|err-?disabled|notconnect|not connected|link down|down|adm)\\b|\\b[Au]/D\\b', color: 'red' },
      { keyword: '\\b(errors?|fail(ed|ure|s)?|denied|deny|invalid|incomplete|unreachable|timeout|timed out|crc|runts|giants|collisions?|input errors|output errors|discard(s|ed)?|drop(s|ped)?|blocking|blk|bkn|broken|alarm|critical|access denied)\\b', color: 'red' },
      { keyword: '\\b(up|connected|link up|permit(ted)?|forwarding|fwd|full|established|active|success(ful)?|enabled?|ok|online|reachable|root)\\b|\\bu/u\\b', color: 'green' },
      { keyword: '\\b(warning|warn|half|learning|lrn|listening|lis|standby|disabled?|shutdown|pending|unknown|desg|altn|alternate|backup)\\b', color: 'yellow' },
      // MAC addresses: aa:bb:cc:dd:ee:ff, aa-bb-..., aabb.ccdd.eeff
      { keyword: '\\b([0-9a-f]{2}[:-]){5}[0-9a-f]{2}\\b|\\b[0-9a-f]{4}\\.[0-9a-f]{4}\\.[0-9a-f]{4}\\b', color: 'magenta' },
      // IPv4 with optional prefix length
      { keyword: '\\b(25[0-5]|2[0-4]\\d|1?\\d?\\d)(\\.(25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}(/\\d{1,2})?\\b', color: 'cyan' },
      // interface names. Cisco/Arista/Dell: Gi1/0/1, GigabitEthernet1/0/1, Et1, Ma1, Po1, Vlan600.
      // Huawei: XGigabitEthernet0/0/1, 40GE1/0/1, Eth-Trunk1, Vlanif10. HP Comware: XGE1/0/1,
      // Bridge-Aggregation1, BAGG1. ProCurve: Trk1. MikroTik: ether1, sfp-sfpplus1, bridge1.
      // Ubiquiti EdgeOS: eth0, eth1.100, switch0, br0
      { keyword: '\\b(GigabitEthernet|TenGigabitEthernet|TwentyFiveGigE|FortyGigabitEthernet|HundredGigE|XGigabitEthernet|FastEthernet|Ethernet|Eth-Trunk|Port-channel|Bridge-Aggregation|Route-Aggregation|Management|Loopback|Tunnel|MEth|Vlanif|Vlan|BAGG|sfp-sfpplus|sfp|ether|switch|bridge|bond|wlan|pppoe|Trk|ae|br|XGE|FGE|GE|Gi|Te|Twe|Fo|Hu|Fa|Eth|Et|Ma|Po|Lo|Tu|Vl|\\d{2,3}GE)\\s?\\d+(/\\d+){0,3}(\\.\\d+)?\\b', color: 'blue' },
      // Juniper: ge-0/0/0, xe-0/0/1.0, et-0/0/2, irb.100, em0, fxp0
      { keyword: '\\b(ge|xe|et|fe|mge|lt|gr)-\\d+/\\d+/\\d+(\\.\\d+)?\\b|\\birb(\\.\\d+)?\\b|\\b(em|fxp|me)\\d+\\b', color: 'blue' },
      // slot/port: 1/1, HPE Aruba CX 1/1/1; Hirschmann cpu/1, lag/1
      { keyword: '\\b(cpu|vlan|lag|ch)\\s?/?\\d+(/\\d+)?\\b|\\b\\d/\\d{1,2}(/\\d{1,2})?\\b', color: 'blue' }
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
