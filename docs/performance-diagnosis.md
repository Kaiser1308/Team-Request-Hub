# Performance Diagnosis

## Environment

- OS: WSL2 (kernel 6.6.87.2-microsoft-standard-WSL2) on Windows
- Node: v24.15.0
- npm: 11.12.1
- Python: 3.12.3
- WSL status: Running under WSL2 with Microsoft-standard kernel

## Measurements

| Check | Time | Notes |
| --- | ---: | --- |
| Frontend lint | 83s | 19% CPU, mostly I/O wait |
| Frontend build | 188s (3:08) | 49% CPU, compilation 21s, rest is I/O and page generation |
| Backend unittest | 25s | 0.3s test execution, 24s startup overhead |
| Backend import | 24s | Cold Python venv startup in WSL |
| Next dev first load | Not measured | Requires running dev server |
| Next dev warm load | Not measured | Requires running dev server |

## Conclusion

The slowdown is most likely **WSL2 filesystem I/O overhead**, not the application code:

1. **Backend startup is ~24s** for a simple Python import, but actual test execution is 0.3s. The gap is WSL2 file I/O when loading the Python virtual environment and dependencies from the Windows-mounted filesystem.

2. **Frontend build is 188s** but Next.js compilation itself is only 21s. The remaining time is spent on filesystem operations (page generation, tracing, writing output) which are known to be slow on WSL2 with Windows-mounted drives.

3. **CPU utilization is low** (18-49%) across all operations, confirming the bottleneck is I/O, not compute.

4. The application code itself is fast: 24 backend tests run in 0.3s, and the Next.js compilation step completes in 21s.

## Recommended Follow-Up

- If performance matters during development, consider cloning the repo into the native Linux filesystem (e.g., `~/team-request-hub`) instead of `/mnt/c/`.
- Alternatively, use Docker with a volume for the source code.
- No application code optimization is needed at this time.
