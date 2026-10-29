// Spacing constants (px). Documented in spec/tasks/T11-layout.md Contract notes.
/** Horizontal gap between two (inflated) core boxes in the same layer. */
export const NODE_GAP = 60;
/** Vertical gap between layers (between the tallest box of a layer and the top of the next). */
export const LAYER_GAP = 90;
/** Distance from an owner's outline to its attribute pills (first try). */
export const ATTR_GAP = 36;
/** Gaps tried in order when attributes would overlap other boxes. */
export const ATTR_GAP_TRIES = [36, 50, 70, 100];
/** Gap between neighbouring attribute pills in a fan. */
export const ATTR_PITCH_PAD = 8;
/** Outer margin of the whole layout. */
export const MARGIN = 20;
