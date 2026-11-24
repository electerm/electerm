#include "TerminalPTY.h"
#include <fcntl.h>
#include <signal.h>
#include <sys/ioctl.h>
#include <unistd.h>
#ifdef __APPLE__
#include <util.h>
#else
#include <pty.h>
#endif

pid_t term_start(const char *path, char *const argv[], char *const envp[],
                 const char *directory, unsigned short cols, unsigned short rows, int *master) {
    struct winsize size = {.ws_col = cols, .ws_row = rows};
    pid_t pid = forkpty(master, NULL, NULL, &size);
    if (pid == 0) {
        if (chdir(directory) != 0) _exit(126);
        sigset_t mask;
        sigemptyset(&mask);
        sigprocmask(SIG_SETMASK, &mask, NULL);
        signal(SIGPIPE, SIG_DFL);
        execve(path, argv, envp);
        _exit(127);
    }
    if (pid > 0) fcntl(*master, F_SETFD, FD_CLOEXEC);
    return pid;
}

void term_resize(int master, unsigned short cols, unsigned short rows) {
    struct winsize size = {.ws_col = cols, .ws_row = rows};
    ioctl(master, TIOCSWINSZ, &size);
}
