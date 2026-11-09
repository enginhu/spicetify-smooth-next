#!/usr/bin/env python3
"""Install/remove the user's local companion; no network or elevated service."""
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
SUPPORT = Path.home() / "Library/Application Support/Smooth Next"
LABEL = "local.smooth-next.knob"
PLIST = Path.home() / "Library/LaunchAgents" / (LABEL + ".plist")
DOMAIN = f"gui/{os.getuid()}"

def run(*args, check=True):
    return subprocess.run(args, check=check, capture_output=True, text=True)

def bootout():
    # A missing previous service is normal on the first installation.
    if run("launchctl", "print", f"{DOMAIN}/{LABEL}", check=False).returncode == 0:
        run("launchctl", "bootout", f"{DOMAIN}/{LABEL}")

if len(sys.argv) != 2 or sys.argv[1] not in ("install", "uninstall"):
    raise SystemExit("Usage: python3 macos/manage.py install|uninstall")

bootout()
if sys.argv[1] == "uninstall":
    # SIGTERM restores the device mapping before the helper exits.
    PLIST.unlink(missing_ok=True)
    print("Knob helper removed from login. Existing Spicetify fade extension is retained.")
else:
    SUPPORT.mkdir(parents=True, exist_ok=True)
    PLIST.parent.mkdir(parents=True, exist_ok=True)
    executable = SUPPORT / "smooth-next-knob"
    shutil.copy2(ROOT / "build/smooth-next-knob", executable)
    executable.chmod(0o755)
    config = {
        "Label": LABEL,
        "ProgramArguments": [str(executable)],
        "RunAtLoad": True,
        "KeepAlive": True,
        "ThrottleInterval": 10,
        "ProcessType": "Interactive",
        "LimitLoadToSessionType": "Aqua",
        "StandardOutPath": str(SUPPORT / "knob.log"),
        "StandardErrorPath": str(SUPPORT / "knob-error.log"),
    }
    PLIST.write_bytes(plistlib.dumps(config))
    run("launchctl", "bootstrap", DOMAIN, str(PLIST))
    print(f"Installed: {executable}")
    print("The helper starts at login and only remaps Next while Spotify is connected.")
