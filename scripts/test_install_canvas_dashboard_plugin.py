from __future__ import annotations

import os
import subprocess
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
INSTALL_SCRIPT = REPO_ROOT / "scripts" / "install-canvas-dashboard-plugin.sh"


class InstallCanvasDashboardPluginTests(unittest.TestCase):
    def run_installer(self, home: Path, *args: str) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env["HOME"] = str(home)
        return subprocess.run(
            ["bash", str(INSTALL_SCRIPT), *args],
            cwd="/",
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

    def test_installs_plugin_to_default_hermes_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            home = Path(temp_dir)

            result = self.run_installer(home)

            self.assertEqual(result.returncode, 0, result.stderr)
            installed = home / ".hermes" / "plugins" / "canvas-dashboard"
            self.assertTrue(installed.is_dir())
            self.assertTrue((installed / "plugin.yaml").is_file())
            self.assertTrue(
                (installed / "skills" / "canvas-dashboard" / "SKILL.md").is_file()
            )
            self.assertIn(str(installed), result.stdout)

    def test_refuses_to_overwrite_existing_install_without_force(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            home = Path(temp_dir)
            installed = home / ".hermes" / "plugins" / "canvas-dashboard"
            installed.mkdir(parents=True)
            marker = installed / "local.txt"
            marker.write_text("keep me", encoding="utf-8")

            result = self.run_installer(home)

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("already exists", result.stderr)
            self.assertEqual(marker.read_text(encoding="utf-8"), "keep me")

    def test_force_replaces_existing_install(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            home = Path(temp_dir)
            installed = home / ".hermes" / "plugins" / "canvas-dashboard"
            installed.mkdir(parents=True)
            (installed / "local.txt").write_text("remove me", encoding="utf-8")

            result = self.run_installer(home, "--force")

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue((installed / "plugin.yaml").is_file())
            self.assertFalse((installed / "local.txt").exists())

    def test_symlink_mode_links_to_repo_plugin(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            home = Path(temp_dir)

            result = self.run_installer(home, "--symlink")

            self.assertEqual(result.returncode, 0, result.stderr)
            installed = home / ".hermes" / "plugins" / "canvas-dashboard"
            self.assertTrue(installed.is_symlink())
            self.assertEqual(installed.resolve(), REPO_ROOT / "plugins" / "canvas-dashboard")


if __name__ == "__main__":
    unittest.main()
