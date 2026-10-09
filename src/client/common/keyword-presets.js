/**
 * Built-in keyword highlight presets, offered next to keyword import/export.
 * Applying a preset adds its rules after the user's existing ones (skipping
 * rules already present), so it never discards custom keywords.
 *
 * These rule sets are written for terminal output. The open-source
 * collections that exist are close, but none of them is drop-in:
 *   - grc (github.com/garabik/grc) ships ~60 per-command `conf.*` files
 *     (conf.dockerps, conf.kubectl, conf.systemctl, conf.gcc, conf.log, ...).
 *   - tailspin (github.com/bensadeh/tailspin) ships fixed highlight groups:
 *     dates, durations, keywords (severities, booleans, nulls, HTTP methods),
 *     URLs, numbers, IPv4, quotes, unix paths, HTTP methods, UUIDs,
 *     key-value pairs, pointer addresses, unix processes.
 *   - VS Code Log File Highlighter
 *     (github.com/emilast/vscode-logfile-highlighter) ships a log4net-style
 *     TextMate grammar: dates/times, log levels, numeric and .NET constants,
 *     strings, GUIDs, MACs, exception types, stack traces, URLs, namespaces.
 *   - lnav (github.com/tstack/lnav) ships ~60 JSON log format definitions
 *     (access_log, error_log, journald_json, java_log, redis_log, ...).
 * They are per-command shell wrappers or editor grammars, and none of them
 * uses ANSI colour names, so these presets follow their categories rather
 * than their files.
 */

