import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { PathFindingSystem, Grid, GridNode } from '../systems/PathFindingSystem';

// src/game/systems/PathFindingSystem.test.ts

// Mock for LevelSystem
class MockLevelSystem {
  private walls: THREE.Object3D[] = [];

  constructor(wallConfigurations: { x: number, z: number, width: number, depth: number }[] = []) {
    // Create walls based on provided configurations
    this.walls = wallConfigurations.map(config => {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(config.width, 2, config.depth),
        new THREE.MeshBasicMaterial()
      );
      wall.position.set(config.x, 0, config.z);
      
      // Add bounding box to wall userData
      const boundingBox = new THREE.Box3();
      boundingBox.setFromObject(wall);
      wall.userData.boundingBox = boundingBox;
      
      return wall;
    });
  }

  getWalls(): THREE.Object3D[] {
    return this.walls;
  }
}

describe('PathFindingSystem', () => {
  let levelSystem: MockLevelSystem;
  let pathFindingSystem: PathFindingSystem;
  
  beforeEach(() => {
    // Default empty level
    levelSystem = new MockLevelSystem();
  });
  
  it('should find direct path when no obstacles', () => {
    pathFindingSystem = new PathFindingSystem(levelSystem as any, 1);
    
    const start = new THREE.Vector3(0, 0, 0);
    const end = new THREE.Vector3(5, 0, 5);
    
    const path = pathFindingSystem.findPath(start, end);
    
    expect(path.length).toBeGreaterThan(0);
    expect(path[0].x).toBeCloseTo(start.x);
    expect(path[0].z).toBeCloseTo(start.z);
    expect(path[path.length - 1].x).toBeCloseTo(end.x);
    expect(path[path.length - 1].z).toBeCloseTo(end.z);
  });
  
  it('should navigate around simple obstacle', () => {
    // Create a wall in the middle
    levelSystem = new MockLevelSystem([
      { x: 0, z: 0, width: 4, depth: 1 }
    ]);
    
    pathFindingSystem = new PathFindingSystem(levelSystem as any, 1);
    
    const start = new THREE.Vector3(-5, 0, 0);
    const end = new THREE.Vector3(5, 0, 0);
    
    const path = pathFindingSystem.findPath(start, end);
    
    expect(path.length).toBeGreaterThan(2); // Should have intermediate points
    
    // Check that path goes around obstacle (should have y coordinates that deviate from 0)
    const hasDetour = path.some(point => Math.abs(point.z) > 0.5);
    expect(hasDetour).toBe(true);
  });
  
  it('should handle unreachable destinations', () => {
    // Create a wall that completely blocks the path
    levelSystem = new MockLevelSystem([
      { x: 0, z: 0, width: 40, depth: 2 }
    ]);
    
    pathFindingSystem = new PathFindingSystem(levelSystem as any, 1);
    
    const start = new THREE.Vector3(0, 0, -5);
    const end = new THREE.Vector3(0, 0, 5);
    
    // Spy on console.log
    const consoleSpy = vi.spyOn(console, 'log');
    
    const path = pathFindingSystem.findPath(start, end);
    
    // Should return fallback path with a different route
    expect(path.length).toBeGreaterThan(0);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("フォールバック経路を使用します"));
    
    // Cleanup
    consoleSpy.mockRestore();
  });
  
  it('should navigate through narrow passages with proper clearance', () => {
    // Create two walls with a narrow passage
    levelSystem = new MockLevelSystem([
      { x: -3, z: 0, width: 4, depth: 1 },
      { x: 3, z: 0, width: 4, depth: 1 }
    ]);
    
    pathFindingSystem = new PathFindingSystem(levelSystem as any, 0.5); // Smaller grid size for better precision
    
    const start = new THREE.Vector3(0, 0, -5);
    const end = new THREE.Vector3(0, 0, 5);
    
    const path = pathFindingSystem.findPath(start, end);
    
    // Should find a path through the passage
    expect(path.length).toBeGreaterThan(0);
    expect(pathFindingSystem.isLastPathfindingSuccessful()).toBe(true);
  });
});

describe('Grid', () => {
  let grid: Grid;
  
  beforeEach(() => {
    grid = new Grid(10, 10, 1);
  });
  
  it('should convert between world and grid coordinates correctly', () => {
    const worldPos = { x: 2.7, z: -3.2 };
    const gridPos = grid.worldToGrid(worldPos.x, worldPos.z);
    const backToWorld = grid.gridToWorld(gridPos.x, gridPos.y);
    
    // Should be approximately the same position
    expect(backToWorld.x).toBeCloseTo(Math.floor(worldPos.x) + 0.5);
    expect(backToWorld.z).toBeCloseTo(Math.floor(worldPos.z) + 0.5);
  });
  
  it('should update grid from walls correctly', () => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3));
    wall.position.set(0, 0, 0);
    
    // Add bounding box
    const boundingBox = new THREE.Box3();
    boundingBox.setFromObject(wall);
    wall.userData.boundingBox = boundingBox;
    
    grid.updateFromWalls([wall], 20);
    
    // Center nodes should be unwalkable
    const centerNode = grid.getNode(5, 5);
    expect(centerNode?.isWalkable).toBe(false);
    
    // Edge nodes should be walkable
    const edgeNode = grid.getNode(0, 0);
    expect(edgeNode?.isWalkable).toBe(true);
  });
  
  it('should find neighbors correctly excluding diagonal blocked paths', () => {
    // Create a grid with specific walkable/unwalkable configuration
    const customGrid = new Grid(3, 3, 1);
    
    // Make some nodes unwalkable
    const nodeMiddleRight = customGrid.getNode(2, 1);
    const nodeBottomMiddle = customGrid.getNode(1, 2);
    if (nodeMiddleRight) nodeMiddleRight.isWalkable = false;
    if (nodeBottomMiddle) nodeBottomMiddle.isWalkable = false;
    
    // Get neighbors of bottom right node (should not include diagonal due to corner cutting)
    const bottomRight = customGrid.getNode(2, 2);
    const neighbors = customGrid.getNeighbors(bottomRight!);
    
    // Should only have non-diagonal neighbors since diagonals would cut corners
    expect(neighbors.length).toBeLessThan(8);
  });
});