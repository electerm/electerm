#!/bin/bash
# Local OpenSSH fixture for the e2e suite.
#
# The e2e specs talk to a real sshd with password auth (see
# src/test/e2e/common/env.js: TEST_HOST/TEST_USER/TEST_PASS/TEST_PORT). That
# used to be a shared external test machine fed from repository secrets; this
# script stands up an equivalent server on 127.0.0.1 so CI (and any Linux box)
# needs nothing but the runner itself.
#
#   sudo bash src/build/bin/local-ssh-test-server.sh
#   TEST_HOST=127.0.0.1 TEST_PORT=2222 TEST_USER=etest \
#     TEST_PASS=electerm-test npm run test1
#
# It is idempotent: re-running reuses the user, the host key and the port.
# Linux only (it creates a user and starts sshd); the macOS CI jobs do not run
# the e2e suite. On macOS run it in a container and publish the port:
#   docker run --rm -d --name electerm-sshd -p 2222:2222 \
#     -e LOCAL_SSH_BIND=0.0.0.0 -v "$PWD":/repo -w /repo ubuntu:24.04 bash -c \
#     'apt-get update -qq && apt-get install -y -qq nodejs npm &&
#      bash src/build/bin/local-ssh-test-server.sh && sleep infinity'
#
# Requirements covered here, so the specs behave like they did on the external
# server:
#   - password auth (the "Trust and Save" host key prompt is handled by the
#     specs, so an unknown host key is fine)
#   - SFTP via `Subsystem sftp internal-sftp`
#   - a normal login shell with a non-empty home (terminal + file manager specs)
#   - trz / tsz (trzsz) and rz / sz (lrzsz), used by 020.trzsz-rzsz.spec.js

set -euo pipefail

PORT="${LOCAL_SSH_PORT:-2222}"
# 0.0.0.0 only when running in a container whose port is published
BIND_ADDR="${LOCAL_SSH_BIND:-127.0.0.1}"
TEST_USER="${LOCAL_SSH_USER:-etest}"
TEST_PASS="${LOCAL_SSH_PASS:-electerm-test}"
HOME_DIR="/home/${TEST_USER}"
CONF_DIR="/etc/electerm-sshd"
HOST_KEY="${CONF_DIR}/host_ed25519_key"
CONFIG="${CONF_DIR}/sshd_config"
PID_FILE="${CONF_DIR}/sshd.pid"
LOG_FILE="${CONF_DIR}/sshd.log"

log () {
  printf '[local-ssh] %s\n' "$*"
}

if [ "$(id -u)" -ne 0 ]; then
  echo "[local-ssh] must run as root (use sudo)" >&2
  exit 1
fi

if [ "$(uname -s)" != 'Linux' ]; then
  echo "[local-ssh] Linux only" >&2
  exit 1
fi

# ---------------------------------------------------------------- packages ---
missing=''
command -v ssh-keygen >/dev/null 2>&1 || missing="$missing openssh-client"
if [ ! -x /usr/sbin/sshd ]; then
  missing="$missing openssh-server"
fi
if ! command -v rz >/dev/null 2>&1 || ! command -v sz >/dev/null 2>&1; then
  missing="$missing lrzsz"
fi
# curl is only needed to fetch the trzsz release below
if ! command -v trz >/dev/null 2>&1 || ! command -v tsz >/dev/null 2>&1; then
  command -v curl >/dev/null 2>&1 || missing="$missing curl"
fi
if [ -n "$missing" ]; then
  log "installing:$missing"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  # shellcheck disable=SC2086
  apt-get install -y -qq $missing >/dev/null
fi

# Upstream CI images carry runuser/sshd but not necessarily the sftp helper;
# `internal-sftp` below needs neither.
if [ ! -x /usr/sbin/sshd ]; then
  echo "[local-ssh] /usr/sbin/sshd is still missing after install" >&2
  exit 1
fi

