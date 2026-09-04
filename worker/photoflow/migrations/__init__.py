"""Changes to catalog records that no ordinary run would produce.

The pipeline never revisits an item's own fields once its files are catalogued, so
a fact recorded wrongly stays wrong however many nights the worker runs. A
migration is how that gets corrected: a function over one item, applied once to
every item in the library, whose changes ride out through the shards publish
rewrites.

One migration per file, named with a three-digit prefix and applied in that order.
The filename is the migration's identity — it is what the log in the manifest
records, so renaming a file after it has run means running it again.

Adding one: drop a new NNN_what_it_does.py in here exporting

    def migrate(item: ItemRecord) -> bool:

that mutates the item and returns whether it changed anything. Returning False
matters — it is what keeps a migration from marking every month in the library
dirty and rewriting the whole catalog.
"""

import importlib
import pkgutil
from typing import Callable

from ..models import ItemRecord

Migration = Callable[[ItemRecord], bool]


def load() -> list[tuple[str, Migration]]:
    """Every migration in this package, in numeric order, as (name, function).

    Loaded by name rather than by an import statement because a module whose name
    starts with a digit is not a valid identifier, which is also how Django reaches
    its own 0001_initial.
    """
    names = sorted(
        module.name
        for module in pkgutil.iter_modules(__path__)
        if module.name[:3].isdigit()
    )

    return [(name, importlib.import_module(f"{__name__}.{name}").migrate) for name in names]
