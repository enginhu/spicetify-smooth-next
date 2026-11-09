# Publishing to GitHub and Marketplace

Source repository: [enginhu/spicetify-smooth-next](https://github.com/enginhu/spicetify-smooth-next). Installation packages are distributed through [GitHub Releases](https://github.com/enginhu/spicetify-smooth-next/releases). Publishing a GitHub release does not automatically list the extension in Marketplace.

Spicetify Marketplace does not require a separate ZIP upload or extension pull request. The [official publishing guide](https://github.com/spicetify/marketplace/wiki/Publishing-to-Marketplace) describes discovery through a public GitHub repository, the `spicetify-extensions` topic, and a valid `manifest.json` at the repository root.

The repository includes these publishing files:

- `manifest.json`: name, description, preview, main JavaScript file, README, and tags.
- `preview.svg`: promotional artwork without personal account or listening-history data.
- `smooth-next.js`: the single-file extension.
- `README.md` and `macos/README.md`: usage and macOS companion instructions in English.
- `LICENSE`: the MIT license.

## Release workflow

1. Update the source version header and `controller.version`, along with the companion extension header and release documentation.
2. Run `node --test smooth-next.test.cjs` and `bash macos/test.sh`. To build the complete ZIP, run `bash macos/build.sh` on macOS, then `python3 scripts/package.py`.
3. Push the changes to the GitHub repository's default branch.
4. Create a GitHub release with a new version tag and attach the ZIP and SHA-256 file from `dist/`.
5. If Marketplace listing is desired, add the `spicetify-extensions` repository topic and keep the repository public. The macOS companion requires separate installation; Marketplace distributes only the main JavaScript extension.

GitHub and Marketplace search indexes may take time to update. Verify the listing before announcing that the extension appears in Marketplace search. Users can install the ZIP directly from GitHub Releases.
