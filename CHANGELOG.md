# Changelog

Italian version: [CHANGELOG.it.md](./CHANGELOG.it.md)

## Added
- Dental test models (31 STL files) in `test/testfiles/dental/`.
- Reference grid assets: `grid_reference.svg`, `.stl`, `.obj`, `.mtl`.
- Engine: `DetectCusps` (cusp detection by topological persistence of local maxima along the occlusal direction), `SegmentTeeth` (tooth separation from concave grooves) and `GetWeldedMesh` (vertex welding and vertex graph), with tests.
- Website: new toolbar button that, in a single step:
  - splits the model into two separately selectable meshes, "Lower arch" and "Upper arch" (once per loaded model);
  - detects the cusps of every tooth and shows them as small red markers;
  - aligns a black reference grid to each arch, using the current up vector as occlusal direction.
- Markers and grids are visible only while the matching arch is selected.
- "Show/hide cusps" toggle button: visible only when the grid is enabled, on by default every time the grid is enabled. It hides only the markers, the grid stays.
- Viewer: `RemoveExtraObject` / `ViewerModel.RemoveObject` to remove a single extra object.
- Explanatory comments on the new functions and changes.

## Changed
- Cusp detection is no longer a separate button: it is part of the grid loading.
- Cusp markers are smaller (radius 0.4% of the model diagonal).
- The grid scale also takes the arch depth into account, so deep arches fit inside it.

## Fixed

- Tooth-size filter widened (up to 2.5x the median), so large molars are no longer discarded.
- Distal molars fused with the gum segment now get cusps too (gum cusps at crown height are recovered).
- Measure tool and grid no longer interfere: each tool removes only its own extra objects instead of clearing all of them.
- Marker rotation and cusp precision (the upper arch no longer shows cusps on the roots).
- Tooth segmentation on dense scans: the concavity is measured on a neighborhood radius proportional to the model size (`relativeRadius`), so real single-arch scans are split into teeth.
- Arch split no longer triggers on a single arch with isolated misdetected fragments (each arch needs at least 3 teeth).
- A single upper arch gets its occlusal direction flipped automatically, so cusps are detected on the crowns and not on the roots.
