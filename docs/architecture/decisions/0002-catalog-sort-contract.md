# ADR 0002 - Catalog sort contract outside UI

The dependency graph identified CatalogSnapshotManager importing CatalogSortOption from SortDropdown. Move the type to core/catalog/catalogSort; re-export from SortDropdown to preserve consumers. No sorting algorithm, card layout or playback code changes. Characterization checks alphabetical order and input immutability. Architecture violations decrease 19 -> 18 (one core/UI edge removed); no cycles removed. Revert this commit to roll back without touching data.
