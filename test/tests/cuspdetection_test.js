import * as assert from 'assert';
import * as OV from '../../source/engine/main.js';
import { ImportFile } from '../utils/testfiles.js';

function GetBumpyMesh (bumps, size)
{
    const n = 60;
    let mesh = new OV.Mesh ();
    for (let j = 0; j <= n; j++) {
        for (let i = 0; i <= n; i++) {
            let x = size * i / n;
            let y = size * j / n;
            let z = 0.0;
            for (let bump of bumps) {
                let d2 = (x - bump.x) * (x - bump.x) + (y - bump.y) * (y - bump.y);
                z += bump.h * Math.exp (-d2 / (2.0 * 1.2 * 1.2));
            }
            z += 0.01 * Math.sin (7.0 * x) * Math.cos (5.0 * y);
            mesh.AddVertex (new OV.Coord3D (x, y, z));
        }
    }
    for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
            let a = j * (n + 1) + i;
            let b = a + 1;
            let c = a + n + 1;
            let d = c + 1;
            mesh.AddTriangle (new OV.Triangle (a, b, d));
            mesh.AddTriangle (new OV.Triangle (a, d, c));
        }
    }
    return mesh;
}

export default function suite ()
{

describe ('Cusp Detection', function () {
    it ('Empty mesh', function () {
        assert.deepStrictEqual (OV.DetectCusps (new OV.Mesh ()), []);
    });

    it ('Six cusps', function () {
        let bumps = [
            { x : 2.0, y : 2.0, h : 2.0 }, { x : 5.0, y : 2.0, h : 1.8 }, { x : 8.0, y : 2.0, h : 1.6 },
            { x : 2.0, y : 6.0, h : 1.7 }, { x : 5.0, y : 6.0, h : 1.5 }, { x : 8.0, y : 6.0, h : 1.4 }
        ];
        let cusps = OV.DetectCusps (GetBumpyMesh (bumps, 10.0));
        assert.strictEqual (cusps.length, 6);
        for (let bump of bumps) {
            assert.ok (cusps.some ((cusp) => {
                return Math.abs (cusp.position.x - bump.x) < 0.5 && Math.abs (cusp.position.y - bump.y) < 0.5;
            }));
        }
        assert.strictEqual (cusps[0].prominence, Infinity);
    });

    it ('Max count and up direction', function () {
        let bumps = [{ x : 2.0, y : 2.0, h : 2.0 }, { x : 7.0, y : 7.0, h : 1.0 }];
        let mesh = GetBumpyMesh (bumps, 10.0);
        assert.strictEqual (OV.DetectCusps (mesh).length, 2);
        assert.strictEqual (OV.DetectCusps (mesh, { maxCount : 1 }).length, 1);
        assert.strictEqual (OV.DetectCusps (mesh, { upDirection : new OV.Coord3D (0.0, 0.0, 0.0) }).length, 0);
    });

    it ('Real molar and incisor', function (done) {
        ImportFile (new OV.ImporterStl (), 'dental/human_lower_jaw/Teeth/STL', 'D46.stl', (molar) => {
            let molarCusps = OV.DetectCusps (molar);
            assert.ok (molarCusps.length >= 3);
            let top = OV.GetBoundingBox (molar).max.z;
            for (let cusp of molarCusps) {
                assert.ok (cusp.height > top - 2.0);
            }
            ImportFile (new OV.ImporterStl (), 'dental/human_lower_jaw/Teeth/STL', 'D31.stl', (incisor) => {
                assert.strictEqual (OV.DetectCusps (incisor).length, 1);
                done ();
            });
        });
    });
});

}
