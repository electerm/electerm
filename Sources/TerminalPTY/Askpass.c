#include "TerminalPTY.h"
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/stat.h>
#include <libproc.h>
#include <readpassphrase.h>
#include <fcntl.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <unistd.h>

static int local_address(struct sockaddr_un *addr, const char *path) {
    addr->sun_family = AF_UNIX;
    return strlcpy(addr->sun_path, path, sizeof(addr->sun_path)) < sizeof(addr->sun_path);
}

// The socket lives beside the OpenSSH control socket in a mode-0700 directory.
int term_password_listener(const char *path) {
    struct sockaddr_un addr = {0};
    if (!local_address(&addr, path)) return -1;
    int fd = socket(AF_UNIX, SOCK_STREAM, 0);
    if (fd < 0) return -1;
    if (fcntl(fd, F_SETFD, FD_CLOEXEC) || fcntl(fd, F_SETFL, O_NONBLOCK) ||
        bind(fd, (struct sockaddr *)&addr, sizeof(addr)) || listen(fd, 4)) {
        close(fd); return -1;
    }
    return fd;
}

int term_password_accept(int server, pid_t ssh_pid, const char *helper) {
    int fd = accept(server, NULL, NULL);
    if (fd < 0) return -1;
    pid_t peer = 0;
    socklen_t len = sizeof(peer);
    struct proc_bsdinfo info;
    char exe[PROC_PIDPATHINFO_MAXSIZE];
    struct stat actual, expected;
    // Only the packaged helper launched directly by THIS login's OpenSSH may read.
    if (fcntl(fd, F_SETFD, FD_CLOEXEC) == 0 && ssh_pid > 0 &&
        !getsockopt(fd, SOL_LOCAL, LOCAL_PEERPID, &peer, &len) &&
        proc_pidinfo(peer, PROC_PIDTBSDINFO, 0, &info, sizeof(info)) == sizeof(info) &&
        info.pbi_ppid == (unsigned)ssh_pid && proc_pidpath(peer, exe, sizeof(exe)) > 0 &&
        !stat(exe, &actual) && !stat(helper, &expected) &&
        actual.st_dev == expected.st_dev && actual.st_ino == expected.st_ino) return fd;
    close(fd); return -1;
}

int term_askpass(const char *path, const char *target_prompt, const char *prompt) {
    const char *hint = getenv("SSH_ASKPASS_PROMPT");
    char buf[1024] = {0};
    if (!hint && target_prompt && strcmp(prompt, target_prompt) == 0) {
        struct sockaddr_un addr = {0};
        int fd = socket(AF_UNIX, SOCK_STREAM, 0);
        if (fd >= 0) {
            size_t n = 0;
            if (local_address(&addr, path) && !connect(fd, (struct sockaddr *)&addr, sizeof(addr))) {
                ssize_t k;
                while (n < sizeof(buf)-1 && (k = read(fd, buf+n, sizeof(buf)-1-n)) > 0) n += k;
            }
            close(fd);
            if (n && buf[n-1] == '\n') {
                int ok = fwrite(buf, 1, n, stdout) == n;
                memset_s(buf, sizeof(buf), 0, sizeof(buf)); return ok ? 0 : 1;
            }
        }
    }
    // Unknown host keys, wrong passwords, jump hosts and key passphrases stay interactive.
    if (hint && strcmp(hint, "none") == 0) {
        int tty = open("/dev/tty", O_WRONLY);
        if (tty >= 0) { dprintf(tty, "%s\n", prompt); close(tty); }
        return 0;
    }
    int flags = RPP_REQUIRE_TTY;
    if ((hint && strcmp(hint, "confirm") == 0) || strstr(prompt, "(yes/no")) flags |= RPP_ECHO_ON;
    if (!readpassphrase(prompt, buf, sizeof(buf), flags)) return 1;
    if (hint && strcmp(hint, "confirm") == 0 && strcasecmp(buf, "yes") != 0) return 1;
    int ok = puts(buf) != EOF;
    memset_s(buf, sizeof(buf), 0, sizeof(buf)); return ok ? 0 : 1;
}
