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

Until `/josh-analysis` exists, use `/implementation-rigor` in its place.

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

## Feel

- Make the app feel as native as possible on iOS and Android while keeping the look of `theme.css`. Prefer the platform's own behaviour and controls (native `dialog`, date and file pickers, the share sheet, back gesture and button, safe areas, momentum scrolling, instant touch feedback) over web-page conventions or custom widgets.
- Where feeling native and following the theme pull in different directions, keep the theme where you can and raise the conflict rather than quietly picking one.

## Errors

- Log every error verbosely through `logError` in `src/lib/log.js`, with context: the operation, table names, record ids and field names, plus the error's name, message, stack and any wrapped causes. The log keeps the last 50 records in meta for the settings screen, and forwards each record to sinks added with `addErrorSink`. That is where an analytics service such as Firebase will plug in later.
- Never put journal content in a log record: no notes, names, titles, search text or photos. Log ids, table and field names and error details only, because these records may leave the device one day.
- Every error a user sees must say plainly what went wrong and what they can do next (try again, reload, make a backup and free space, go back, open in a normal window). Turn errors into messages with `explainError` in `src/lib/errors.js` rather than writing messages ad hoc, and never show a raw error message or stack. Keep everything the user typed when something fails.
- Do not add Firebase or any other network sink until asked. The brief says the app makes no network requests after loading, so adding one is a decision to make deliberately.

## Dependencies

- Always use the latest stable release of build and test tools (Vite, `@sveltejs/vite-plugin-svelte`, Svelte, Vitest and the like). Check with `npm view <package> version` before installing, and run `npm outdated` at the start of each step and upgrade anything that is behind. If a tool has to be held back, say which and why.
- Keep external dependencies to a minimum. Prefer the platform and a few lines of our own code over a package, even one the brief allows, and add each listed package only when the step that uses it begins.

## Tests

- Do not write UI tests. They are of no use to this project.
- Do not write fragile tests. That means no tests tied to markup, class names, snapshots, timing or the internals of a function.
- Do write tests for behaviour that matters and can be checked through a stable interface. That is the database module and `dates.js`, as listed in section 18 of the brief.
- A test should fail only when the behaviour it describes is broken.

## Commands

- `npm run dev` to run the app locally (also served on your network, for testing on a phone)
- `npm test` to run the tests, or `npm run test:watch` to keep them running
- `npm run build` to make the production build, and `npm run preview` to serve it
- `npm run check` to type-check the JSDoc in `src/lib`

Update this section if the commands change.
