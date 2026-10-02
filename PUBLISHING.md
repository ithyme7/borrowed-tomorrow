# Prepared GitHub Pages plan

This plan has not been executed. The owner has confirmed the account name `ithyme7`; repository creation, uploading source and publishing a Pages demo require approval for these concrete public artifacts. No license or new terms acceptance is inferred from an account name.

1. Review the exact local ZIP and its separate manifest/scan report. Resolve any desired project license; none is included or silently chosen. Confirm the actual Sanity project remains available and owner-controlled.
2. After source-publication approval, create the public repository `ithyme7/borrowed-tomorrow` with default branch `main`, without generated README/license files. Upload only this folder's reviewed source files. Never upload the surrounding workspace, private provisioning directory, actual environment files, dependencies, old ZIPs or account logs.
3. After demo-publication approval, open repository Settings > Pages and select **GitHub Actions** as Source. Review any current account/Actions policy or displayed terms before accepting them. No custom domain or paid feature is necessary.
4. An authorized Sanity owner must permit the exact anonymous browser origin `https://ithyme7.github.io`. Do not include `/borrowed-tomorrow/` in a CORS origin or enable credentialed wildcard access. Project ownership/retention is a separate real gate.
5. Run the prepared **Deploy demo to GitHub Pages** workflow manually. It checks out `main`, installs/builds using the npm lockfile, provides the two nonsecret public Sanity identifiers, uploads only static `dist`, and deploys through the `github-pages` environment. Permissions are `contents: read`, `pages: write`, `id-token: write`; the deploy job depends on the build. The YAML does not trigger on push.
6. Verify the resulting actual URL and browser: assets beneath `/borrowed-tomorrow/` return successfully; six objects/five eras load; the source label shows the public Sanity project rather than fixture fallback; filters, blocked approval, valid local approval and reload behavior work. Check an actual Actions/deployment success before reporting publication. These checks are not satisfied by this local source preparation.

The source config fixes `site` to `https://ithyme7.github.io` and `base` to `/borrowed-tomorrow`, matching the proposed project repository. Change both deliberately if the account/repository changes. Relative fragment links require no extra base prefix; Astro-generated JS/CSS receives the configured base.

GitHub Free supports Pages from public repositories. This fictional static project demo is not an e-commerce/payment site or commercial SaaS. GitHub Pages has service limits; it is not a revenue channel or a guaranteed prize. Public browser content reads remain subject to the Sanity project's availability, published contents and CORS policy.

Primary sources checked 2 October 2026:
- https://docs.astro.build/en/guides/deploy/github/
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

The workflow versions follow the current official Astro deployment guide. Workflow execution, repository availability and browser deployment are untested here. No secret or credential needs to be committed to build this anonymous-read frontend.
