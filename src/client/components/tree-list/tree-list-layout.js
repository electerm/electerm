export const treeLevelIndent = 12
export const treeRowHeight = 26
export const treeEditorRowHeight = 32

// How many levels may push a row to the right. Imported SSH configs nest freely
// and nothing caps the depth, so before this every level added 12px of left
// padding with no ceiling: at depth 8 that is 96px of a 200px panel, and the
// hover state reserves another 20px for the action icons. Past this many levels
// rows stop moving right, so the name keeps a usable width; the row tooltip
// still carries the full path, and the capped rows get a marker so depth is not
// silently lost.
export const maxTreeIndentSteps = 5

// indent steps a row at `depth` is allowed to claim
export function treeIndentSteps (depth) {
  return Math.min(Math.max(0, depth), maxTreeIndentSteps)
}

// left offset in px for a row whose content sits `depth` levels in
export function treeIndentPx (depth) {
  return treeIndentSteps(depth) * treeLevelIndent
}

// a group row carries an extra treeLevelIndent of its own padding for the
// expander column (.tree-list-row-group in tree-list.styl), so its outer
// padding is one step less than the offset its content should end up at
export function treeGroupPaddingPx (depth) {
  return Math.max(0, treeIndentPx(depth) - treeLevelIndent)
}

// true when this row would have indented further but was stopped by the cap
export function isTreeIndentCapped (depth) {
  return depth > maxTreeIndentSteps
}
