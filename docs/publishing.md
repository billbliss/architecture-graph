# Prepare publishing before offering it to users

The goal is to make a future release straightforward while leaving time to validate it. The repository includes Claude Code plugin and marketplace manifests, but marketplace installation remains unverified. They are preparation for a release, not a claim that AG is publicly available or ready for marketplace users.

## What is ready today

The toolkit can be built as an npm tarball and installed in a consuming project. Its command can copy the bundled skill into the Codex or Claude Code project directory. Automated checks exercise those installations, including preserving local edits unless replacement is explicitly requested.

The current GitHub Actions workflow tests and packages the toolkit and uploads build artifacts. It does not publish to npm, submit a plugin to a directory, or change repository visibility. The package is now configured for an authorized public npm release; registry authentication and scope access must be verified before publication.

The Claude manifests describe a repository-hosted marketplace. Codex marketplace support has been researched, but this repository's installation path has not been tested in either agent. Keep the tested project-copy route as the user-facing default.

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

When validation is satisfactory, choose which distribution routes to release. For npm, publish the tested archive with `npm publish ./dist/billbliss-architecture-graph-0.3.0.tgz --access public --registry=https://registry.npmjs.org`, then confirm the registry version and install it in a clean project. For a marketplace, complete the agent-specific installation test before advertising the route; submission to a public directory is a further distribution choice. Update the installation guide only for the routes that have actually been verified and made available.
