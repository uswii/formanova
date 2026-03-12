/**
 * GemInstanceRenderer — converts N individual diamond/gem meshes into a single
 * THREE.InstancedMesh to dramatically reduce draw calls.
 *
 * Usage:
 *   const renderer = new GemInstanceRenderer({ scene, diamondMeshes, material });
 *   renderer.updateFromMeshes();   // after transforms change
 *   renderer.setMaterial(newMat);   // swap simple ↔ refraction
 *   renderer.dispose();             // cleanup on scene change
 *
 * Limitation: all meshes in a single group must share the same BufferGeometry.
 * If geometries differ, create one renderer per geometry group.
 */

import * as THREE from "three";

export type GemMode = "simple" | "refraction";

interface GemInstanceGroup {
  instancedMesh: THREE.InstancedMesh;
  sourceMeshes: THREE.Mesh[];
}

export default class GemInstanceRenderer {
  private scene: THREE.Scene;
  private groups: GemInstanceGroup[] = [];
  private totalCount: number = 0;

  constructor(
    scene: THREE.Scene,
    diamondMeshes: THREE.Mesh[],
    material: THREE.Material,
  ) {
    this.scene = scene;
    this.totalCount = diamondMeshes.length;
    if (this.totalCount === 0) return;

    // Group meshes by geometry reference (uuid) for correct instancing
    const geoGroups = new Map<string, THREE.Mesh[]>();
    for (const mesh of diamondMeshes) {
      const key = mesh.geometry.uuid;
      if (!geoGroups.has(key)) geoGroups.set(key, []);
      geoGroups.get(key)!.push(mesh);
    }

    for (const [, meshes] of geoGroups) {
      const geo = meshes[0].geometry;
      const instanced = new THREE.InstancedMesh(geo, material, meshes.length);
      instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      meshes.forEach((mesh, i) => {
        mesh.updateWorldMatrix(true, false);
        instanced.setMatrixAt(i, mesh.matrixWorld);
      });

      instanced.instanceMatrix.needsUpdate = true;
      scene.add(instanced);
      this.groups.push({ instancedMesh: instanced, sourceMeshes: meshes });
    }
  }

  /** Swap material for all instance groups */
  setMaterial(material: THREE.Material) {
    for (const g of this.groups) {
      g.instancedMesh.material = material;
    }
  }

  /** Re-sync all instance transforms from source meshes (call after edits) */
  updateFromMeshes() {
    const mat = new THREE.Matrix4();
    for (const g of this.groups) {
      g.sourceMeshes.forEach((mesh, i) => {
        mesh.updateWorldMatrix(true, false);
        mat.copy(mesh.matrixWorld);
        g.instancedMesh.setMatrixAt(i, mat);
      });
      g.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Update a single instance transform */
  updateTransform(groupIndex: number, instanceIndex: number, matrix: THREE.Matrix4) {
    const g = this.groups[groupIndex];
    if (!g || instanceIndex >= g.sourceMeshes.length) return;
    g.instancedMesh.setMatrixAt(instanceIndex, matrix);
    g.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  /** Remove all instanced meshes from scene and dispose */
  dispose() {
    for (const g of this.groups) {
      this.scene.remove(g.instancedMesh);
      // Don't dispose geometry — it's shared with source meshes
      if (Array.isArray(g.instancedMesh.material)) {
        g.instancedMesh.material.forEach((m) => m.dispose());
      } else {
        g.instancedMesh.material.dispose();
      }
      // Restore source mesh visibility
      g.sourceMeshes.forEach((m) => { m.visible = true; });
    }
    this.groups = [];
  }

  get instanceCount() {
    return this.totalCount;
  }
}
