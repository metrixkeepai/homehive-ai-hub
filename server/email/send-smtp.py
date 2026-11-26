"""Send one multipart message over authenticated TLS. Never log MIME or credentials."""
import json
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import formatdate

def main():
    data = json.load(sys.stdin)
    mail = EmailMessage()
    mail['From'] = 'MatrixKeep <hello@matrixkeep.com>'
    mail['Reply-To'] = 'hello@matrixkeep.com'
    mail['To'] = data['to']
    mail['Subject'] = data['subject']
    mail['Date'] = formatdate(localtime=False)
    mail['Message-ID'] = '<' + data['idempotencyKey'] + '@matrixkeep.com>'
    mail.set_content(data['text'])
    mail.add_alternative(data['html'], subtype='html')
    host = os.environ['MATRIXKEEP_SMTP_HOST']
    port = int(os.environ['MATRIXKEEP_SMTP_PORT'])
    context = ssl.create_default_context()
    if port == 465:
        client = smtplib.SMTP_SSL(host, port, timeout=15, context=context)
    elif port == 587:
        client = smtplib.SMTP(host, port, timeout=15)
    else:
        raise ValueError('Unsupported mail submission port')
    with client:
        if port == 587:
            client.starttls(context=context)
        client.login(os.environ['MATRIXKEEP_SMTP_USER'], os.environ['MATRIXKEEP_SMTP_PASSWORD'])
        client.send_message(mail, from_addr='hello@matrixkeep.com', to_addrs=[data['to']])

if __name__ == '__main__':
    try:
        main()
    except Exception:
        sys.exit('Email submission did not complete')
