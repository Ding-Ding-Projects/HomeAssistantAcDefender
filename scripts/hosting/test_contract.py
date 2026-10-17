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

    def test_container_pin_manifest_matches_build(self):
        manifest = json.loads((ROOT / "dependency-manifest.json").read_text())
        dockerfile = (ROOT / "Dockerfile").read_text()
        for name in ("git", "curl"):
            self.assertIn(f"{name}={manifest['containerPackages'][name]}", dockerfile)
        for image in manifest["containerImages"].values():
            self.assertRegex(image["digest"], r"^sha256:[a-f0-9]{64}$")
            self.assertIn(image["reference"] + "@" + image["digest"], dockerfile)
        for architecture in ("amd64", "arm64"):
            checksums = manifest["containerPackages"]["packageSha256"][architecture]
            for name in ("git", "curl"):
                package = next(filename for filename in checksums if filename.startswith(name + "_"))
                self.assertIn(manifest["containerPackages"][name].replace(":", "%3a"), package)
                self.assertTrue(package.endswith("_" + architecture + ".deb"))
                self.assertRegex(checksums[package], r"^[a-f0-9]{64}$")

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
        self.assertNotIn("continue-on-error", probe)
        self.assertIn("Change visibility", probe["run"])
        self.assertIn("rerun this workflow", probe["run"])
        self.assertIn("do not bypass this gate", probe["run"])
        self.assertIn('docker --config "${anonymous_config}" pull', probe["run"])
        publisher = next(step for step in release["steps"] if step.get("name") == "Create the immutable GitHub release")
        for expected in ("image-reference.txt", "docker-compose.published.yml", "release-assets/hosting-wizard/*portable*.exe", "release-assets/docs-companion/*portable.exe", "isPrerelease"):
            self.assertIn(expected, publisher["run"])
        self.assertNotRegex(publisher["run"], r"--(?:draft|prerelease)(?:\s|=)")

    def test_portable_build_provenance(self):
        jobs = yaml.safe_load((ROOT / ".github/workflows/release.yml").read_text())["jobs"]
        for job_name, directory, prefix in (("build-hosting-wizard", "hosting-wizard", "AC-Defender-Setup"), ("build-docs-companion", "docs-companion", "AC-Defender-Docs")):
            job = jobs[job_name]
            self.assertEqual(job["env"], {
                "AC_DEFENDER_VERSION": "0.1.${{ github.run_number }}",
                "AC_DEFENDER_REVISION": "${{ github.sha }}",
                "AC_DEFENDER_BUILD_TIME": "${{ needs.workflow-start.outputs.started_iso }}",
            })
            artifact = next(step for step in job["steps"] if step.get("uses") == "actions/upload-artifact@v4")
            self.assertEqual(artifact["with"]["path"], directory + "/dist/" + prefix + "-0.1.${{ github.run_number }}-portable.exe")
            self.assertEqual(job["defaults"]["run"]["working-directory"], directory)

    def test_native_portable_proof_gates_and_safe_evidence(self):
        jobs = yaml.safe_load((ROOT / ".github/workflows/release.yml").read_text())["jobs"]
        for name, prefix, evidence, receipt in (("build-hosting-wizard", "AC-Defender-Setup", "hosting-portable-native", "receipt.json"), ("build-docs-companion", "AC-Defender-Docs", "docs-portable-native", "result.json")):
            job = jobs[name]
            self.assertEqual(job["runs-on"], "windows-latest")
            steps = job["steps"]
            proof = next(step for step in steps if step.get("name") == "Verify native Windows portable renderer")
            self.assertEqual(proof["timeout-minutes"], 3)
            self.assertNotIn("continue-on-error", proof)
            self.assertIn(prefix + "-{0}-portable.exe", proof["run"])
            self.assertIn('node scripts/native-portable-proof.mjs "$portable" "../safe-evidence/' + evidence + '"', proof["run"])
            published = next(step for step in steps if step.get("uses") == "actions/upload-artifact@v4")
            self.assertLess(steps.index(proof), steps.index(published))
            upload = next(step for step in steps if step.get("name") == "Upload bounded native Windows evidence")
            self.assertEqual(upload["if"], "${{ always() }}")
            self.assertTrue(upload["continue-on-error"])
            self.assertEqual(upload["with"]["retention-days"], 7)
            self.assertEqual(upload["with"]["path"].splitlines(), ["safe-evidence/" + evidence + "/initial-window.png", "safe-evidence/" + evidence + "/" + receipt])

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
