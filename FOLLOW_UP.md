# Floor plan editor follow ups

Requested and implemented on November 24, 2026. Manual verification by the user is still pending.

- [x] Add diagonal resizing at actual floor shape corners. Invisible corner targets show the matching diagonal cursor and resize the whole footprint about the opposite corner. Visible point handles remain on the selection box only; smooth curves retain edge resizing.
- [x] Rework the next-floor stair arrival shown against the upper wall. Arrivals now show a shaded descending flight with a flush landing and side rails, clipped to the upper floor and drawn behind its walls. The source-level label is hover text rather than floating over the wall. The original report was imprecise, so confirm this addresses the pictured issue during manual testing.
- [x] Allow drawing a floor directly inside a reference blueprint. Blueprint hit areas are enabled only in Selection mode, and the drag handler also checks the active tool. Drawing tools can now start inside or across a reference outline without selecting it.
- [x] Add cream-and-sage vector cursors for selection, buttons, dragging, panning, drawing, erasing, and horizontal, vertical, and diagonal resizing. Text fields retain the standard text caret; unsupported clients have native cursor fallbacks.

## Working preference

Do not run npm commands or extensive tests. The user will test the changes manually.
