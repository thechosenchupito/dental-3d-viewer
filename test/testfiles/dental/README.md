# Dental 3D test models

These fixtures are intended for local viewer, importer, mesh, and multi-file
testing. They are not intended for diagnosis, treatment, or clinical use.

## Human lower jaw

`human_lower_jaw/` contains the STL meshes selected from the synthetic human
lower-jaw dataset. It includes individual mandibular teeth, periodontal
ligaments, and cancellous and cortical jaw-bone meshes. The original dataset
also contains SpaceClaim files; they are not included because they are not
viewer input formats.

- Source: [Data of synthetic 3D models of the human jaw, including teeth,
  ligaments, and bone structures](https://data.mendeley.com/datasets/xjsx7nfhj8/1)
- DOI: [10.17632/xjsx7nfhj8.1](https://doi.org/10.17632/xjsx7nfhj8.1)
- Authors: Cristian Diaz, Carlos Andres Ferro Sanchez, and Oscar Campo
- License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Dataset description: geometry derived from DICOM and intraoral scan data
  from a skeletal Class I patient without orthodontic history.

Suggested fixtures:

- `human_lower_jaw/Teeth/STL/D46.stl`: individual molar.
- `human_lower_jaw/Teeth/STL/D31.stl`: individual incisor.
- `human_lower_jaw/Bones/Cancellous/Alveolar bone lower jaw with boolean.stl`
  and `human_lower_jaw/Bones/Cortical/Cortical bone lower jaw with boolean.stl`:
  separate jaw-bone meshes.
- `human_lower_jaw/PDL/STL/`: individual periodontal-ligament meshes.

## Human mouth

- File: `human_mouth/human_mouth_detailed.stl`
- Source: [3D model of the human mouth](https://commons.wikimedia.org/wiki/File:3D_model_of_the_human_mouth.stl)
- Original model: “Human mouth detailed” by Mince,
  [Sketchfab](https://sketchfab.com/3d-models/human-mouth-detailed-522eda0ec0e3413a914b1b298a791320)
- License: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- This is an illustrative, stylized model rather than a precise anatomical scan.

The licenses apply to the corresponding model files. Retain this attribution
when copying or redistributing the fixtures.

## Reference grid

- `grid_reference.svg`: vector reconstruction of the grid supplied in the
  conversation. Online 3D Viewer imports filled SVG shapes as extruded geometry.
- `grid_reference.stl`: directly loadable 3D version of the same grid, with
  approximate dimensions of 120 x 100 x 2 mm.
- `grid_reference.obj` and `grid_reference.mtl`: the same 3D grid with an
  explicitly black material. Load the OBJ together with its MTL file.

The grid is a geometric approximation of the image, not a calibrated or
dimensionally accurate CAD drawing. STL has no standard material-color field;
use the OBJ/MTL or SVG version when the black color must be preserved.
