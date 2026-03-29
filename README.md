# Chord Blocks MVP

Simple local prototype for building chord blocks, choosing inversions, previewing pressed piano keys, and auditioning each block.

## Run

Open `index.html` in a browser.

If your browser behaves oddly when opened via `file://`, run a tiny local server instead:

- `python3 -m http.server 4173`
- then open `http://localhost:4173`

## Current scope

- Enter chord symbols such as `Ebm`, `Cmaj7`, `Bb7`, `F#sus4`
- Choose register and inversion start note
- Keep a block empty
- See resolved notes and keyboard highlights
- Click a block or `Play Block` to audition it
- Play the full block sequence using BPM timing
- Save automatically in browser local storage
- Manual save, reset, export, and import

## Supported chord types

- Major
- Minor
- Diminished
- Augmented
- Sus2
- Sus4
- Major 7
- Dominant 7
- Minor 7
