from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import FastAPI


def register_routes(app: FastAPI) -> None:
    """Register the API endpoints on the FastAPI app."""
    from srag.api.routers_clinical import router as clinical_router
    from srag.api.routers_core import router as core_router
    from srag.api.routers_geo import router as geo_router
    from srag.api.routers_surveillance import router as surveillance_router
    from srag.api.routers_territory import router as territory_router

    app.include_router(core_router)
    app.include_router(territory_router)
    app.include_router(clinical_router)
    app.include_router(surveillance_router)
    app.include_router(geo_router)