# trzsz: not packaged in Debian/Ubuntu. The Go release binary is a single
# static file, so prefer it (that is what the old external test server had);
# the npm package is the same protocol in JS and serves as a fallback for
# runners that cannot reach github.com, pip is the last resort.
have_trzsz () {
  command -v trz >/dev/null 2>&1 && command -v tsz >/dev/null 2>&1
}

trzsz_from_release () {
  arch="$(uname -m)"
  case "$arch" in
    x86_64) trzsz_arch='x86_64' ;;
    aarch64|arm64) trzsz_arch='aarch64' ;;
    *) return 1 ;;
  esac
  tmp="$(mktemp -d)"
  log "downloading trzsz ($trzsz_arch)"
  # asset names embed the version (trzsz_1.2.0_linux_x86_64.tar.gz), so ask the
  # release API for the current URL instead of guessing one
  api='https://api.github.com/repos/trzsz/trzsz-go/releases/latest'
  auth=()
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    auth=(-H "Authorization: Bearer ${GITHUB_TOKEN}")
  fi
  url="$(curl -fsSL --retry 2 "${auth[@]}" "$api" 2>/dev/null |
    grep -o "https://[^\"]*trzsz_[0-9.]*_linux_${trzsz_arch}\\.tar\\.gz" |
    head -n 1 || true)"
  ok=''
  if [ -n "$url" ] &&
    curl -fsSL --retry 2 -o "${tmp}/trzsz.tar.gz" "$url" 2>/dev/null; then
    tar -xzf "${tmp}/trzsz.tar.gz" -C "$tmp"
    for bin in trz tsz; do
      # the archive holds the binaries at its root or in a sub directory
      src="$(find "$tmp" -type f -name "$bin" | head -n 1)"
      if [ -n "$src" ]; then
        install -m 0755 "$src" "/usr/local/bin/${bin}"
        ok=yes
      fi
    done
  fi
  rm -rf "$tmp"
  [ -n "$ok" ]
}

trzsz_from_npm () {
  log 'release download unavailable, installing trzsz from npm'
  npm install -g --silent trzsz >/dev/null 2>&1
}

trzsz_from_pip () {
  log 'npm install unavailable, installing trzsz from pip'
  python3 -m pip install --quiet --break-system-packages trzsz >/dev/null 2>&1 ||
    python3 -m pip install --quiet trzsz >/dev/null 2>&1
}

# A missing trz/tsz only breaks 020.trzsz-rzsz.spec.js, so never abort the
# fixture (and the whole job) because a download failed.
if ! have_trzsz; then
  (trzsz_from_release || trzsz_from_npm || trzsz_from_pip) || true
fi
if ! have_trzsz; then
  echo '[local-ssh] warning: trz/tsz unavailable, 020.trzsz-rzsz.spec.js will fail' >&2
fi

# ------------------------------------------------------------------- user ---
if ! id "$TEST_USER" >/dev/null 2>&1; then
  log "creating user $TEST_USER"
  useradd --create-home --home-dir "$HOME_DIR" --shell /bin/bash "$TEST_USER"
fi
echo "${TEST_USER}:${TEST_PASS}" | chpasswd

# A fresh CI runner gets an empty home, while the external test server kept a
# normal login environment there. Seed the shell startup files the way Ubuntu
# ships them, so interactive terminals and the file manager see the same shape.
if [ ! -f "${HOME_DIR}/.bashrc" ]; then
  cp -f /etc/skel/.bashrc "${HOME_DIR}/.bashrc" 2>/dev/null || true
  cp -f /etc/skel/.profile "${HOME_DIR}/.profile" 2>/dev/null || true
  cp -f /etc/skel/.bash_logout "${HOME_DIR}/.bash_logout" 2>/dev/null || true
fi
if [ ! -d "${HOME_DIR}/Documents" ]; then
  mkdir -p "${HOME_DIR}/Documents"
fi
chown -R "${TEST_USER}:${TEST_USER}" "$HOME_DIR"
chmod 0755 "$HOME_DIR"

# ----------------------------------------------------------------- sshd -----
mkdir -p "$CONF_DIR"
chmod 0755 "$CONF_DIR"

