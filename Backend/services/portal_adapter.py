from __future__ import annotations


def portal_adapter_capabilities() -> dict[str, object]:
    return {
        "enabled": False,
        "status": "not_configured",
        "message": "Direct Income Tax Department portal filing is not enabled in this build.",
        "next_step": "Use the approved ITR PDF export for review until the portal adapter is integrated.",
    }
