#!/usr/bin/env python3
"""Bound the apt fallback used only after the bundled Chromium fails to launch."""

import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time


def install():
    archives = Path(os.environ['APT_ARCHIVES']).resolve()
    archives.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='chromium-apt-') as directory:
        config = Path(directory) / 'apt.conf'
        config.write_text(
            f'Dir::Cache::archives {json.dumps(str(archives))};\n'
            'APT::Keep-Downloaded-Packages "true";\n'
            'APT::Update::Error-Mode "any";\n'
            'Acquire::Retries "2";\n'
            'Acquire::http::Timeout "30";\n'
            'Acquire::https::Timeout "30";\n'
        )
        environment = {**os.environ, 'APT_CONFIG': str(config), 'DEBIAN_FRONTEND': 'noninteractive'}
        for attempt in range(1, 4):
            print(f'Chromium dependencies: attempt {attempt}/3 (60s deadline)', flush=True)
            child = subprocess.Popen(
                ['pnpm', 'exec', 'playwright', 'install-deps', 'chromium'],
                env=environment, start_new_session=True,
            )
            try:
                status = child.wait(timeout=60)
            except subprocess.TimeoutExpired:
                # Kill only the process group this helper started, including apt's children.
                os.killpg(child.pid, signal.SIGTERM)
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait()
                status = 124
            if status == 0:
                return 0
            print(f'Chromium dependencies: attempt {attempt}/3 failed (exit {status})', flush=True)
            if attempt < 3:
                time.sleep(attempt * 2)
    return 1


if __name__ == '__main__':
    raise SystemExit(install())