if [ ! -f "$HOST_KEY" ]; then
  log 'generating host key'
  ssh-keygen -q -t ed25519 -N '' -C 'electerm-local-test-server' -f "$HOST_KEY"
fi

cat > "$CONFIG" <<EOF
# generated by src/build/bin/local-ssh-test-server.sh -- test only, never
# expose this outside 127.0.0.1
Port ${PORT}
ListenAddress ${BIND_ADDR}
HostKey ${HOST_KEY}
PidFile ${PID_FILE}
PasswordAuthentication yes
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PermitRootLogin no
PubkeyAuthentication yes
UsePAM yes
AllowUsers ${TEST_USER}
PrintMotd no
PrintLastLog no
AcceptEnv LANG LC_*
MaxAuthTries 10
MaxSessions 50
MaxStartups 50:30:100
ClientAliveInterval 30
ClientAliveCountMax 10
Subsystem sftp internal-sftp
EOF
chmod 0600 "$CONFIG"

mkdir -p /run/sshd
chmod 0755 /run/sshd

# restart when a previous run (or a stale pid) is still around
if [ -f "$PID_FILE" ]; then
  old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
    log "stopping previous sshd ($old_pid)"
    kill "$old_pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 "$old_pid" 2>/dev/null || break
      sleep 0.2
    done
    kill -9 "$old_pid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi
# a leftover listener from another host-side sshd would make the new one abort
if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
  log "port ${PORT} already in use, reusing the running server"
else
  log "starting sshd on 127.0.0.1:${PORT}"
  /usr/sbin/sshd -f "$CONFIG" -E "$LOG_FILE"
fi

# --------------------------------------------------------------- smoke test --
for _ in $(seq 1 50); do
  if (exec 3<>"/dev/tcp/127.0.0.1/${PORT}") 2>/dev/null; then
    exec 3>&-
    break
  fi
  sleep 0.2
done

node - <<EOF
const { Client } = require('@electerm/ssh2')
const conn = new Client()
const fail = (msg) => {
  console.error('[local-ssh] smoke test failed: ' + msg)
  process.exit(1)
}
// what a spec's first seconds do: password login, an exec channel (terminal
// commands), and an SFTP roundtrip in the home directory
conn.on('ready', () => {
  conn.exec('printf ok; command -v trz; command -v rz; command -v sz', (err, stream) => {
    if (err) fail(err.message)
    let out = ''
    stream.on('data', d => { out += d })
    stream.stderr.on('data', d => { out += d })
    stream.on('close', () => {
      if (!/^ok/.test(out)) fail('exec channel returned unexpected output: ' + out)
      const missing = ['trz', 'rz', 'sz'].filter(b => !out.includes(b))
      conn.sftp((err, sftp) => {
        if (err) fail(err.message)
        const file = '/home/${TEST_USER}/.electerm-fixture-check'
        sftp.writeFile(file, 'fixture', (err) => {
          if (err) fail('sftp write: ' + err.message)
          sftp.readFile(file, (err, data) => {
            if (err) fail('sftp read: ' + err.message)
            sftp.unlink(file, () => {
              sftp.readdir('/home/${TEST_USER}', (err, list) => {
                conn.end()
                if (err) fail('sftp list: ' + err.message)
                console.log('[local-ssh] login ok, sftp ok, home entries: ' +
                  list.length + ', transfer tools: ' +
                  (missing.length ? 'missing ' + missing.join(',') : 'ok'))
              })
            })
          })
        })
      })
    })
  })
})
conn.on('error', e => fail(e.message))
conn.connect({
  host: '127.0.0.1',
  port: Number(process.env.LOCAL_SSH_PORT || ${PORT}),
  username: '${TEST_USER}',
  password: '${TEST_PASS}',
  hostVerifier: () => true,
  readyTimeout: 20000
})
EOF

cat <<EOF
[local-ssh] ready. Use it with:
  export TEST_HOST=127.0.0.1
  export TEST_PORT=${PORT}
  export TEST_USER=${TEST_USER}
  export TEST_PASS=${TEST_PASS}
EOF
