import importlib.util
import io
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("frontend", Path(__file__).with_name("production-frontend.py"))
frontend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(frontend)


class GlobalOperationTest(unittest.TestCase):
    def test_insert_polls_only_returned_operation(self):
        statuses = iter(["PENDING", "RUNNING", "DONE"])

        def cli(*args, **kwargs):
            if args == ("auth", "print-access-token"):
                return subprocess.CompletedProcess([], 0, "test-only")
            self.assertEqual(args, ("compute", "operations", "describe", "op-17", "--global", "--format=json"))
            self.assertGreater(kwargs["timeout"], 0)
            return subprocess.CompletedProcess([], 0, json.dumps({"status": next(statuses)}))

        with patch.object(frontend, "gc", side_effect=cli), patch.object(
            frontend.urllib.request, "urlopen", return_value=io.BytesIO(b'{"name":"op-17"}')
        ), patch.object(frontend.time, "sleep") as sleep:
            frontend.insert_url_map("new-map", {"defaultService": "backend"})
        self.assertEqual(sleep.call_count, 2)

    def test_completed_error_reports_only_code(self):
        failure = {"status": "DONE", "error": {"errors": [{"code": "INVALID_FIELD_VALUE",
                                                           "message": "private request detail"}]}}
        with patch.object(frontend, "gc", return_value=subprocess.CompletedProcess([], 0, json.dumps(failure))):
            with self.assertRaisesRegex(RuntimeError, "^URL-map creation failed: INVALID_FIELD_VALUE$"):
                frontend.wait_for_global_operation("op-17")

    def test_pending_operation_exhausts_deadline(self):
        with patch.object(frontend.time, "monotonic", side_effect=[0, 0, 299, 300]), patch.object(
            frontend, "gc", return_value=subprocess.CompletedProcess([], 0, '{"status":"RUNNING"}')
        ) as cli, patch.object(frontend.time, "sleep") as sleep:
            with self.assertRaisesRegex(RuntimeError, "Timed out"):
                frontend.wait_for_global_operation("op-17")
            sleep.assert_called_once_with(1)
            self.assertEqual(cli.call_count, 1)

    def test_stalled_describe_is_bounded(self):
        with patch.object(frontend, "gc", side_effect=subprocess.TimeoutExpired("gcloud", 300)):
            with self.assertRaisesRegex(RuntimeError, "Timed out"):
                frontend.wait_for_global_operation("op-17")

    def test_rerun_checks_existing_map_without_inserting(self):
        existing = {"defaultService": "backend", "selfLink": "map-link"}
        with patch.object(frontend, "inspect", return_value=existing), patch.object(frontend, "insert_url_map") as insert:
            self.assertEqual(frontend.url_map("map", {"defaultService": "backend"}), "map-link")
            with self.assertRaisesRegex(RuntimeError, "different routing"):
                frontend.url_map("map", {"defaultService": "other"})
            insert.assert_not_called()


if __name__ == "__main__":
    unittest.main()
