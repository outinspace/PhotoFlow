"""Clear incoming/ once the work is safely published.

This runs last on purpose. An upload is only dropped after its item is in a
written shard, so a run that dies midway leaves the file waiting to be picked up
again rather than stranding it with no catalog entry.
"""


def run(context) -> None:
    published = {item.itemId for item in context.items.values()}

    removed = 0
    for entry in getattr(context, "ingested", []):
        if getattr(entry, "item_id", None) in published:
            context.storage.delete(entry.incoming_key)
            removed += 1

    context.note(f"cleared {removed} uploads from incoming")
