# Manual tests

Behaviour that needs a running VS Code and a real browser cannot be automated here.
The cases are in [test-plan.md](test-plan.md). Each case runs in all three open modes
(`external`, `both`, `editor`). Record the result in the results matrix of that file.

Use the sample files in [../testdata/](../testdata/) for every case.

## How to run

1. Start the extension in an Extension Development Host (`F5` in this repo).
2. Open the `tests/testdata/` folder as the workspace in that window.
3. Open `test-plan.md` in a **different** VS Code window (`code --disable-extensions tests/manual/test-plan.md`)
   or in another editor. Do not open it in the Development Host: in mode `external` the extension would
   send the Markdown file to the browser.
4. Set the mode for the first run (`external`), run all cases, and mark each result P, F, S or N/A.
5. Switch to `both`, then `editor`, and repeat step 4. Close the browser pages and editor tabs
   between runs, or the next run starts with leftovers.
6. For every F, write the VS Code version, OS, browser and what happened in the notes table.
