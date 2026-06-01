from supabase import Client, create_client

from app.core.config import get_settings

_admin_client: Client | None = None


def get_supabase_admin() -> Client:
    global _admin_client
    if _admin_client is None:
        settings = get_settings()
        _admin_client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
        try:
            import httpx
            _admin_client.postgrest.session._transport = httpx.HTTPTransport(
                http2=False,
            )
        except Exception:
            pass
    return _admin_client
