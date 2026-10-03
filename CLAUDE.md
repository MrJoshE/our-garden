# Garden Journal

Garden Journal is a small installable web app (PWA) for keeping a record of the plants in a garden and how they are doing. The first user is my partner, who will use it on her phone while standing in the garden. All data stays on the device and the app works offline.

The full specification is in `developer-agent-prompt.md`. Read all of it before writing any code. The look of the app is defined by `src/styles/theme.css`, which is supplied. Where the brief and this file disagree, ask me.

Stack in short: Svelte 5 with runes, Vite, plain JavaScript, Dexie for IndexedDB, `vite-plugin-pwa`, and Vitest with `fake-indexeddb`. The brief lists the only dependencies allowed. Ask before adding another.

## How to work

Every feature or piece of implementation follows the same steps, in this order.

1. Create a GitHub issue in this repo that describes the feature, what is in scope and how we will know it is done.
2. Run `/triage-candidate` and `/josh-analysis` on the planned work before writing any code. Add what they find to the issue and adjust the plan.
3. Create a branch and implement the feature. Open a pull request that links the issue.
4. Run `/triage-candidate` and `/josh-analysis` again on what was implemented.
5. Do the edge case review described below and fix what it finds in the same pull request.
6. Write the results of steps 4 and 5 in the pull request, including anything you decided not to fix and why.
7. Stop for my review. When I approve, merge the pull request and close the issue.

Keep each issue and pull request to one feature. The five build steps at the end of the brief are the order of work, and each will usually need several issues.

Use the `gh` CLI for issues and pull requests. Do not commit directly to `main`.

## Edge case review

When a feature is complete, review the code that was written for it, looking specifically for the following.

- Edge cases that are not handled. Section 11 of the brief lists the known ones, and you should look for others.
- User journeys that were missed, such as arriving at a screen another way, going back part way through, or coming back to something left unfinished.
- Poor or unexpected user experience, where the app does something she would not expect or makes her wait, repeat herself or guess.
- Code that has been duplicated when it could have been reused.
- Verbose comments (see below).
- Code that is longer than it needs to be.
- Tests that are fragile or that test the UI.

List what you found in the pull request, then fix it.

## Code standards

- The least code that does the job is the best way to build it. Do not add abstractions, options or helpers for needs we do not have yet.
- Reuse what exists before writing something new. If two places need the same thing, they share one function or component.
- Only write a comment when what the code is doing would not be clear to a senior engineer. Do not write comments that restate the code, describe the change you made, or narrate what happens next.
- Never write a literal colour, size or duration in a component. Use the tokens and classes in `theme.css`.

## Tests

- Do not write UI tests. They are of no use to this project.
- Do not write fragile tests. That means no tests tied to markup, class names, snapshots, timing or the internals of a function.
- Do write tests for behaviour that matters and can be checked through a stable interface. That is the database module and `dates.js`, as listed in section 18 of the brief.
- A test should fail only when the behaviour it describes is broken.

## Commands

- `npm run dev` to run the app locally
- `npm test` to run the tests
- `npm run build` to make the production build

Update this section if the commands change.
