import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

function main() {
  // マップファイルがあるディレクトリ
  const mapsDir = path.resolve('scripts/tiled/maps');

  // マップファイルの検索
  const mapFiles = fs
    .readdirSync(mapsDir)
    .filter((file) => file.endsWith('.tmj'));

  if (mapFiles.length === 0) {
    console.log('No .tmj files found in scripts/tiled/maps/');
    return;
  }

  console.log(`Found ${mapFiles.length} map files to process...`);

  // 各マップファイルを処理
  mapFiles.forEach((mapFile) => {
    try {
      // ファイル名からレベル番号を抽出 (例: "1-1.tmj" → "1/1-1.ts")
      const match = mapFile.match(/^(\d+)-(\d+)\.tmj$/);
      if (!match) {
        console.warn(`Skipping file with invalid name format: ${mapFile}`);
        return;
      }

      const [_, worldNum, levelNum] = match;

      // 出力ディレクトリを確保
      const outputDir = path.resolve(
        `src/game/systems/level-patterns/${worldNum}`,
      );
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const inputPath = path.join(mapsDir, mapFile);
      const outputPath = path.join(outputDir, `${worldNum}-${levelNum}.ts`);

      console.log(`Processing ${mapFile} → ${outputPath}`);

      // generateLevelPattern.ts スクリプトを実行
      const command = `tsx scripts/tiled/generateLevelPattern.ts ${inputPath} > ${outputPath}`;
      execSync(command, { stdio: 'inherit' });
    } catch (error) {
      console.error(`Error processing map file ${mapFile}:`, error);
    }
  });

  console.log('All map files processed successfully!');
}

main();
