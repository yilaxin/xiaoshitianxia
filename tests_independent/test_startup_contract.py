"""Independent contract tests for the 笑食天下 v0.3.0 startup animation.

These tests are written against the FIXED startup contract only. They copy the
project source (XSTX_PROJECT) into a short isolated directory under
XSTX_TEST_TEMP, build the desktop app, and then exercise the real native
offscreen main window through Electron subprocesses that run the scenario
dispatcher in fixtures/startup_scenarios.cjs.

Nothing here hard-codes a baseline path: all locations come from the harness
environment (XSTX_PROJECT, XSTX_TEST_TEMP, PYTHON_EXE, XSTX_ELECTRON). The
scenarios never touch a real desktop instance and only read/write a scratch
profile directory that this module creates.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURES_DIR = os.path.join(ROOT, "fixtures")

PROJECT_DIR = None
BUILD_OK = None
BUILD_LOG = None
REPORT = []


def _build_project():
    """Copy XSTX_PROJECT into a short isolated dir and build dist-app once."""
    project = os.environ.get("XSTX_PROJECT")
    tmp = os.environ.get("XSTX_TEST_TEMP")
    py = os.environ.get("PYTHON_EXE")
    if not project or not tmp or not py:
        raise RuntimeError("missing harness env: XSTX_PROJECT/XSTX_TEST_TEMP/PYTHON_EXE")

    build_dir = os.path.join(tmp, "xstx-startup-" + str(os.getpid()))
    if os.path.isdir(build_dir):
        shutil.rmtree(build_dir, ignore_errors=True)
    ignore = shutil.ignore_patterns(
        "node_modules", "dist-app", "work", "outputs", ".git", "*.log", "__pycache__",
    )
    shutil.copytree(project, build_dir, ignore=ignore)

    env = dict(os.environ)
    env["PYTHONUTF8"] = "1"
    proc = subprocess.run(
        [py, os.path.join("scripts", "build_desktop.py")],
        cwd=build_dir, capture_output=True, text=True, timeout=300, env=env,
    )
    log = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode != 0:
        raise RuntimeError("build failed: " + log[-2000:])
    dist = os.path.join(build_dir, "dist-app")
    if not os.path.isfile(os.path.join(dist, "main.cjs")):
        raise RuntimeError("build did not produce dist-app/main.cjs")
    return build_dir, log


def setUpModule():
    global PROJECT_DIR, BUILD_OK, BUILD_LOG
    try:
        PROJECT_DIR, BUILD_LOG = _build_project()
        BUILD_OK = True
    except Exception as exc:  # keep going; every test reports the build failure
        PROJECT_DIR = None
        BUILD_OK = False
        BUILD_LOG = str(exc)


def _evidence_dir():
    """Exclusive temp directory under XSTX_TEST_TEMP for runtime artifacts.

    The fixed contract lets the author only create tests/** and fixtures/**
    inside the workspace. Every runtime artifact (report, build copy, scratch
    profiles, scenario logs) must therefore live under the harness-provided
    XSTX_TEST_TEMP, never at the repository root.
    """
    tmp = os.environ.get("XSTX_TEST_TEMP")
    if not tmp:
        return None
    d = os.path.join(tmp, "startup-contract-evidence")
    try:
        os.makedirs(d, exist_ok=True)
    except OSError:
        return None
    return d


def tearDownModule():
    out_dir = _evidence_dir()
    if not out_dir:
        print("EVIDENCE_SKIPPED missing XSTX_TEST_TEMP")
        return
    evidence = os.path.join(out_dir, "startup_test_report.json")
    try:
        with open(evidence, "w", encoding="utf-8") as fh:
            json.dump({
                "project": PROJECT_DIR,
                "build_ok": BUILD_OK,
                "build_log": BUILD_LOG,
                "scenarios": REPORT,
            }, fh, indent=2, ensure_ascii=False)
        print("EVIDENCE " + evidence)
    except OSError as exc:
        print("EVIDENCE_WRITE_FAILED " + str(exc))


def _run_scenario(name, profile, startup_test=True, extra_env=None, timeout=80):
    env = dict(os.environ)
    env["XSTX_BUILD_PROJECT"] = PROJECT_DIR
    env["XSTX_STARTUP_SCENARIO"] = name
    env["XSTX_STARTUP_PROFILE"] = profile
    env["XSTX_HEADLESS_TEST"] = "1"
    if startup_test:
        env["XSTX_STARTUP_TEST"] = "1"
    else:
        env.pop("XSTX_STARTUP_TEST", None)
    if extra_env:
        env.update(extra_env)

    electron = os.environ.get("XSTX_ELECTRON")
    if not electron:
        raise RuntimeError("missing harness env: XSTX_ELECTRON")

    fixture = os.path.join(FIXTURES_DIR, "startup_scenarios.cjs")
    rc = out = err = None
    for attempt in (0, 1):
        out_f = os.path.join(profile, "scenario.out.txt")
        err_f = os.path.join(profile, "scenario.err.txt")
        with open(out_f, "wb") as fo, open(err_f, "wb") as fe:
            proc = subprocess.Popen(
                [electron, fixture],
                cwd=PROJECT_DIR, stdout=fo, stderr=fe, env=env,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            try:
                rc = proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                proc.kill()
                try:
                    proc.wait(timeout=10)
                except Exception:
                    pass
                rc = "TIMEOUT"
        with open(out_f, "rb") as fh:
            out = fh.read().decode("utf-8", "replace")
        with open(err_f, "rb") as fh:
            err = fh.read().decode("utf-8", "replace")
        # Expected exit codes come from the dispatcher's finish(); anything else
        # (e.g. a crashed/terminated Electron with an empty log) is retried once.
        if isinstance(rc, int) and rc in (0, 1, 2, 3, 4, 9):
            break
        if attempt == 0:
            REPORT.append({"scenario": name, "rc": rc, "retry": True,
                           "stderr_tail": err[-600:]})
            time.sleep(1.0)
            continue
        break
    return rc, out, err


def _parse_checks(out):
    checks = []
    for line in out.splitlines():
        m = re.match(r"CHECK (\S+) (PASS|FAIL)(?: :: (.*))?$", line)
        if m:
            checks.append((m.group(1), m.group(2) == "PASS", m.group(3) or ""))
    return checks


def _assert_scenario(self, name, profile, startup_test=True, extra_env=None, timeout=80):
    rc, out, err = _run_scenario(name, profile, startup_test, extra_env, timeout)
    checks = _parse_checks(out)
    REPORT.append({
        "scenario": name,
        "rc": rc,
        "checks": [{"name": n, "ok": ok, "detail": d} for (n, ok, d) in checks],
        "stderr_tail": err[-1200:],
    })
    failed = [(n, d) for (n, ok, d) in checks if not ok]
    if failed:
        self.fail("scenario %r failed checks: %r\n--- stdout ---\n%s\n--- stderr ---\n%s"
                  % (name, failed, out[-2500:], err[-1500:]))
    if rc != 0:
        self.fail(
            "scenario %r exited rc=%r (profile=%s)\n--- stdout ---\n%s\n--- stderr ---\n%s"
            % (name, rc, profile, out[-2500:], err[-2500:])
        )


def _fresh_profile():
    return tempfile.mkdtemp(prefix="xstx-prof-", dir=os.environ.get("XSTX_TEST_TEMP"))


class StartupContractTests(unittest.TestCase):
    maxDiff = None

    def setUp(self):
        if not BUILD_OK:
            self.fail("project build failed: " + (BUILD_LOG or "")[-1500:])

    # -- pure source/build contract -----------------------------------------
    def test_static_build_constraints(self):
        pkg_path = os.path.join(PROJECT_DIR, "package.json")
        self.assertTrue(os.path.isfile(pkg_path), "package.json missing")
        with open(pkg_path, encoding="utf-8") as fh:
            pkg = json.loads(fh.read())
        self.assertEqual(pkg.get("version"), "0.3.3",
                         "CI stability update requires version 0.3.3")

        startup_css = os.path.join(PROJECT_DIR, "app", "startup.css")
        startup_js = os.path.join(PROJECT_DIR, "app", "startup.js")
        self.assertTrue(os.path.isfile(startup_css),
                        "contract suggests separated app/startup.css")
        self.assertTrue(os.path.isfile(startup_js),
                        "contract suggests separated app/startup.js")

        src = ""
        for p in (startup_css, startup_js):
            if os.path.isfile(p):
                with open(p, encoding="utf-8") as fh:
                    src += fh.read()
        for bad, label in (
            ("<video", "no <video>"),
            ("fetch(", "no fetch("),
            ("XMLHttpRequest", "no XMLHttpRequest"),
            ("http://", "no http://"),
            ("https://", "no https://"),
            ("new BrowserWindow", "no new BrowserWindow in startup code"),
            ("window.open", "no window.open in startup code"),
        ):
            self.assertNotIn(bad, src, "startup code must contain " + label)

        for phase in ("arriving", "opening", "settling", "revealing"):
            self.assertIn(phase, src, "startup code must implement phase " + phase)

        runtime_deps = pkg.get("dependencies") or {}
        self.assertEqual(set(runtime_deps.keys()), set(),
                         "startup must not add runtime dependencies")
        dev_deps = set((pkg.get("devDependencies") or {}).keys())
        self.assertTrue(dev_deps <= {"electron", "@electron/packager"},
                        "startup must not add large dev dependencies: %r" % dev_deps)

    # -- Electron scenarios ---------------------------------------------------
    def test_interface_contract(self):
        _assert_scenario(self, "interface", _fresh_profile())

    def test_dom_structure(self):
        _assert_scenario(self, "dom", _fresh_profile())

    def test_clicked_animation_phases_and_cleanup(self):
        _assert_scenario(self, "auto", _fresh_profile())

    def test_skip_button_idempotent_and_no_replay(self):
        _assert_scenario(self, "skip", _fresh_profile())

    def test_escape_key_safe_finish(self):
        _assert_scenario(self, "esc", _fresh_profile())

    def test_reduce_motion_initial_fade(self):
        _assert_scenario(self, "reduce_initial", _fresh_profile())

    def test_reduce_motion_runtime_switch(self):
        _assert_scenario(self, "reduce_runtime", _fresh_profile())

    def test_preference_default_and_toggle_persist(self):
        _assert_scenario(self, "pref_toggle", _fresh_profile())

    def test_preference_off_coldstart_direct_home(self):
        profile = _fresh_profile()
        rc, out, err = _run_scenario("bootstrap_pref_off", profile, startup_test=True)
        REPORT.append({"scenario": "bootstrap_pref_off", "rc": rc,
                       "checks": [], "stderr_tail": err[-1200:]})
        if rc != 0:
            self.fail("pref_off bootstrap failed (rc=%r)\n%s\n%s" % (rc, out[-1500:], err[-1500:]))
        _assert_scenario(self, "pref_off", profile)

    def test_preference_save_failure_no_fake_success(self):
        profile = _fresh_profile()
        corrupt = '{"version":999}\n'
        with open(os.path.join(profile, "菜单资料.json"), "w", encoding="utf-8") as fh:
            fh.write(corrupt)
        with open(os.path.join(profile, "菜单资料.json.original"), "w", encoding="utf-8") as fh:
            fh.write(corrupt)
        _assert_scenario(self, "pref_fail", profile)

    def test_reload_does_not_replay(self):
        _assert_scenario(self, "reload", _fresh_profile())

    def test_restore_does_not_replay(self):
        _assert_scenario(self, "restore", _fresh_profile())

    def test_headless_only_does_not_block(self):
        _assert_scenario(self, "headless_only", _fresh_profile(), startup_test=False)


if __name__ == "__main__":
    unittest.main()