// Patterns shared by several presets. mergeKeywordPreset dedupes on the
// pattern string, so a rule that appears in two presets is only added once.
const ipv4 = '\\b(25[0-5]|2[0-4]\\d|1?\\d?\\d)(\\.(25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}(/\\d{1,2})?\\b'
const ipv6 = '(?<![\\w:])(?:(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,7}:|(?:[0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}:){1,5}(?::[0-9a-f]{1,4}){1,2}|(?:[0-9a-f]{1,4}:){1,4}(?::[0-9a-f]{1,4}){1,3}|(?:[0-9a-f]{1,4}:){1,3}(?::[0-9a-f]{1,4}){1,4}|(?:[0-9a-f]{1,4}:){1,2}(?::[0-9a-f]{1,4}){1,5}|[0-9a-f]{1,4}:(?::[0-9a-f]{1,4}){1,6}|:(?::[0-9a-f]{1,4}){1,7}|::)(?![\\w:])'
const mac = '\\b([0-9a-f]{2}[:-]){5}[0-9a-f]{2}\\b|\\b[0-9a-f]{4}\\.[0-9a-f]{4}\\.[0-9a-f]{4}\\b'
const srcExt = 'c|cc|cpp|cxx|h|hh|hpp|hxx|m|mm|go|rs|java|kt|kts|scala|ts|tsx|js|jsx|mjs|cjs|py|pyi|rb|php|cs|swift|zig|lua|pl|pm|ex|exs|erl|dart|sh|bash|zsh|ps1|sql|json|ya?ml|toml|ini|cfg|conf|properties|styl|css|scss|sass|less|html|vue|svelte|md|txt|log|csv|tsv'
// source file name, and file:line(:col) as printed by compilers and stack traces
const srcFile = '\\b[\\w./~-]+\\.(' + srcExt + ')\\b'
const srcLoc = '\\b[\\w./~-]+\\.(' + srcExt + ')\\b(:\\d+){1,2}'

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
      { keyword: mac, color: 'magenta' },
      // IPv4 with optional prefix length
      { keyword: ipv4, color: 'cyan' },
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
  },
  {
    name: 'Syslog & systemd',
    description: 'journalctl, /var/log/syslog and messages, systemd unit output: severity, unit lifecycle states, unit names, timestamps, PIDs',
    keywords: [
      // severity, worst first so the more specific word wins
      { keyword: '\\b(emerg(ency)?|alert|crit(ical)?|panic|fatal)\\b', color: 'red' },
      { keyword: '\\b(err(or)?|fail(ed|ure|ures)?|denied|refused|timeout|timed out|unreachable|corrupt(ed)?|segfault|core[- ]dump(ed)?)\\b', color: 'red' },
      { keyword: '\\b(warn(ing)?)\\b', color: 'yellow' },
      { keyword: '\\b(notice)\\b', color: 'cyan' },
      { keyword: '\\b(info(rmational)?)\\b', color: 'cyan' },
      { keyword: '\\b(debug)\\b', color: 'blue' },
      // systemd unit lifecycle
      { keyword: '\\b(failed|dead|inactive|killed|masked|not[- ]found)\\b', color: 'red' },
      { keyword: '\\b(started|starting|active|running|reached|succeeded|success(fully)?|listening|mounted|finished|enabled)\\b', color: 'green' },
      { keyword: '\\b(stopping|stopped|reloading|reload(ed)?|deactivating|activating|waiting|pending|scheduled|restart(ing|ed)?|retrying|degraded)\\b', color: 'yellow' },
      // unit names: nginx.service, ssh.socket, systemd-tmpfiles-clean.timer
      { keyword: '\\b[a-z0-9][a-z0-9@._-]*\\.(service|socket|target|timer|mount|automount|device|path|slice|scope|swap)\\b', color: 'blue' },
      // ISO-8601 and syslog timestamps
      { keyword: '\\b\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}([.,]\\d{1,6})?(Z|[+-]\\d{2}:?\\d{2})?\\b', color: 'cyan' },
      { keyword: '\\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) {1,2}\\d{1,2} \\d{2}:\\d{2}:\\d{2}\\b', color: 'cyan' },
      { keyword: '\\b\\d{2}:\\d{2}:\\d{2}([.,]\\d{1,6})?\\b', color: 'cyan' },
      { keyword: '\\b(pid|PID)[= ]\\d+\\b', color: 'magenta' },
      { keyword: '\\b(sshd|sudo|systemd|crond?|dbus-daemon|NetworkManager|polkitd|rsyslogd|logind|kernel)\\[[0-9]+\\]', color: 'blue' },
      { keyword: ipv4, color: 'cyan' },
      { keyword: ipv6, color: 'magenta' }
    ]
  },
  {
    name: 'Linux kernel & dmesg',
    description: 'dmesg, the kernel ring buffer and boot messages: OOM killer, segfaults, hardware and I/O errors, device, link and driver events',
    keywords: [
      { keyword: '\\b(kernel panic|general protection fault|unable to handle (kernel )?paging request|segfault|out of memory|oom[- ]kill(er)?|killed process|call trace|hardware error|machine check|medium error|unrecoverable (read|error)|i/o error|buffer i/o error|ext4-fs error|xfs .*corruption|reset .* failed|device not ready|link is not ready|firmware (bug|error)|stack corruption|bad rip value|blocked for more than)\\b', color: 'red' },
      { keyword: '\\b(error|err|fail(ed|ure)?|fatal|denied|timeout|timed out|dropped|refused|corrupt)\\b', color: 'red' },
      { keyword: '\\b(warn(ing)?|deprecated|falling back|retry(ing)?|deferred|link is down|disconnected|removed|suspended|unstable|degraded|overcurrent|throttl(ed|ing)|thermal|under-voltage|over-voltage)\\b', color: 'yellow' },
      { keyword: '\\b(link is up|link up|registered|initialized|attached|mounted|enabled|detected|ready|success(ful)?|started|inserted|now attached|power on|resumed|link becomes ready)\\b', color: 'green' },
      // device names
      { keyword: '\\b(ata\\d+(\\.\\d+)?|sd[a-z]\\d*|nvme\\d+n\\d+(p\\d+)?|mmcblk\\d+(p\\d+)?|dm-\\d+|md\\d+|eth\\d+|wlan\\d+|enp\\d+s\\d+|eno\\d+|wlp\\d+s\\d+|usb \\d+-\\d+(\\.\\d+)?|tty(S|USB|ACM)\\d+|br-\\d+|veth[0-9a-f]+)\\b', color: 'blue' },
      { keyword: '\\b[0-9a-f]{4}:[0-9a-f]{2}:[0-9a-f]{2}\\.\\d\\b|\\b[0-9a-f]{4}:[0-9a-f]{4}\\b', color: 'magenta' },
      { keyword: '\\bcpu\\d+\\b', color: 'magenta' },
      { keyword: '\\bLinux version \\S+\\b', color: 'cyan' },
      // dmesg's own [   12.345678] prefix
      { keyword: '\\[\\s*\\d+\\.\\d+\\]', color: 'cyan' },
      { keyword: '\\b\\d+(\\.\\d+)?\\s?(MB|GB|KB|TB)/s\\b|\\b\\d+(\\.\\d+)?\\s?(MiB|GiB|KiB|TiB)\\b', color: 'cyan' }
    ]
  },
  {
    name: 'HTTP & web logs',
    description: 'nginx and Apache access and error logs, and most web framework request logs: methods, status codes by class, latency, upstream hosts, user agents, paths',
    keywords: [
      // Apache / nginx timestamp, first so the date parts are not picked up
      // by the path or host:port rules
      { keyword: '\\[\\d{2}/\\w{3}/\\d{4}:\\d{2}:\\d{2}:\\d{2} [+-]\\d{4}\\]', color: 'cyan' },
      { keyword: '\\b\\d{2}:\\d{2}:\\d{2}([.,]\\d{1,6})?\\b', color: 'cyan' },
      // status code, coloured by class. The lookbehind requires the closing
      // quote of the request line, so arbitrary three-digit numbers are left alone
      { keyword: '(?<="\\s)5\\d{2}\\b', color: 'red' },
      { keyword: '(?<="\\s)4\\d{2}\\b', color: 'yellow' },
      { keyword: '(?<="\\s)3\\d{2}\\b', color: 'cyan' },
      { keyword: '(?<="\\s)[12]\\d{2}\\b', color: 'green' },
      { keyword: '\\bstatus[=: ]\\s*5\\d{2}\\b', color: 'red' },
      { keyword: '\\bstatus[=: ]\\s*4\\d{2}\\b', color: 'yellow' },
      // URLs, then the request line: method + path + protocol
      { keyword: '\\bhttps?://[^\\s"\']+', color: 'blue' },
      { keyword: '\\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE|CONNECT)\\s+\\S+\\s+HTTP/', color: 'blue' },
      { keyword: '\\bHTTP/\\d(\\.\\d)?', color: 'blue' },
      // absolute paths, but not the "/09" in a date, the "//" in a URL or the
      // "/or" in "and/or"
      { keyword: '(?<![\\w/])/[\\w.~%!$&()*+,;=:@-]{2,}', color: 'blue' },
      // latency
      { keyword: '\\b\\d+(\\.\\d+)?\\s?(ms|us|µs)\\b', color: 'cyan' },
      { keyword: '\\b(request_time|upstream_response_time|request_time_ms|duration|latency|elapsed|took)[=:]\\s*\\d+(\\.\\d+)?', color: 'cyan' },
      // host:port, but not the "08:57" inside a timestamp
      { keyword: '\\bupstream\\b', color: 'magenta' },
      { keyword: '\\b(?:[a-z][a-z0-9.-]*|\\d{1,3}(?:\\.\\d{1,3}){3}):\\d{2,5}\\b', color: 'magenta' },
      { keyword: '\\b(Mozilla/5\\.0|curl/\\S+|Wget/\\S+|Googlebot(?:/\\S+)?|bingbot(?:/\\S+)?|python-requests/\\S+|Go-http-client/\\S+|okhttp/\\S+|PostmanRuntime/\\S+|Apache-HttpClient/\\S+|axios/\\S+|node-fetch/\\S+|Electron/\\S+)\\b', color: 'magenta' },
      { keyword: ipv4, color: 'cyan' },
      // error-log severity in brackets
      { keyword: '\\[(emerg|alert|crit|error)\\]', color: 'red' },
      { keyword: '\\[(warn|notice)\\]', color: 'yellow' },
      { keyword: '\\[(info|debug)\\]', color: 'cyan' }
    ]
  },
  {
    name: 'Application log levels',
    description: 'Generic application logs (log4j/slf4j, Python logging, Go slog, Rust tracing, Node winston/pino): levels, timestamps, thread and logger names, exception types, tracing ids',
    keywords: [
      { keyword: '\\b(FATAL|CRITICAL|PANIC|EMERG(ENCY)?|ALERT|SEVERE)\\b', color: 'red' },
      { keyword: '\\b(ERROR|ERR|EXCEPTION|TRACEBACK|STACK ?TRACE|CAUSED BY|FAIL(ED|URE)?)\\b', color: 'red' },
      { keyword: '\\b(WARN(ING)?)\\b', color: 'yellow' },
      { keyword: '\\b(NOTICE)\\b', color: 'cyan' },
      { keyword: '\\b(INFO(RMATION)?)\\b', color: 'green' },
      { keyword: '\\b(DEBUG|TRACE|VERBOSE|FINE(ST)?)\\b', color: 'blue' },
      { keyword: '\\b(true|false|null|nil|undefined|None|NaN)\\b', color: 'magenta' },
      { keyword: '\\b\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}([.,]\\d{1,6})?(Z|[+-]\\d{2}:?\\d{2})?\\b', color: 'cyan' },
      { keyword: '\\b\\d{2}:\\d{2}:\\d{2}([.,]\\d{1,6})?\\b', color: 'cyan' },
      { keyword: '\\b\\d+(\\.\\d+)?\\s?(ms|us|µs|ns)\\b', color: 'cyan' },
      // tracing / correlation ids, in "k=v" and in JSON "k": "v" form
      { keyword: '\\b(trace_?id|span_?id|request_?id|correlation_?id|session_?id|user_?id)["\']?\\s*[=:]\\s*["\']?[\\w.:-]+', color: 'magenta' },
      // exception class names
      { keyword: '\\b[A-Z][A-Za-z0-9]*(Error|Exception|Throwable|Fault|Panic)\\b', color: 'red' },
      // logger / package names: com.example.Foo, my.pkg.module
      { keyword: '\\b([A-Za-z_][A-Za-z0-9_]*\\.){2,}[A-Za-z_][A-Za-z0-9_]*\\b', color: 'blue' },
      // thread names: [main], [worker-3], [pool-2-thread-1]
      { keyword: '\\[(main|worker[- ]?\\d+|pool-\\d+-thread-\\d+|Thread-\\d+|goroutine \\d+|[A-Za-z0-9_-]{1,20}-\\d+)\\]', color: 'blue' },
      { keyword: srcLoc, color: 'magenta' },
      { keyword: ipv4, color: 'cyan' },
      { keyword: ipv6, color: 'magenta' }
    ]
  },
  {
    name: 'Docker & Kubernetes',
    description: 'docker ps/images/compose and kubectl get/describe/logs output: container states, pod phases and events, resource references, image tags and digests, ports, ages, restart counts',
    keywords: [
      // container states and pod phases that mean trouble
      { keyword: '\\b(CrashLoopBackOff|ErrImagePull|ImagePullBackOff|CreateContainerConfigError|CreateContainerError|InvalidImageName|OOMKilled|Evicted|Failed|FailedScheduling|Error|BackOff|Unhealthy|Dead|Removing|NotReady|Terminating|NoSchedule)\\b', color: 'red' },
      { keyword: '\\bExited \\([1-9]\\d*\\)', color: 'red' },
      { keyword: '\\b(Pending|ContainerCreating|Init:\\d+/\\d+|PodInitializing|Waiting|SchedulingDisabled|Unknown|Paused|Restarting|Preempting|Completed|Succeeded|Warning)\\b', color: 'yellow' },
      { keyword: '\\b(Running|Ready|Healthy|Active|Bound|Started|Pulled|Created|Available|Deployed|Up \\d+ (second|minute|hour|day|week|month|year)s?|Exited \\(0\\))\\b', color: 'green' },
      // resource references: deployment/nginx, pods/nginx-1, svc/api
      { keyword: '\\b(pods?|deploy(ment)?s?|svc|services?|ingress(es)?|configmaps?|secrets?|statefulsets?|daemonsets?|replicasets?|jobs?|cronjobs?|namespaces?|nodes?|pv|pvc|endpoints?|hpa|events?)/[a-z0-9][a-z0-9.-]*\\b', color: 'blue' },
      // generated pod / container names: nginx-7d9f8c6b5-x2k4p
      { keyword: '\\b[a-z0-9][a-z0-9-]*-[0-9a-f]{5,10}-[a-z0-9]{4,6}\\b', color: 'magenta' },
      // AGE column: 12m, 45s, 3d4h
      { keyword: '\\b\\d+[dhms](\\d+[dhms])*\\b', color: 'cyan' },
      // restart counts: "3 (4m ago)"
      { keyword: '\\b\\d+ \\(\\d+[dhms]+ ago\\)', color: 'magenta' },
      // well-known image names, with or without a tag. The trailing lookahead
      // keeps the "nginx" in a pod name like nginx-7d9f8c6b5-x2k4p intact
      { keyword: '\\b(nginx|redis|postgres|mysql|mariadb|mongo|alpine|ubuntu|debian|busybox|python|golang|openjdk|eclipse-temurin|rabbitmq|kafka|elasticsearch|traefik|haproxy|caddy|vault|consul|etcd|prometheus|grafana|jenkins|gitlab-runner|fluentd|fluent-bit|metrics-server|kube-[a-z-]+)(:[a-zA-Z0-9._-]+)?(?![\\w-])', color: 'magenta' },
      // registry references and digests
      { keyword: '\\b[a-z0-9-]+(\\.[a-z0-9-]+)+(:\\d+)?/[a-z0-9._/-]+(:[a-zA-Z0-9._-]+)?\\b', color: 'magenta' },
      { keyword: '\\bsha256:[0-9a-f]{12,64}\\b', color: 'magenta' },
      // ports and port mappings. Two rules, not one alternation: a single rule
      // that matches "0.0.0.0:8080" would resume scanning after it and never
      // see the "8080->80/tcp" that sits inside that span
      { keyword: '\\b\\d{1,5}->\\d{1,5}/(tcp|udp)\\b', color: 'magenta' },
      { keyword: '(?<![\\w])(0\\.0\\.0\\.0|\\*|::):\\d{1,5}\\b', color: 'magenta' },
      { keyword: ipv4, color: 'cyan' },
      { keyword: ipv6, color: 'magenta' }
    ]
  },
  {
    name: 'Build & test output',
    description: 'gcc/clang, tsc, eslint, make, maven/gradle, go build and pytest/jest/go test/cargo test: diagnostics, file:line:col locations, pass/fail/skip results, timings',
    keywords: [
      { keyword: '\\b(error|errors|failed|failure|failures|fatal|cannot find|not found|no such file|undefined reference|undefined symbol|unresolved|cannot resolve|permission denied|eacces|enoent|segmentation fault|abort(ed)?|core dumped|panicked)\\b', color: 'red' },
      { keyword: '\\b(FAIL|FAILED|FAILURES?|✗|✘|✖)\\b', color: 'red' },
      { keyword: '\\b(vulnerabilit(y|ies))\\b', color: 'red' },
      { keyword: '\\b(warning|warnings|warn|deprecated|deprecation|outdated|hint)\\b', color: 'yellow' },
      { keyword: '\\b(skip|skipped|pending|todo|xfail|xpass|ignored)\\b', color: 'yellow' },
      { keyword: '\\b(PASS|PASSED|passed|ok|success|successful|SUCCESS|✔|✓|√)\\b', color: 'green' },
      { keyword: '\\b(build succeeded|build success(ful)?|compilation complete|compiled successfully|nothing to do|up to date|all tests passed|done|finished)\\b', color: 'green' },
      { keyword: '\\b(building|compiling|linking|bundling|transpiling|minifying|installing|resolving|downloading|fetching|running|executing|starting|cleaning|caching|packaging|publishing)\\b', color: 'blue' },
      { keyword: srcLoc, color: 'magenta' },
      { keyword: srcFile, color: 'blue' },
      { keyword: '\\b\\d+(\\.\\d+)?\\s?(ms|us|µs|ns|s|sec|secs|seconds|m|min|mins)\\b', color: 'cyan' },
      { keyword: '\\b\\d+(\\.\\d+)?%', color: 'cyan' },
      { keyword: '\\b(elapsed|took|duration|wall time)[=: ]+\\d+(\\.\\d+)?\\s?\\w*', color: 'cyan' },
      { keyword: '\\b\\d+ (passed|failed|skipped|pending|todo|tests?|warnings?|errors?|packages?)\\b', color: 'magenta' },
      { keyword: '\\b(added|removed|changed|updated) \\d+ packages?\\b', color: 'magenta' },
      { keyword: ipv4, color: 'cyan' }
    ]
  },
  {
    name: 'Git',
    description: 'git status/log/diff/fetch/push/pull/merge output: branch and tracking state, changed and untracked files, conflicts, commit ids, diff hunks',
    keywords: [
      { keyword: '\\b(conflict|conflicts|both modified|both added|both deleted|deleted by (us|them)|added by (us|them)|unmerged|rejected|non-fast-forward|failed to push|detached HEAD|fatal|error|aborting|aborted|refusing to|would be overwritten|not possible to fast-forward)\\b', color: 'red' },
      { keyword: '\\b(up[- ]to[- ]date|already up to date|everything up-to-date|fast-forward|nothing to commit|working tree clean|successfully|created|deleted branch|merged|rebase(d)? successfully)\\b', color: 'green' },
      { keyword: '\\b(modified|deleted|renamed|copied|untracked|staged|unstaged|ahead of|behind|diverged|no changes added to commit|changes not staged|changes to be committed)\\b', color: 'yellow' },
      { keyword: '\\b(ahead of|behind) \\S+ by \\d+ commits?\\b', color: 'cyan' },
      { keyword: '\\bon branch \\S+', color: 'green' },
      { keyword: '\\b(Merge branch|Merge pull request|Merge remote-tracking branch|Merge tag)\\b', color: 'cyan' },
      { keyword: '\\b(HEAD|FETCH_HEAD|ORIG_HEAD|origin|upstream|main|master|develop|trunk|staging|production|release)/[\\w./-]+\\b', color: 'blue' },
      { keyword: '\\b(origin|upstream)/[\\w.-]+\\b', color: 'blue' },
      { keyword: '\\bcommit [0-9a-f]{7,40}\\b', color: 'magenta' },
      { keyword: '\\b[0-9a-f]{40}\\b', color: 'magenta' },
      { keyword: '\\bindex [0-9a-f]{7,}\\.\\.[0-9a-f]{7,}( \\d+)?\\b', color: 'magenta' },
      { keyword: '@@ -\\d+(,\\d+)? \\+\\d+(,\\d+)? @@', color: 'cyan' },
      { keyword: '\\bdiff --git\\b|\\bdiff --stat\\b', color: 'blue' },
      { keyword: '(?<!\\S)(\\+\\+\\+|---) [ab]/\\S+', color: 'blue' },
      { keyword: srcFile, color: 'blue' }
    ]
  },
  {
    name: 'Auth & security',
    description: 'sshd, sudo, PAM, fail2ban, nftables/iptables and TLS handshake output: logins, authentication failures, permission denials, blocked and allowed connections, key fingerprints',
    keywords: [
      { keyword: '\\b(failed password|authentication failure|auth(entication)? fail(ed|ure)?|invalid user|permission denied|access denied|not allowed|unauthorized|forbidden|break-in|refused|reject(ed)?|denied|dropped|blocked|banned|revoked|expired|certificate (has )?expired|self[- ]signed|unable to authenticate|too many authentication failures|connection closed by authenticating user|possible break-in attempt)\\b', color: 'red' },
      { keyword: '\\b(Accepted (password|publickey|keyboard-interactive|none|gssapi[\\w-]*)|session opened|session closed|successful(ly)?|logged in|login successful|authenticated|granted|new session|established|reverse mapping checking .* successful|COMMAND=)\\b', color: 'green' },
      { keyword: '\\b(warning|deprecated|weak|insecure|legacy|retrying|attempt|partial|unknown key|reverse mapping|not permitted|no matching host key)\\b', color: 'yellow' },
      { keyword: '\\b(DROP|REJECT|ACCEPT|DNAT|SNAT|MASQUERADE)\\b', color: 'magenta' },
      { keyword: '\\b(sshd|sudo|pam_[a-z]+|fail2ban|nft|iptables|firewalld|ufw|polkit|openssl|openssh|gssapi)\\b', color: 'blue' },
      // user names only where the surrounding words make it unambiguous
      { keyword: '(?<=\\buser )[a-z_][a-z0-9_-]*\\b', color: 'blue' },
      { keyword: '(?<=\\bfor )[a-z_][a-z0-9_-]*(?= from )', color: 'blue' },
      { keyword: '\\bport \\d{1,5}\\b', color: 'magenta' },
      { keyword: '\\b(SHA256:[A-Za-z0-9+/]{43}=?|MD5:[0-9a-f]{2}(:[0-9a-f]{2}){15})', color: 'magenta' },
      { keyword: '\\b(TLSv1(\\.[0-3])?|SSLv3|TLS_AES_\\w+|ECDHE[\\w-]*|cipher|handshake|verify (returned|ok|error)|Cipher is)\\b', color: 'cyan' },
      { keyword: '(?<![\\w])(/(?:etc|var|home|root|usr|opt|tmp|srv|run|proc|sys|dev)/[\\w./-]*)', color: 'blue' },
      { keyword: ipv4, color: 'cyan' },
      { keyword: ipv6, color: 'magenta' }
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
