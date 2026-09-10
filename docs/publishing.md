# Prepare publishing before offering it to users

The goal is to make a future release straightforward while leaving time to validate it. The repository includes Claude Code plugin and marketplace manifests, but marketplace installation remains unverified. They are preparation for a release, not a claim that AG is publicly available or ready for marketplace users.

## npm releases: test, approve, publish

Version 0.3.0 was published manually. Future stable releases can use `.github/workflows/package.yml`: a `v*` tag push runs the test matrix, validates the self-model and builds and tests an archive. A separate job downloads that exact archive, checks its checksum and source commit, waits for the `npm-publish` environment approval, and publishes through npm trusted publishing. Ordinary branch pushes, pull requests and manual workflow runs only test and package.

The upload runs once. If it fails after npm accepted the package, rerunning the failed jobs checks the registry first: identical bytes proceed to verification; a different archive under that version fails. The workflow then retries clean installation by package name for up to ten minutes to allow registry propagation. A verification failure does not undo publication. Inspect the registry and rerun the failed job; do not move the tag or republish changed bytes under the same version.

## One-time setup after pushing this workflow

1. In GitHub repository **Settings → Environments**, create **`npm-publish`**. Add yourself or an appropriate team as a **required reviewer**. For a solo maintainer who creates the tag and approves it, leave “Prevent self-review” off. Restrict deployment tags to `v*` and disable administrator bypass where available. Merely naming an environment in YAML does not require approval.
2. In the npm settings for **`@billbliss/architecture-graph`**, add a **GitHub Actions trusted publisher** with the following exact values:

| Setting | Value |
| --- | --- |
| Organization or user | `billbliss` |
| Repository | `architecture-graph` |
| Workflow filename | `package.yml` |
| Environment | `npm-publish` |
| Allowed action | Direct publishing with `npm publish` |

3. In GitHub **Settings → Secrets and variables → Actions → Variables**, add the repository variable **`NPM_PUBLISH_ENABLED`** with value **`true`** only after both settings are complete. No `NPM_TOKEN` or `NODE_AUTH_TOKEN` secret is needed. Leaving the variable unset prevents publishing; a release tag then fails the configuration check with an explanation.
4. Confirm a normal `main` workflow run passes before creating a release tag. The workflow additionally checks that the environment has required reviewers before it can reach the approval job.

The publish job uses a GitHub-hosted runner, Node 24 and npm 11.18.0, with OIDC permission confined to that job. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for configuration. GitHub’s [required-reviewer availability](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) depends on plan and visibility; if reviewers are unavailable, leave publishing disabled rather than silently removing the gate.

## Make a release

Choose a new stable version; 0.3.0 is already taken. Update `package.json`, the lockfile, `src/model.ts`, the bundled skill metadata and expected toolkit version, and `.claude-plugin/plugin.json` together. Refresh the installed project skill after reviewing local edits. Update version-specific installation examples, rebuild schemas and both graphs’ generated views, and run `npm run verify`, `node bin/ag.js check`, `npm run package` and `npm run test:package`. The version-consistency test catches mismatched toolkit/skill/plugin metadata.

Commit and push the release changes to `main`, and wait for CI. Then push a matching tag, for example `v0.3.1` **only if the package version is 0.3.1**. Open the tag’s Actions run, review the tests and artifact, and approve deployment to `npm-publish`. The tag must identify the release commit, and release runs are not automatically cancelled by a subsequent push. Prerelease versions are deliberately excluded from this `latest` release path.

No tag is created by this setup. No marketplace submission, GitHub Release creation or repository visibility change is automated.

## Validate before announcing marketplace support

- [ ] Try AG in a real project: bootstrap from design documents, make a meaningful code change, retrieve the relevant context, and maintain the graph.
- [ ] Test the plugin in each agent you intend to support, using a local checkout or an accessible private source. Confirm installation, skill discovery, invocation and access to the modeling reference.
- [ ] Verify that the skill uses the consuming project's installed toolkit and handles a missing or mismatched toolkit version clearly.
- [ ] Exercise plugin update and removal, and check what happens when a project-installed copy of the skill already exists.
- [ ] Record the tested agent versions, repository revision, installation method and results. Manifest checks alone do not establish runtime compatibility.
- [ ] Run `npm run verify`, `npm run package`, and `npm run test:package` for the release candidate, then check the hosted Actions results.

For Claude Code, the prepared repository route is:

```text
/plugin marketplace add billbliss/architecture-graph
/plugin install architecture-graph@architecture-graph
```

These are candidate test instructions, not a public installation recommendation. They require the manifests to be present in the remote revision and the caller to have repository access. No successful live test has been recorded. Codex uses its own marketplace commands; do not assume the Claude commands or manifests establish Codex compatibility.

## Make each release decision explicitly

Making the GitHub repository public, publishing the npm package, and offering a marketplace plugin are separate release decisions. None is required merely to keep the manifests in source control.

When validation is satisfactory, choose which distribution routes to release. For npm, follow the version-tag and approval flow above. For a marketplace, complete the agent-specific installation test before advertising the route; submission to a public directory is a further distribution choice. Update the installation guide only for the routes that have actually been verified and made available.
