"""
Shared rate-limiter singleton.

Import ``limiter`` from this module wherever a ``@limiter.limit()`` decorator
is needed, and register the same instance on ``app.state.limiter`` in
``main.py``.  Using a single object ensures the decorator and the slowapi
middleware share the same counter storage.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
