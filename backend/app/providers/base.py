from typing import Dict, Any
from ...models.models import ProviderConfig

class BaseProviderAdapter:
    def __init__(self, config: ProviderConfig):
        self.config = config
        
    def send_email(self, to_email: str, subject: str, body_html: str, body_txt: str) -> Dict[str, Any]:
        """
        Sends an email and returns the provider's message ID or result.
        Must raise appropriate exceptions on failure.
        """
        raise NotImplementedError
