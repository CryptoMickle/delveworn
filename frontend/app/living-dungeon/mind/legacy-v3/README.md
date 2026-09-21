# Frozen version 3 replay rules

These six modules are the unchanged `mind-beneath-2` engine from commit 68cdd4f.
They validate and reconstruct historical journals only. Never modify them for new gameplay.
Version 4 records an `upgradedAt` boundary: replay the prefix with these rules, then future turns with the current engine. This preserves existing facts, outcomes, bindings, resources and ongoing plans. No legacy UI or alternate language is served.
