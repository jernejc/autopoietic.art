
import _ from 'lodash';
import Web3 from 'web3';

import { getTileForPointer } from '@actions/pixel';
import { formatColorNumber } from '@util/helpers';
import logger from '@util/logger';

// Fired when user moves pointer through the grid
export function handleMouseMove({ pointer, scene }) {
  //logger.log('User interactions: handleMove');

  switch (scene.game.mode) {
    case 'move':
      if (pointer.isDown) {
        panDragMap({ pointer, scene });
      } else
        scene.game.origDragPoint = null;
      break;
    case 'multiselect':
      const tile = getTileForPointer({ pointer, scene });

      if (scene.game.selection.isSelected(tile.cx, tile.cy))
        scene.input.setDefaultCursor('alias');
      else
        scene.input.setDefaultCursor('copy');

      if (pointer.isDown && scene.game.selection.rectangleSelection)
        scene.game.selection.resizeRectangleSelection({ pointer, scene });
      else
        positionSelectionBlock({ pointer, scene });
      break;
    case 'gameoflife':
    case 'select':
      positionSelectionBlock({ pointer, scene });
      break;
    case 'mininav':
      if (pointer.isDown)
        navigateMinimap({ pointer, scene: scene.minimap })
      break;
  }
}

export async function handleMouseDown({ pointer, scene }) {
  //logger.log('User interactions: handleMouseDown', scene.game.mode);

  let tile;

  switch (scene.game.mode) {
    case 'multiselect':
      if (pointer.button === 2) { // Detect right click
        //scene.game.selection.reset();
        return;
      }

      scene.game.selection.createRectangleSelection({ pointer, scene });
      break;
    case 'gameoflife':
      tile = getTileForPointer({ pointer, scene });
      tile.alive = true;

      // Enable some neighbors to make things more fun
      scene.tiles[tile.cy][tile.cx - 1].alive = true;
      scene.tiles[tile.cy][tile.cx + 1].alive = true;
      scene.tiles[tile.cy - 1][tile.cx].alive = true;
      scene.tiles[tile.cy + 1][tile.cx].alive = true;
      break;
    case 'select':
      tile = getTileForPointer({ pointer, scene });

      /*if (scene.game.selection.isSelected(tile.cx, tile.cy))
        scene.game.selection.removeSelected({ tile, scene });
      else*/
        await scene.game.selection.addSelected({ tiles: [tile], scene });
      break;
    case 'mininav':
      navigateMinimap({ pointer, scene: scene.minimap })
      break;
  }
}

export async function handleMouseUp({ pointer, scene }) {
  //logger.log('User interactions: handleMouseUp', pointer, scene);

  const selection = scene.game.selection;

  switch (scene.game.mode) {
    case 'multiselect':
      if (
        !selection.rectangleSelectionBeginPixel ||
        !selection.rectangleSelectionEndPixel ||
        (selection.rectangleSelectionBeginPixel.x === selection.rectangleSelectionEndPixel.x &&
          selection.rectangleSelectionBeginPixel.y === selection.rectangleSelectionEndPixel.y)) {

        selection.clearRectangleSelection();

        const tile = getTileForPointer({ pointer, scene });

        if (scene.gameOfLife) {
          tile.alive = !tile.alive;
          return;
        }

        if (scene.game.selection.isSelected(tile.cx, tile.cy))
          scene.game.selection.removeSelected({ tile, scene });
        else
          await scene.game.selection.addSelected({ tiles: [tile], scene });

        return;
      }

      const rectangleSelection = selection.rectangleSelection;

      if (!rectangleSelection)
        return;

      selection.selectRange({
        startPixel: selection.rectangleSelectionBeginPixel,
        endPixel: selection.rectangleSelectionEndPixel,
        scene
      });

      selection.clearRectangleSelection();
      break;
  }
}

export function handleMouseWheel({ scene, dx, dy, dz }) {
  //logger.log('User interactions: Mouse wheel event');

  const newSize = (dy < 0) ? scene.size + 1 : scene.size - 1;

  if (newSize > 15 && newSize < 35) { // min, max zoom needs to be moved to config
    scene.size = newSize;
    scene.gridWidth = scene.appConfig.canvasWidth / scene.size;
    scene.gridHeight = scene.appConfig.canvasHeight / scene.size;

    scene.clearVisibleTiles();
    scene.createVisibleTiles();
  }
}

