# Temporary Git-only handoff for nationwide evidence v5

These ordered parts contain a Git bundle of the frozen tested repository tree, not a deployment. The bundle includes only Git objects for the source code, public structured data, sanitized text assets and tests. It does not contain a Library archive, internal review folders, raw PDF/full-page HTML sources, dependencies or build outputs.

Validate every part and the reconstructed bundle using manifest.json. Fetch its canonical commit into a repository containing the prerequisite commit. The recovered tree must be exactly `6814a943080d1cc6484d05d92bef89d1b4cfcc9e`.

PR #3 is currently a 3-file staging snapshot. To publish the full readable implementation without force-pushing, create a commit with the verified target tree and the freshly checked PR #3 head as its parent, then push it normally to `feat/nationwide-evidence-v5`. Coordinate this write to avoid concurrent changes. Re-run the appropriate tests and verify the remote tree afterwards. Do not merge or deploy.

The only completion criterion for repository publication is the readable target tree on PR #3, not this temporary bundle branch.
