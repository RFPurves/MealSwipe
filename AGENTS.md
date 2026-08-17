# Codex Development Instructions

## Core requirement

For every development task in this repository, work in a continuous autonomous loop until the requested outcome is genuinely finished and verified in the running application.

The mandatory workflow is:

**WORK → RUN → TEST IN CHROME → INSPECT → FIX → RETEST → REPEAT**

Do not consider a task complete merely because files were changed, code compiles, or automated checks pass. A task is complete only after the affected functionality has been verified in the real application running locally.

The local application URL is:

`http://localhost:3000`

## Autonomous work loop

For every task:

1. Inspect the existing codebase before making changes.
2. Understand the requested feature, bug, and intended user journey.
3. Implement the necessary changes without unrelated refactoring.
4. Start the development server, or verify that it is already running, on `localhost:3000`.
5. Open the actual application in Chrome at `http://localhost:3000`.
6. Test the feature visually and functionally in the browser.
7. Interact with the page like a real user. As relevant to the task:
   - click buttons and links
   - navigate between pages
   - fill and submit forms
   - test swipe and drag interactions
   - test loading, empty, success, and error states
   - test responsive layouts
8. Inspect the Chrome browser console for errors and warnings.
9. Inspect terminal and development-server output for errors, warnings, failed requests, and runtime problems.
10. If anything is broken, incomplete, visually wrong, inconsistent, or not faithful to the request:
    - return to the code
    - identify the cause
    - fix it
    - reload or reopen the relevant localhost page
    - repeat the visual and functional tests
11. Continue this loop until the implementation works correctly and all task-related problems are resolved.

Codex must not stop after creating or editing files. Codex must not infer that a UI works from source inspection alone.

## Chrome and local-browser requirements

- Use Chrome for visual and functional testing whenever Chrome browser interaction is available.
- Always test the local development environment at `http://localhost:3000`.
- Never test a production, preview, staging, or live website unless the user explicitly requests it.
- If Chrome is showing another tab or website, switch to or open the correct localhost page.
- If the route needed for the task is not open, navigate to it directly.
- Reload the page after relevant code changes and confirm the new behavior is actually rendered.
- Do not substitute source-code review or automated checks for real browser verification.

## Visual QA

Actively inspect the rendered interface for:

- broken or unstable layouts
- overflowing or clipped content
- incorrect spacing, alignment, or visual hierarchy
- elements outside the viewport
- desktop and mobile responsiveness problems
- unreadable or low-contrast text
- incorrect, misleading, or non-working buttons and links
- missing, distorted, or failed images
- loading problems and visual flicker
- inconsistent styling
- obvious usability problems

If something looks wrong, fix it before considering the task complete.

When a task affects UI layout or responsiveness, test at least:

- one desktop or laptop viewport
- one mobile viewport

Also test relevant intermediate sizes when a layout problem could occur around a breakpoint.

## Functional QA

Test the actual user journey affected by the task. Do not test isolated elements only when the feature spans a flow. Do not limit testing to the happy path when obvious edge cases exist.

Relevant journeys in this meal-planning project may include:

- completing onboarding
- selecting dietary preferences
- selecting allergies and disliked ingredients
- choosing food categories
- swiping meals left and right
- using the Like and Skip buttons
- opening Saved Meals
- confirming that liked meals are persisted and displayed
- removing saved meals
- navigating to My Week
- generating a meal plan when that feature exists
- checking combined shopping lists when that feature exists
- refreshing or revisiting routes to verify persisted state

## Automated checks

Where applicable, run the repository's automated checks in addition to browser testing:

- lint
- TypeScript/type checking
- existing unit, integration, or end-to-end tests
- production build checks

Fix failures caused by the changes. Automated checks complement browser testing; they never replace it.

## Error handling

Never ignore task-related:

- browser console errors or warnings
- failed network requests
- React warnings
- hydration errors
- TypeScript errors
- lint failures
- runtime exceptions
- development-server errors or warnings
- broken API calls

Investigate the cause and fix it when it is related to the requested task. If an issue is genuinely external or outside the authorized scope, verify that conclusion and report it clearly as a known limitation.

## Scope discipline

- Stay focused on the task the user requested.
- Do not perform large unrelated refactors or add unnecessary infrastructure.
- Preserve existing user changes and avoid destructive operations.
- If a small adjacent issue directly prevents the requested feature or its verification from working correctly, fix it as part of the task.
- Do not expand into optional follow-up features unless they are required to complete the requested behavior.

## Completion rule

Do not stop after writing code. Do not report completion without testing the running app.

Before finishing any development task, perform one final complete browser pass through the affected user flow at `http://localhost:3000`.

The required completion loop is:

**IMPLEMENT → TEST IN CHROME → IDENTIFY PROBLEMS → FIX → TEST AGAIN**

Repeat as many times as necessary. Only report completion when all of the following are true:

- the requested functionality works
- the UI looks correct at relevant viewport sizes
- the relevant user journey has been tested in Chrome
- there are no related browser-console, network, server, hydration, or runtime errors
- relevant automated checks pass
- any remaining limitations are known, verified, and clearly reported

## Final report

When the task is genuinely finished, briefly report:

- what changed
- what was tested in Chrome
- which localhost routes and user flows were verified
- which automated checks were run and their results
- whether any known limitations remain

Never claim that a task is complete if the required local application or browser verification could not be performed. In that case, report the exact blocker and what remains unverified.