export function handleShiftDown({ scene }) {
 // logger.log('User interactions: handleShiftDown');

  if (scene.game.mode === 'select')
    setGameMode({ scene, mode: 'multiselect' });

  scene.input.keyboard.off('keydown_SHIFT'); // Event repeats as longs as the button is pressed, we only want it to trigger once.
}

export function handleShiftUp({ scene }) {
  //logger.log('User interactions: handleShiftUp');

  if (scene.game.mode === 'multiselect')
    setGameMode({ scene, mode: 'select' });

  scene.input.keyboard.on('keydown_SHIFT', (event) => {
    handleShiftDown({ scene });
  });
}

export function handleSpaceDown({ scene }) {
  //logger.log('User interactions: handleSpaceDown');

  if (scene.game.mode === 'select')
    setGameMode({ scene, mode: 'move' });

  scene.input.keyboard.off('keydown_SPACE'); // Event repeats as longs as the button is pressed, we only want it to trigger once.
}

export function handleSpaceUp({ scene }) {
  //logger.log('User interactions: handleSpaceUp');

  if (scene.game.mode === 'move')
    setGameMode({ scene, mode: 'select' });

  scene.input.keyboard.on('keydown_SPACE', (event) => {
    handleSpaceDown({ scene });
  });
}

export async function creditToken({ scene, value }) {
  logger.log('Action: creditToken', value)

  if (!scene.game.web3.activeAddress)
    await scene.game.web3.getActiveAddress();

  if (!scene.game.web3.activeAddress)
    return false;

  try {
    await scene.game.web3.tokenContract.methods.credit().send({
      from: scene.game.web3.activeAddress,
      value: Web3.utils.toWei(value)
    });
  } catch (error) {
    logger.error('Action creditToken: ', error);
    return;
  }

  scene.game.web3.walletBalance += value;
}


export function navigateMinimap({ pointer, scene }) {
  //logger.log('User interactions: navigateMinimap', pointer, scene);

  const margin = scene.sceneConfig.margin * 2; // we have to use double margin due to black border
  const fieldWidth = scene.fieldWidth * scene.sceneConfig.sizeRatio;
  const fieldHeight = scene.fieldHeight * scene.sceneConfig.sizeRatio;

  // Relative X,Y to the minimap
  const x = pointer.position.x - margin;
  const y = pointer.position.y - (scene.appConfig.canvasHeight - (scene.sceneConfig.height + margin));

  // Actual X,Y based on the size ratio
  const cx = (x * scene.sceneConfig.sizeRatio) - (fieldWidth / 2);
  const cy = (y * scene.sceneConfig.sizeRatio) - (fieldHeight / 2);

  if (scene.game.selection.pixels.length > 0)
    scene.game.selection.reset();

  moveToPosition({ scene: scene.mainscene, x: cx, y: cy, save: true });
}

export function panDragMap({ pointer, scene }) {
  //logger.log('User interactions: panDragMap');

  if (scene.game.origDragPoint) {
    // move the camera by the amount the mouse has moved since last update
    const newX = scene.cameraX + (scene.game.origDragPoint.x - pointer.position.x);
    const newY = scene.cameraY + (scene.game.origDragPoint.y - pointer.position.y);

    moveToPosition({ scene, x: newX, y: newY, save: true });
  }

  // set new drag origin to current position
  scene.game.origDragPoint = pointer.position.clone();
}

export function moveToPosition({ scene, x, y, save }) {
  //logger.log('moveToPosition', x, y);

  scene.cameraX = x;
  scene.cameraY = y;

  const maxX = scene.pMax - scene.gridWidth;
  if (scene.cameraX === maxX || scene.cameraX > maxX)
    scene.cameraX = maxX;
  else if (scene.cameraX < 0)
    scene.cameraX = 0;

  const maxY = scene.pMax - scene.gridHeight;
  if (scene.cameraY === maxY || scene.cameraY > maxY)
    scene.cameraY = maxY;
  else if (scene.cameraY < 0)
    scene.cameraY = 0;

  scene.updateTiles();

  if (save)
    debounceSaveLastPosition(x, y); // Save last known position to localStorage
}

