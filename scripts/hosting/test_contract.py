"""Validate deployment contracts without starting containers or reading local secrets.

Requires Python 3, PyYAML, and Docker Compose v2. Run from any directory.
"""
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[2]


class DeploymentContract(unittest.TestCase):
    def test_compose_with_throwaway_configuration(self):
        with tempfile.TemporaryDirectory(prefix="hosting-contract-") as temporary:
            directory = Path(temporary)
            (directory / "docker-compose.yml").write_text((ROOT / "docker-compose.yml").read_text())
            digest = "ghcr.io/ding-ding-projects/homeassistantacdefender@sha256:" + "a" * 64
            (directory / ".env").write_text(
                f"AC_DEFENDER_IMAGE={digest}\nFORWARDED_HEADERS_ALLOWED_HOSTS=localhost\n"
            )
            result = subprocess.run(
                ["docker", "compose", "--project-directory", temporary, "--file",
                 str(directory / "docker-compose.yml"), "config", "--format", "json"],
                capture_output=True, text=True, check=True,
                # Isolate interpolation from any existing operator configuration.
                env={"PATH": __import__("os").environ["PATH"]},
            )
            service = json.loads(result.stdout)["services"]["ac-defender"]
            self.assertEqual(service["image"], digest)
            self.assertNotIn("build", service)
            self.assertEqual(str(service["ports"][0]["published"]), "8888")
            self.assertEqual(service["ports"][0]["target"], 8080)
            self.assertEqual({mount["target"] for mount in service["volumes"]}, {"/data", "/app/App_Data"})
            self.assertTrue(service["read_only"])
            self.assertEqual(service["restart"], "unless-stopped")

    def test_release_assets_and_dependency_graph(self):
        workflow = yaml.safe_load((ROOT / ".github/workflows/release.yml").read_text())
        jobs = workflow["jobs"]
        release = jobs["verify-and-release"]
        self.assertTrue({"build-desktop-electron", "build-hosting-wizard", "build-docs-companion"}.issubset(release["needs"]))
        image = next(step for step in release["steps"] if step.get("id") == "published_image")
        self.assertTrue(image["with"]["push"])
        self.assertEqual(image["with"]["platforms"], "linux/amd64,linux/arm64")
        self.assertIn("sha-${{ github.sha }}", image["with"]["tags"])
        probe = next(step for step in release["steps"] if step.get("id") == "anonymous_image")
        self.assertTrue(probe["continue-on-error"])
        self.assertIn('docker --config "${anonymous_config}" pull', probe["run"])
        publisher = next(step for step in release["steps"] if step.get("name") == "Create the immutable GitHub release")
        for expected in ("image-reference.txt", "docker-compose.published.yml", "release-assets/hosting-wizard/*portable*.exe", "release-assets/docs-companion/*portable.exe", "isPrerelease"):
            self.assertIn(expected, publisher["run"])
        self.assertNotRegex(publisher["run"], r"--(?:draft|prerelease)(?:\s|=)")

    def test_embedded_shell_and_python_syntax(self):
        jobs = yaml.safe_load((ROOT / ".github/workflows/release.yml").read_text())["jobs"]
        for job in jobs.values():
            if job["runs-on"] != "ubuntu-latest":
                continue
            for step in job["steps"]:
                script = step.get("run")
                if not script:
                    continue
                subprocess.run(["bash", "-n"], input=script, text=True, check=True)
                for match in re.finditer(r"<<'(PY(?:CODE)?)'\n(.*?)\n\1(?:\n|$)", script, re.DOTALL):
                    compile(match.group(2), step.get("name", "workflow Python"), "exec")


if __name__ == "__main__":
    unittest.main()
