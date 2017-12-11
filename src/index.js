/**
 * [exports description]
 * @type {Object}
 */
const Util = require('./util');

class Brush {
  constructor(chart, type) {
    this.startPoint = null;
    this.isBrushing = false;
    this.brushShape = null;
    this.container = null;
    this.polygonPath = null;
    this.polygonPoints = null;

    this.type = type || 'XY';
    this.chart = chart;
    // TODO
    this.canvas = chart.get('canvas');
    this.plotRange = chart.get('plotRange');
    this.frontPlot = chart.get('frontPlot');

    this.bindEvent();
  }

  bindEvent() {
    const me = this;
    const { chart, frontPlot, type } = me;

    chart.on('mousedown', ev => {
      const { x, y } = ev;
      let container = me.container;
      me.startPoint = {
        x,
        y
      };
      me.isBrushing = true; // 开始框选
      if (!container) {
        container = frontPlot.addGroup();
        container.initTransform();
      } else {
        container.clear();
      }
      me.container = container;

      if (type === 'polygon') { // 不规则筛选
        me.polygonPoints = [];
        me.polygonPath = `M ${x} ${y}`;
        me.polygonPoints.push([ x, y ]);
      }
      // 这里抛出 brush start 事件

      // const originEvent = ev.event;
      // originEvent.stopPropagation();
      // originEvent.preventDefault();
      me._bindCanvasEvent();
    });
  }

  _bindCanvasEvent() {
    const {
      canvas
    } = this;
    const canvasDOM = canvas.get('canvasDOM');
    // canvasDOM.addEventListener('mousemove', Util.wrapBehavior(this, '_onCanvasMouseMove'), false);
    // canvasDOM.addEventListener('mouseup', Util.wrapBehavior(this, '_onCanvasMouseUp'), false);
    this.onMouseMoveListener = Util.addEventListener(canvasDOM, 'mousemove', Util.wrapBehavior(this, '_onCanvasMouseMove'));
    this.onMouseUpListener = Util.addEventListener(canvasDOM, 'mouseup', Util.wrapBehavior(this, '_onCanvasMouseUp'));
  }

  _limitCoordScope(point) {
    const { plotRange } = this;
    const { tl, br } = plotRange;

    if (point.x < tl.x) {
      point.x = tl.x;
    }
    if (point.x > br.x) {
      point.x = br.x;
    }
    if (point.y < tl.y) {
      point.y = tl.y;
    }
    if (point.y > br.y) {
      point.y = br.y;
    }
    return point;
  }

  _onCanvasMouseMove(ev) {
    const me = this;
    const { isBrushing, type, plotRange, startPoint } = me;
    if (!isBrushing) {
      return;
    }
    const canvas = me.canvas;
    const { tl, tr, bl } = plotRange;
    let polygonPath = me.polygonPath;
    const polygonPoints = me.polygonPoints;
    let brushShape = me.brushShape;
    const container = me.container;
    const pointX = ev.offsetX;
    const pointY = ev.offsetY;
    const currentPoint = me._limitCoordScope({
      x: pointX,
      y: pointY
    });
    let rectStartX;
    let rectStartY;
    let rectWidth;
    let rectHeight;

    if (type === 'Y') {
      rectStartX = tl.x;
      rectStartY = (currentPoint.y >= startPoint.y) ? startPoint.y : currentPoint.y;
      rectWidth = Math.abs(tl.x - tr.x);
      rectHeight = Math.abs(startPoint.y - currentPoint.y);
    } else if (type === 'X') {
      rectStartX = (currentPoint.x >= startPoint.x) ? startPoint.x : currentPoint.x;
      rectStartY = tl.y;
      rectWidth = Math.abs(startPoint.x - currentPoint.x);
      rectHeight = Math.abs(tl.y - bl.y);
    } else if (type === 'XY') {
      if (currentPoint.x >= startPoint.x) {
        rectStartX = startPoint.x;
        rectStartY = pointY >= startPoint.y ? startPoint.y : currentPoint.y;
      } else {
        rectStartX = currentPoint.x;
        rectStartY = currentPoint.y >= startPoint.y ? startPoint.y : currentPoint.y;
      }
      rectWidth = Math.abs(startPoint.x - currentPoint.x);
      rectHeight = Math.abs(startPoint.y - currentPoint.y);
    } else if (type === 'polygon') { // 不规则框选
      polygonPath += `L ${pointX} ${pointY}`;
      polygonPoints.push([ pointX, pointY ]);
      me.polygonPath = polygonPath;
      me.polygonPoints = polygonPoints;
      if (!brushShape) {
        brushShape = container.addShape('path', {
          attrs: {
            path: polygonPath,
            stroke: '#979797',
            lineWidth: 2,
            fill: '#D8D8D8',
            fillOpacity: 0.5,
            lineDash: [ 5, 5 ]
          }
        });
      } else {
        brushShape.attr(Util.mix({}, brushShape.__attrs, {
          path: polygonPath
        }));
      }
    }
    if (type !== 'polygon') {
      if (!brushShape) {
        brushShape = container.addShape('rect', {
          attrs: {
            x: rectStartX,
            y: rectStartY,
            width: rectWidth,
            height: rectHeight,
            fill: '#CCD7EB',
            opacity: 0.4
          }
        });
      } else {
        brushShape.attr(Util.mix({}, brushShape.__attrs, {
          x: rectStartX,
          y: rectStartY,
          width: rectWidth,
          height: rectHeight
        }));
      }
    }

    me.brushShape = brushShape;

    canvas.draw();

    ev.cancelBubble = true;
    ev.returnValue = false;
  }

  _onCanvasMouseUp() {
    const me = this;
    const { canvas, type } = me;
    const canvasDOM = canvas.get('canvasDOM');

    // canvasDOM.removeEventListener('mousemove', Util.getWrapBehavior(me, '_onCanvasMouseMove'), false);
    // canvasDOM.removeEventListener('mouseup', Util.getWrapBehavior(me, '_onCanvasMouseUp'), false);
    me.onMouseMoveListener.remove();
    me.onMouseUpListener.remove();
    // selectionPlot.clear(); // 一期先默认清楚
    me.isBrushing = false;
    // this.brushShape = null;
    const brushShape = me.brushShape;
    let polygonPath = me.polygonPath;
    const polygonPoints = me.polygonPoints;

    if (type === 'polygon') {
      polygonPath += 'z';
      polygonPoints.push([ polygonPoints[0][0], polygonPoints[0][1] ]);

      brushShape.attr(Util.mix({}, brushShape.__attrs, {
        path: polygonPath
      }));
      me.polygonPath = polygonPath;
      me.polygonPoints = polygonPoints;
    } else {
      me.brushShape = null;
    }

    // 抛出 brush end 事件
  }

  // setMode(type) {
  //   // TODO: 框选模式转变
  // }
}

module.exports = Brush;
