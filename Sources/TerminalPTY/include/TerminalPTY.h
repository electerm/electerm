#pragma once
#include <sys/types.h>

pid_t term_start(const char *path, char *const argv[], char *const envp[],
                 const char *directory, unsigned short cols, unsigned short rows, int *master);
void term_resize(int master, unsigned short cols, unsigned short rows);

int term_password_listener(const char *path);
int term_password_accept(int server, pid_t ssh_pid, const char *helper);
int term_askpass(const char *socket_path, const char *target_prompt, const char *prompt);
