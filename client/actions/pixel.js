import { toWei, stringToBN, stringToHex } from '@util/helpers';

export function getColorForXY({ x, y, color, scene }) {
  if (DEBUG) console.log('getColorForXY', x, y, color, scene);

  color = color || new Phaser.Display.Color();

  const { cx, cy } = getRelativePosition({ x, y, scene });
  scene.worldmap.getPixel(cx, cy, color);

  return { cx, cy, color };
}

export function getRelativePosition({ x, y, scene }) {
  const cx = parseInt(Phaser.Math.Wrap(scene.cameraX + x, 0, scene.imageWidth));
  const cy = parseInt(Phaser.Math.Wrap(scene.cameraY + y, 0, scene.imageHeight));

  return { cx, cy };
}

export function getRelativeTile({ cx, cy, scene }) {

  let rx, ry, tile;

  for (let y = 0; y < scene.gridHeight; y++) {
    for (let x = 0; x < scene.gridWidth; x++) {
      if (scene.tiles[y][x].cx === cx && scene.tiles[y][x].cy === cy) {
        tile = scene.tiles[y][x];
        rx = x;
        ry = y
      }
    }
  }

  return tile;
}

export function getTileForPointer({ pointer, scene }) {
  return getTileForXY({ x: pointer.x, y: pointer.y, scene })
}

export function getTileForXY({ x, y, scene }) {
  const xPixel = parseInt(x / scene.size);
  const yPixel = parseInt(y / scene.size);

  let tile;

  if (scene.tiles[yPixel])
    tile = scene.tiles[yPixel][xPixel];

  return tile;
}

export async function purchasePixels({ scene, selection }) {
  if (DEBUG) console.log('purchasePixels', selection, scene.game.web3.activeAddress)

  let fullPrice = 0, positions = []; //, gas = 20000; 

  if (!scene.game.web3.activeAddress)
    await scene.game.web3.getActiveAddress();

  if (!scene.game.web3.activeAddress)
    return false;

  selection.forEach(pixel => {
    //console.log('pushing position', stringToBN(pixel.position));
    positions.push(stringToBN(pixel.position));
    fullPrice += Number(pixel.price);
    //gas += 250000; // 10000 gas per pixel
    pixel.owner = scene.game.web3.activeAddress;
  })

  fullPrice = toWei(fullPrice.toString()); // web3.toWei needs strings or BN

  await scene.game.web3.bidContract.methods.purchase(
    positions // pixel position(s)
  ).send({
    from: scene.game.web3.activeAddress,
    //gas: gas,
    value: fullPrice
  });

  scene.game.emitter.emit('web3/purchase', selection);
}

export async function colorPixels({ scene, selection }) {
  if (DEBUG) console.log('colorPixels', selection)

  let positions = [], colors = [];

  selection.forEach(pixel => {
    positions.push(stringToBN(pixel.position));
    colors.push(stringToHex(pixel.HEXcolor));
  })

  if (!scene.game.web3.activeAddress)
    await scene.game.web3.getActiveAddress();

  if (!scene.game.web3.activeAddress)
    return false;

  try {
    await scene.game.web3.pixelContract.methods.setColors(
      positions,
      colors
    ).send({
      from: scene.game.web3.activeAddress
    });
  } catch (error) {
    console.error('setColors error', error)
  }

  // Set colors on the image
  updateWorldImagePixelColors({ pixels: selection, scene });
}

export function updateWorldImagePixelColors({ pixels, scene, updateTile }) {
  if (DEBUG) console.log('updateWorldImagePixelColors', pixels, scene);

  pixels.forEach(pixel => {
    scene.worldmap.setPixel(
      pixel.cx,
      pixel.cy,
      pixel.color.r,
      pixel.color.g,
      pixel.color.b
    )

    if (pixel.originalColor)
      pixel.originalColor = null;

    const tile = getRelativeTile({ cx: pixel.cx, cy: pixel.cy, scene });

    if (tile)
      tile.setFillStyle(pixel.color.color);
  });

  scene.worldmap.update();
}

/*resizePixel(x, y) {
  const oldSize = this.tiles[y][x].width;

  if (oldSize != getFullBoxWidth(this)) {
    this.tiles[y][x].width = getFullBoxWidth(this);
    this.tiles[y][x].height = getFullBoxWidth(this);

    this.tiles[y][x].x = x * getFullBoxWidth(this);
    this.tiles[y][x].y = y * getFullBoxWidth(this);

    this.tiles[y][x].setDepth(getFullBoxWidth(this));
  }

  return;

  function getFullBoxWidth(self) {
    return self.size + self.strokeSize;
  }
}*/