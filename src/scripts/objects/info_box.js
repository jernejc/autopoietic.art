
import ColorPicker from './color/color_picker';
import ColorInput from './color/color_input';

/**
 * InfoBox Class
 */

export default class InfoBox {

  constructor({ pixel, parent, scene }) {
    //console.log('InfoBox pixel', pixel, parent)
    this.scene = scene;
    this.setupTemplate(pixel, parent);
    this.setPosition(pixel, parent);
  }

  setPosition(pixel, parent) {
    //console.log('setPosition', pixel, parent.offsetWidth, pixel.tile.x, this.wrapper.offsetWidth, pixel.tile.displayWidth)

    const padding = 2;
    const vertical = (pixel.tile.y > (parent.offsetHeight / 2)) ? 'down' : 'up'
    const horizontal = (pixel.tile.x > (parent.offsetWidth / 2)) ? 'left' : 'right'
    const animationClass = (vertical === 'up') ? 'fadeInUp' : 'fadeInDown'
    const top = (vertical === 'down') ? pixel.tile.y - this.wrapper.offsetHeight - padding : pixel.tile.y + pixel.tile.displayHeight + padding
    const left = (horizontal === 'left') ? pixel.tile.x - this.wrapper.offsetWidth - padding : pixel.tile.x + pixel.tile.displayWidth + padding

    Object.assign(this.wrapper.style, { top: top + 'px', left: left + 'px' });
    this.wrapper.classList.add('animated', animationClass);
  }

  setupTemplate(pixel, parent) {
    console.log('Setup template', pixel, parent);

    this.wrapper = document.createElement('div');
    this.wrapper.classList.add('info-box');

    this.position = document.createElement('div')
    this.position.classList.add('position');
    this.position.innerHTML = `${pixel.tile.cx} x ${pixel.tile.cy}`

    this.wrapper.appendChild(this.position)

    // Hex Input
    this.wrapper.appendChild(new ColorInput(pixel, 'color.color.color', {
      min: 0,
      max: 255,
      step: 2,
      label: 'hex',
      width: '100%',
      scene: this.scene,
      format: (value) => '#' + value.toString(16)
    }))

    // RGB Inputs
    this.wrapper.appendChild(new ColorInput(pixel, 'color.color.red', {
      min: 0,
      max: 255,
      step: 2,
      label: 'r',
      width: '33%',
      scene: this.scene
    }))
    this.wrapper.appendChild(new ColorInput(pixel, 'color.color.green', { 
      min: 0, 
      max: 255, 
      step: 2, 
      label: 'g', 
      width: '33%', 
      scene: this.scene 
    }))
    this.wrapper.appendChild(new ColorInput(pixel, 'color.color.blue', { 
      min: 0, 
      max: 255, 
      step: 2, 
      label: 'b', 
      width: '33%', 
      scene: this.scene 
    }))

    // Hue slider
    this.wrapper.appendChild(new ColorPicker(pixel, 'color.color.h', { min: 0, max: 1, step: 0.001, scene: this.scene }))

    try {
      parent.appendChild(this.wrapper);
    } catch (e) {
      return e;
    }
  }
}