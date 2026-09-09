# GitHub packages and release process

The repository uses the MIT license. Repository visibility and package publishing are separate choices: the repository can stay private during verification, then become public with the same license. `private: true` in package.json prevents accidental npm registry publishing; it does not prevent installing tarballs or making the source repository public.

## Download an Actions build

The **Validate and package** workflow runs on pushes to `main`, pull requests targeting `main`, version tags (`v*`), and manual dispatch. It validates on Linux with Node 22 and 24, and on macOS with Node 22. After these jobs succeed, it builds a tarball and runs the consumer lifecycle against that exact tarball before uploading it.

Open **Actions → Validate and package → a successful run → Artifacts**, then download `architecture-graph-<commit SHA>`. The artifact ZIP contains:

- `architecture-graph-toolkit-<version>.tgz`: installable package, including the skill and MIT license.
- `SHA256SUMS`: SHA-256 checksum of the tarball.
- `package-metadata.json`: package version, commit, checksum, Node version, and workflow run URL. This records a build; it is not AAG evidence.

Extract the ZIP, verify the checksum, and install the tarball into a new consumer:

```sh
# macOS (on Linux, use sha256sum -c SHA256SUMS)
shasum -a 256 -c SHA256SUMS
npm install --save-dev ./architecture-graph-toolkit-0.1.0.tgz
./node_modules/.bin/ag --version
./node_modules/.bin/ag init --id graph:trial --title "AG trial"
```

Run installation from a directory with an existing package.json, or use `npm init -y` first. Put the tarball somewhere stable if you keep it as a file dependency, and commit the consumer's lockfile.

Artifacts are retained for 30 days. For a durable release, download a verified build and attach its tarball and checksum to a GitHub Release. The workflow does not create releases, change visibility, push commits, or publish to npm. A tag-triggered build requires a tag matching the package version, such as `v0.1.0`. The workflow uses read-only repository permissions and pinned official action commits.

## Reproduce locally

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
npm run package
npm run test:package
```

The final two commands write ignored output under `dist/` and install/test that exact tarball in a temporary consumer. `AG_TARBALL=/absolute/path/package.tgz npm run test:consumer` can test a downloaded tarball against this checkout's consumer scenarios. The checked-in example uses the package's public interface.

## Make the repository public

After reviewing a successful Actions run and trying its downloaded package, change visibility in GitHub under **Settings → General → Danger Zone → Change repository visibility**. The MIT license is already present; no package-format change is needed. The extracted source-revision and branch-comparison notes remain in the repository for provenance. A public v0.1 release can clearly state its structural-validation scope and current limitations.
