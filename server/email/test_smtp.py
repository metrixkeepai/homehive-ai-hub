import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch

path = Path(__file__).with_name("send-smtp.py")
spec = importlib.util.spec_from_file_location("matrixkeep_smtp", path)
transport = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transport)

class SMTPTransportTest(unittest.TestCase):
    def submit(self, port):
        message = dict(to="qa@example.com", subject="Message", text="Plain email",
                       html="<p>HTML email</p>", idempotencyKey="fixture")
        env = dict(MATRIXKEEP_SMTP_HOST="smtp.example.com", MATRIXKEEP_SMTP_PORT=port,
                   MATRIXKEEP_SMTP_USER="fixture", MATRIXKEEP_SMTP_PASSWORD="fixture")
        with patch.dict(transport.os.environ, env), patch.object(transport.sys, "stdin", io.StringIO(json.dumps(message))):
            transport.main()

    @patch.object(transport.smtplib, "SMTP")
    def test_starttls_multipart(self, smtp):
        self.submit("587")
        client = smtp.return_value
        calls = [call[0] for call in client.method_calls]
        self.assertEqual(calls, ["starttls", "login", "send_message"])
        msg = client.send_message.call_args.args[0]
        self.assertEqual(str(msg["From"]), "MatrixKeep <hello@matrixkeep.com>")
        self.assertEqual(str(msg["Reply-To"]), "hello@matrixkeep.com")
        self.assertEqual(msg.get_content_type(), "multipart/alternative")
        self.assertEqual([part.get_content_type() for part in msg.iter_parts()], ["text/plain","text/html"])

    @patch.object(transport.smtplib, "SMTP_SSL")
    def test_auth_failure_never_submits(self, smtp):
        smtp.return_value.login.side_effect = transport.smtplib.SMTPAuthenticationError(535, b"fixture")
        with self.assertRaises(transport.smtplib.SMTPAuthenticationError):
            self.submit("465")
        smtp.return_value.send_message.assert_not_called()

if __name__ == "__main__":
    unittest.main()
