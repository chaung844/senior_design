"""Shared Rich-based console logging for API (uvicorn) and worker processes."""

from __future__ import annotations

import logging
import os

from rich.console import Console
from rich.logging import RichHandler


def configure_rich_logging(
    *,
    level: int,
    debug: bool = False,
    show_path: bool = True,
) -> None:
    """
    Install a Rich handler on the root logger, replacing any existing config.

    Uses ``force=True`` so uvicorn's default handlers are replaced when the app
    module loads. Respects ``NO_COLOR``; set ``FORCE_COLOR=1`` for color in
    non-TTY environments (e.g. Docker).
    """
    force_color = os.environ.get("FORCE_COLOR", "").lower() in ("1", "true", "yes")
    console = Console(force_terminal=True) if force_color else None

    rich_handler = RichHandler(
        console=console,
        show_time=True,
        show_path=show_path,
        rich_tracebacks=True,
        markup=True,
        tracebacks_show_locals=debug,
    )

    logging.basicConfig(
        level=level,
        format="%(message)s",
        datefmt="[%X]",
        handlers=[rich_handler],
        force=True,
    )

    # Uvicorn installs its own handlers with propagate=False on these loggers, so they
    # bypass the root Rich handler and still print the default plain format. Reset so
    # all server output goes through one Rich-backed root handler.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv_log = logging.getLogger(name)
        uv_log.handlers.clear()
        uv_log.propagate = True

    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.DEBUG if debug else logging.WARNING
    )
