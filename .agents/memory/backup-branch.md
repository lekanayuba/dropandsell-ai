---
name: Original full-featured app backup
description: Where the pre-rebuild version lives and how to pull individual files/assets from it.
---

# Original full-featured app backup

The current `main` is a slimmer rebuild. The original full-featured app is preserved on branch **`gitsafe-backup/main`** (orphaned/diverged from main).

**Gotcha:** the rebuild sometimes references brand assets or pages that exist ONLY in the backup, not in the current working tree (e.g. the DropandSell logo `attached_assets/Drop_1.jpg_1775119096004.jpeg`). A sidebar/import can point at a file that isn't there, which breaks the Vite build.

**How to restore a single file from the backup without a full checkout:**
`git show gitsafe-backup/main:<path> > <path>` (works for text and binary like images).

**How to inspect the original before restoring:** `git ls-tree -r --name-only gitsafe-backup/main | rg <pattern>` and `git show gitsafe-backup/main:<path>`.
