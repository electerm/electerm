#pragma once
#include <sys/types.h>

pid_t term_start(const char *path, char *const argv[], char *const envp[],
                 const char *directory, unsigned short cols, unsigned short rows, int *master);
void term_resize(int master, unsigned short cols, unsigned short rows);
