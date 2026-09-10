# Get a package your team can use

A downloadable package lets a project use AG without depending on the toolkit's source checkout. The GitHub workflow tests the toolkit, builds the archive, and tests that exact archive in a separate project before making it available.

If you just want to adopt AG, download a package and follow [getting started](getting-started.md). The build instructions below are for people maintaining the toolkit or trying local changes.

This page covers building the **toolkit package**. To generate **your project’s graph indexes** on a shared runner, see [indexes and generation in CI](indexing-and-ci.md).

The package can model projects in any language, but installing and running it requires Node/npm. A tarball is an npm package, not a standalone executable; see [toolchain impact](languages-and-toolchain.md).

## Download from GitHub Actions

Open this repository's **Actions → Validate and package**, choose a successful run, and download `architecture-graph-<commit SHA>` from **Artifacts**. Extract the ZIP. It contains:

| File | Why it is included |
| --- | --- |
| `billbliss-architecture-graph-<version>.tgz` | The package npm installs, including the coding-agent skill and MIT license |
| `SHA256SUMS` | A checksum to confirm the archive has not changed since it was built |
| `package-metadata.json` | The version, source commit, and build run, so you can identify what you are trying |

From the extracted folder, check the archive before installing:

```sh
# macOS
shasum -a 256 -c SHA256SUMS

# Linux
sha256sum -c SHA256SUMS
```

Choose the command for your system. Then copy the `.tgz` into your project's `vendor/` folder and run `npm install --save-dev ./vendor/billbliss-architecture-graph-0.3.0.tgz` from that project’s root (run `npm init -y` first if it has no manifest). Continue with [agent setup](getting-started.md#3-bootstrap-the-graph-with-your-coding-agent). The metadata identifies a build; it is not evidence that your application's architecture is correct.

## What runs automatically?

The **Validate and package** workflow runs for pushes to `main`, pull requests targeting `main`, tags beginning with `v`, and manual requests from the Actions page. It tests on Linux with Node 22 and 24 and on macOS with Node 22. Packaging waits for those checks to pass.

Each download remains available for 30 days. For a lasting release, attach the tested tarball and checksum to a GitHub Release. A version tag must match the package version—for example, `v0.3.0`. The workflow does not create a release or publish to npm for you.

## Build and try a local package

From a clone of this toolkit repository:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run verify
npm run package
npm run test:package
```

`verify` exercises the graph checks and the hello-world lifecycle. `package` writes the archive and identifying information into `dist/`. `test:package` then installs that exact archive into a temporary project and checks it through the public commands.

To test a downloaded archive with this checkout's examples, use `AG_TARBALL=/absolute/path/package.tgz npm run test:consumer`.

`test:consumer` installs into a throwaway npm cache so a run resolves dependencies from the registry rather than from whatever the machine happens to have cached. It therefore needs network access. Set `AG_NPM_CACHE=/absolute/path/cache` to reuse a warm cache instead, accepting that stale metadata can affect resolution or make an install fail. The exact runtime versions remain pinned; this test does not reproduce the consuming application’s lockfile.

## Sharing the source

The project uses the MIT license. GitHub repository visibility and npm publication are separate choices. Making the repository public shares the source under that license; the package is configured for an explicit public npm release. Repository visibility and marketplace distribution remain unchanged by npm publication.

A maintainer can change GitHub visibility after checking the build and trying its package. Public users need the installation guide and an honest explanation of the toolkit's limits; they do not need to read its [origin notes](history/README.md).

Marketplace distribution is still in preparation. The included manifests do not publish or submit anything by themselves, and the current Actions workflow does not publish to npm or a plugin directory. See [publishing preparation](publishing.md) for validation and release steps.
