"""Clear finished work once it is safely published.

This runs last on purpose. An upload is only dropped after its item is in a
written shard, so a run that dies midway leaves the file waiting to be picked up
again rather than stranding it with no catalog entry. Reprocess requests are
cleared on the same terms.
"""


def run(context) -> None:
    published = {item.itemId for item in context.items.values()}

    uploads = 0
    rebuilds = 0

    for entry in getattr(context, "ingested", []):
        if entry.item_id not in published:
            continue

        if entry.incoming_key:
            context.storage.delete(entry.incoming_key)
            uploads += 1

        if entry.reprocess_key:
            context.storage.delete(entry.reprocess_key)
            rebuilds += 1

    context.note(f"cleared {uploads} uploads from incoming, {rebuilds} reprocess requests")
