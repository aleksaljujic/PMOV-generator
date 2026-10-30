// Spacing constants (px). Documented in spec/tasks/T11-layout.md Contract notes.
/** Horizontal gap between two (inflated) core boxes in the same layer. */
export const NODE_GAP = 40;

/** Minimum actual-box gap between S / junction / podtip rows in a specialization block. */
export const SPEC_GAP = 30;
/** Base desired edge length (center to center, stress layout). */
export const EDGE_LENGTH = 160;
/** Distance from an owner's outline to its attribute pills (first try). */
export const ATTR_GAP = 36;
/** Gaps tried in order when attributes would overlap other boxes. */
export const ATTR_GAP_TRIES = [36, 50, 70, 100];
/** Gap between neighbouring attribute pills in a fan. */
export const ATTR_PITCH_PAD = 8;
/** Outer margin of the whole layout. */
export const MARGIN = 20;
