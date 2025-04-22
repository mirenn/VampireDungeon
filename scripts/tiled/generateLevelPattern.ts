import * as fs from 'fs';
import * as path from 'path';

interface TiledMap {
  width: number;
  height: number;
  layers: {
    name: string;
    data: number[];
    width: number;
    height: number;
  }[];
}

// タイルの座標を表すインターフェース
interface TilePosition {
  x: number;
  y: number;
}

// 壁の矩形を表すインターフェース
interface Wall {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 連続するタイルを水平方向の壁として検出
function findHorizontalWalls(tiles: TilePosition[]): Wall[] {
  // タイルをy座標でグループ化
  const rows = new Map<number, number[]>();

  tiles.forEach((tile) => {
    if (!rows.has(tile.y)) {
      rows.set(tile.y, []);
    }
    rows.get(tile.y)!.push(tile.x);
  });

  const walls: Wall[] = [];

  // 各行で連続するx座標をまとめる
  rows.forEach((xPositions, y) => {
    // x座標でソート
    xPositions.sort((a, b) => a - b);

    let start = xPositions[0];
    let end = start;

    for (let i = 1; i < xPositions.length; i++) {
      if (xPositions[i] === end + 1) {
        // 連続している場合は拡張
        end = xPositions[i];
      } else {
        // 連続が途切れたら壁を追加
        walls.push({
          x: start,
          y,
          width: end - start + 1,
          height: 1,
        });

        // 新しい連続の開始
        start = xPositions[i];
        end = start;
      }
    }

    // 最後の連続を追加
    walls.push({
      x: start,
      y,
      width: end - start + 1,
      height: 1,
    });
  });

  return walls;
}

// 連続するタイルを垂直方向の壁として検出
function findVerticalWalls(
  tiles: TilePosition[],
  horizontalWalls: Wall[],
): Wall[] {
  // 水平方向の壁に含まれるタイルを除外
  const horizontalTiles = new Set<string>();

  horizontalWalls.forEach((wall) => {
    for (let x = wall.x; x < wall.x + wall.width; x++) {
      horizontalTiles.add(`${x},${wall.y}`);
    }
  });

  // 水平壁に含まれないタイルだけを対象にする
  const remainingTiles = tiles.filter(
    (tile) => !horizontalTiles.has(`${tile.x},${tile.y}`),
  );

  // タイルをx座標でグループ化
  const columns = new Map<number, number[]>();

  remainingTiles.forEach((tile) => {
    if (!columns.has(tile.x)) {
      columns.set(tile.x, []);
    }
    columns.get(tile.x)!.push(tile.y);
  });

  const walls: Wall[] = [];

  // 各列で連続するy座標をまとめる
  columns.forEach((yPositions, x) => {
    // y座標でソート
    yPositions.sort((a, b) => a - b);

    let start = yPositions[0];
    let end = start;

    for (let i = 1; i < yPositions.length; i++) {
      if (yPositions[i] === end + 1) {
        // 連続している場合は拡張
        end = yPositions[i];
      } else {
        // 連続が途切れたら壁を追加
        walls.push({
          x,
          y: start,
          width: 1,
          height: end - start + 1,
        });

        // 新しい連続の開始
        start = yPositions[i];
        end = start;
      }
    }

    // 最後の連続を追加
    walls.push({
      x,
      y: start,
      width: 1,
      height: end - start + 1,
    });
  });

  return walls;
}

function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error('Usage: ts-node generateLevelPattern.ts path/to/map.json');
    process.exit(1);
  }

  const map: TiledMap = JSON.parse(
    fs.readFileSync(path.resolve(jsonPath), 'utf8'),
  );

  const wallLayer = map.layers.find((l) => l.name === 'Wall');
  if (!wallLayer) {
    console.error('Layer "Wall" が見つかりません');
    process.exit(1);
  }

  // Floor レイヤーを取得
  const floorLayer = map.layers.find((l) => l.name === 'Floor');
  if (!floorLayer) {
    console.error('Layer "Floor" が見つかりません');
    process.exit(1);
  }

  const { width, height, data: wallData } = wallLayer;
  // タイル GID != 0 を「Wall」とみなす
  const walls: TilePosition[] = wallData
    .map((gid, i) =>
      gid > 0 ? { x: i % width, y: Math.floor(i / width) } : null,
    )
    .filter(Boolean) as TilePosition[];

  // Floor レイヤーのタイルデータを抽出
  const { data: floorData } = floorLayer;
  const floors: TilePosition[] = floorData
    .map((gid, i) =>
      gid > 0 ? { x: i % width, y: Math.floor(i / width) } : null,
    )
    .filter(Boolean) as TilePosition[];

  // 水平方向の壁を検出
  const horizontalWalls = findHorizontalWalls(walls);

  // 垂直方向の壁を検出
  const verticalWalls = findVerticalWalls(walls, horizontalWalls);

  // すべての壁を結合
  const allWalls = [...horizontalWalls, ...verticalWalls];

  console.log('export const walls = [');
  allWalls.forEach((w) =>
    console.log(
      `  { x: ${w.x}, y: ${w.y}, width: ${w.width}, height: ${w.height} },`,
    ),
  );
  console.log('];');

  // Floor データをエクスポート
  console.log('\nexport const floors = [');
  floors.forEach((f) => console.log(`  { x: ${f.x}, y: ${f.y} },`));
  console.log('];');
}

main();