export function saveLastPosition(x, y) {
  //logger.log('saveLastPosition', x, y);

  try {
    localStorage.setItem('cx', x);
    localStorage.setItem('cy', y);
  } catch (error) {
    logger.error('Failed to save last known position', error);
  }
}

// Debounce save position -- https://stackoverflow.com/questions/23858046/debounce-function-with-args-underscore/23858092
// should be var for hoisting
var debounceSaveLastPosition = _.debounce(saveLastPosition, 300);

export function getLastPosition() {
  //logger.log('getLastPosition');

  let position = {
    x: 0,
    y: 0
  }

  try {
    const cx = localStorage.getItem('cx');
    const cy = localStorage.getItem('cy');

    if (cx)
      position.x = parseFloat(cx);

    if (cy)
      position.y = parseFloat(cy);
  } catch (error) {
    logger.error('Failed to get last known position', error);
  }

  return position;
}

// Set the Position of the Selection Block
export function positionSelectionBlock({ pointer, scene }) {
  //logger.log('User interactions: positionSelectionBlock');

  if (scene.game.selection.highlight)
    scene.game.selection.repositionHighlight({ pointer, scene });
  else
    scene.game.selection.highlightTile({ pointer, scene });
}

// Set scene mode
export function setGameMode({ scene, mode }) {
  //logger.log('User interactions: setGameMode', mode);

  switch (mode) {
    case 'move':
      scene.input.setDefaultCursor('grabbing');
      scene.game.mode = 'move';

      generalResetStrokeStyle({ scene, alpha: 0 });
      break;
    case 'select':
      scene.input.setDefaultCursor('default');
      scene.game.mode = 'select';

      generalResetStrokeStyle({ scene, selection: true });
      break;
    case 'multiselect':
      scene.input.setDefaultCursor('copy');
      scene.game.mode = 'multiselect';

      generalResetStrokeStyle({ scene, selection: true });
      break;
    case 'mininav':
      scene.input.setDefaultCursor('crosshair');
      scene.game.mode = 'mininav';
      break;
    case 'gameoflife':
      scene.input.setDefaultCursor('default');
      scene.game.mode = 'gameoflife';

      generalResetStrokeStyle({ scene, selection: true });
      break;
    default:
      throw new Error('Trying to set unknown game mode: ' + mode);
  }
  //scene.game.emitter.emit('scene/mode', mode);
}

export function generalResetStrokeStyle({ scene, size, selection, alpha }) {
  //logger.log('generalStrokeReset', scene, size, alpha);

  for (let y = 0; y < scene.gridHeight; y++) {
    for (let x = 0; x < scene.gridWidth; x++) {
      const tile = scene.tiles[y][x];

      if (tile) {
        if (selection && scene.game.selection.isSelected(tile.cx, tile.cy))
          setInvertedStroke({ scene, tile });
        else
          resetStrokeStyle({ tile, scene, size, alpha });
      }
    }
  }
}

export function resetStrokeStyle({ tile, scene, size, alpha }) {
  // Reset stroke around the tile
  size = size || scene.strokeSize;
  alpha = alpha || (0.4 / window.devicePixelRatio).toFixed(2)

  if (tile) {
    tile.setStrokeStyle(size, scene.strokeColor.color, alpha);
    tile.setDepth(0);
  }
}

export function setInvertedStroke({ tile, scene }) {
  //logger.log('User interactions: setInvertedStroke');

  const invertedColor = invertColor(tile.fillColor, true);

  tile.setStrokeStyle(scene.strokeSize + (1 * window.devicePixelRatio), invertedColor.color, 0.8);
  tile.setDepth(10);
}

export function invertColor(fillColor, bw) {
  //logger.log('User interactions: invertColor');

  const color = Phaser.Display.Color.HexStringToColor('#' + formatColorNumber(fillColor));
  let { r, g, b } = color;

  if (bw) {
    const rgbaAverage = (r + g + b) / 3;

    if (rgbaAverage < 186) { // Black and white is also inverted, this is a bit weird
      r = 0;
      g = 0;
      b = 0;
    } else {
      r = 255;
      g = 255;
      b = 255;
    }
  }

  return Phaser.Display.Color.RGBStringToColor(`rgb(${255 - r}, ${255 - g}, ${255 - b})`); // Given r,g,b is inverted with 255-
}
