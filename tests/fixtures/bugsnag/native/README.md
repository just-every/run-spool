# Real native debug-file fixtures for the Bugsnag symbol-upload cutover test

All three are compiled from `crash.c` (a three-line C program) with no secrets:

- `SyntheticApp.dSYM.zip`: `clang -g -arch arm64 -c crash.c && clang -arch arm64 crash.o -o SyntheticApp && dsymutil SyntheticApp -o SyntheticApp.dSYM`, zipped with `zip -X -r` (the layout `bugsnag-cli upload dsym` sends: `SyntheticApp.dSYM/Contents/Info.plist` and `Contents/Resources/DWARF/SyntheticApp`). Mach-O UUID: `F48B101C-E3B3-3794-9FFD-5AB329EEE07D`.
- `libsynthetic.so`: Android NDK r27 `aarch64-linux-android24-clang -g -shared -fPIC -Wl,--build-id=sha1 crash.c`. GNU build id `a4e3cd84f2d5bd09de7a9ec4cafab71372bacbd8`.
- `libnobuildid.so`: the same with `-Wl,--build-id=none`, used to prove an ELF without a build id is refused.
