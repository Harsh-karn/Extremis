import smtplib
from email.message import EmailMessage
from typing import Dict, Any
import json
import socket
from ...models.models import ProviderConfig
from .base import BaseProviderAdapter

class SMTPAdapter(BaseProviderAdapter):
    def send_email(self, to_email: str, subject: str, body_html: str, body_txt: str) -> Dict[str, Any]:
        """
        Sends an email using the smtplib library.
        Throws specific errors to be handled by the worker.
        """
        # Parse credentials
        try:
            creds = json.loads(self.config.credentials_encrypted.decode('utf-8'))
            smtp_host = creds.get('host', 'smtp.gmail.com')
            smtp_port = creds.get('port', 587)
            smtp_user = creds.get('username')
            smtp_pass = creds.get('password')
        except Exception:
            raise ValueError("Invalid provider credentials format")

        msg = EmailMessage()
        msg['Subject'] = subject
        msg['From'] = smtp_user
        msg['To'] = to_email
        msg.set_content(body_txt)
        msg.add_alternative(body_html, subtype='html')

        try:
            # Connect to SMTP server
            server = smtplib.SMTP(smtp_host, int(smtp_port), timeout=10)
            server.ehlo()
            server.starttls()
            
            # Login
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
                
            # Send
            server.send_message(msg)
            server.quit()
            
            return {"message_id": f"smtp-{to_email}-{self.config.id}"}
            
        except smtplib.SMTPAuthenticationError as e:
            # Fatal error, credentials revoked or invalid
            raise ValueError(f"SMTP Authentication Failed: {str(e)}")
        except smtplib.SMTPRecipientsRefused as e:
            # Fatal error for this specific recipient
            raise ValueError(f"Recipient refused: {str(e)}")
        except smtplib.SMTPSenderRefused as e:
            # Sender address rejected, might be permanent
            raise ValueError(f"Sender refused: {str(e)}")
        except (smtplib.SMTPServerDisconnected, smtplib.SMTPConnectError, socket.gaierror, TimeoutError) as e:
            # Transient error, should retry
            raise ConnectionError(f"Transient SMTP error: {str(e)}")
        except Exception as e:
            raise RuntimeError(f"Unexpected SMTP error: {str(e)}")
