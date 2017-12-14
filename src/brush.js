/**
 * g2-brush
 * @type {Object}
 * @author sima.zhang1990@gmail.com
 */
const Util = require('./util');
const BRUSH_TYPES = [ 'X', 'Y', 'XY', 'POLYGON' ];

class Brush {
  constructor(cfg) {
    /**
     * keep the first mousedown point
     * @type {object}
     */
    this.startPoint = null;
    /**
     * keep the brush state
     * @type {Boolean}
     */
    this.brushing = false;
    /**
     * keep the drag state
     * @type {Boolean}
     */
    this.dragging = false;
    /**
     * the brush shape
     * @type {G.Shape}
     */
    this.brushShape = null;
    /**
     * the brush container
     * @type {G.Group}
     */
    this.container = null;
    /**
     * keep polygon path
     * @type {String}
     */
    this.polygonPath = null;
    /**
     * keep polygon points
     * @type {Array}
     */
    this.polygonPoints = null;
    /**
     * brush style
     * @type {Object}
     */
    this.style = {
      fill: '#CCD6EC',
      opacity: 0.3,
      lineWidth: 1,
      stroke: '#CCD6EC'
    };
    /**
     * brush type
     * @type {string}
     */
    this.type = 'XY';
    /**
     * is brushShape can be dragable, default is false
     * @type {Boolean}
     */
    this.dragable = false;
    this.dragoffX = 0;
    this.dragoffY = 0;
    /**
     * is limited in plot, default value is true
     * @type {Boolean}
     */
    this.inPlot = true;
    /**
     * xField
     * @type {string}
     */
    this.xField = null;
    /**
     * yFiels
     * @type {string}
     */
    this.yField = null;
    /**
     * Whether to filter the data，default is true
     * @type {Boolean}
     */
    this.filter = cfg.dragable ? false : true;
    this.onBrushstart = null;
    this.onBrushmove = null;
    this.onBrushend = null;
    this.onDragstart = null;
    this.onDragmove = null;
    this.onDragend = null;

    this._init(cfg);
  }

  _init(cfg) {
    Util.mix(this, cfg);
    this.type = this.type.toUpperCase();
    if (BRUSH_TYPES.indexOf(this.type) === -1) {
      this.type = 'XY';
    }
    const canvas = this.canvas;
    if (canvas) {
      let plotRange;
      canvas.get('children').map(child => {
        if (child.get('type') === 'plotBack') {
          plotRange = child.get('plotRange');
          return false;
        }
        return child;
      });
      this.plot = {
        start: plotRange.bl,
        end: plotRange.tr
      };

      this.bindCanvasEvent();
    }

    if (this.chart) { // 用户传入 chart
      const chart = this.chart;
      const coord = chart.get('coord');
      this.plot = {
        start: coord.start,
        end: coord.end
      };
      const xScales = chart._getScales('x');
      const yScales = chart._getScales('y');
      this.xScale = this.xField ? xScales[this.xField] : chart.getXScale();
      this.yScale = this.yField ? yScales[this.yField] : chart.getYScales()[0];
    }
  }

  clearEvents() {
    this.onMouseDownListener && this.onMouseDownListener.remove();
    this.onMouseMoveListener && this.onMouseMoveListener.remove();
    this.onMouseupListener && this.onMouseupListener.remove();
  }

  bindCanvasEvent() {
    const { canvas } = this;
    const canvasDOM = canvas.get('canvasDOM');
    this.clearEvents();
    this.onMouseDownListener = Util.addEventListener(canvasDOM, 'mousedown', Util.wrapBehavior(this, '_onCanvasMouseDown'));
    this.onMouseMoveListener = Util.addEventListener(canvasDOM, 'mousemove', Util.wrapBehavior(this, '_onCanvasMouseMove'));
    this.onMouseUpListener = Util.addEventListener(canvasDOM, 'mouseup', Util.wrapBehavior(this, '_onCanvasMouseUp'));
  }

  _onCanvasMouseDown(ev) {
    const me = this;
    const { canvas, type, chart, brushShape, polygonPoints } = me;
    const startPoint = { x: ev.offsetX, y: ev.offsetY }; // TODO
    const isInPlot = me.plot && me.inPlot;
    const canvasDOM = canvas.get('canvasDOM');

    if (me.selection) {
      me.selection = null;
    }

    if (me.dragable && brushShape && !brushShape.get('destroyed')) { // allow drag the brushShape
      let transPoint;
      if (chart) {
        const coord = chart.get('coord');
        transPoint = coord.applyMatrix(startPoint.x, startPoint.y, 1);
      } else {
        transPoint = [ startPoint.x, startPoint.y ];
      }
      if (Util.isInside([ transPoint[0], transPoint[1] ], polygonPoints)) {
        canvasDOM.style.cursor = 'move';
        me.selection = brushShape;
        me.dragging = true;
        if (type === 'X') {
          me.dragoffX = ev.offsetX - brushShape.attr('x');
          me.dragoffY = 0;
        } else if (type === 'Y') {
          me.dragoffX = 0;
          me.dragoffY = ev.offsetY - brushShape.attr('y');
        } else if (type === 'XY') {
          me.dragoffX = ev.offsetX - brushShape.attr('x');
          me.dragoffY = ev.offsetY - brushShape.attr('y');
        } else if (type === 'POLYGON') {
          const box = brushShape.getBBox();
          me.dragoffX = ev.offsetX - box.minX;
          me.dragoffY = ev.offsetY - box.minY;
        }

        if (isInPlot) {
          me.selection.attr('clip', canvas.addShape('rect', {
            attrs: {
              x: this.plot.start.x,
              y: this.plot.end.y,
              width: this.plot.end.x - this.plot.start.x,
              height: this.plot.start.y - this.plot.end.y,
              fill: '#fff',
              fillOpacity: 0
            }
          }));
        }
        me.onDragstart && me.onDragstart(ev);
      }
    }

    if (!me.dragging) { // brush start
      me.onBrushstart && me.onBrushstart(startPoint); // 用户自定义了 brush start 事件
      let container = me.container;
      if (isInPlot) {
        const { start, end } = me.plot;
        if (startPoint.x < start.x || startPoint.x > end.x || startPoint.y < end.y || startPoint.y > start.y) {
          return;
        }
      }
      canvasDOM.style.cursor = 'crosshair';
      me.startPoint = startPoint;
      me.polygonPoints = [];
      me.brushShape = null;
      me.brushing = true;

      if (!container) {
        container = canvas.addGroup({
          zIndex: 5 // upper
        });
        container.initTransform();
      } else {
        container.clear();
      }
      me.container = container;

      if (type === 'POLYGON') { // 不规则筛选
        me.polygonPath = `M ${startPoint.x} ${startPoint.y}`;
        me.polygonPoints.push([ startPoint.x, startPoint.y ]);
      }
    }
  }

  _onCanvasMouseMove(ev) {
    const me = this;
    const { brushing, dragging, type, plot, startPoint, xScale, yScale, canvas } = me;

    if (!brushing && !dragging) {
      return;
    }
    let currentPoint = {
      x: ev.offsetX,
      y: ev.offsetY
    }; // TODO
    let polygonPoints = me.polygonPoints;
    const canvasDOM = canvas.get('canvasDOM');

    if (brushing) {
      canvasDOM.style.cursor = 'crosshair';
      const { start, end } = plot;
      let polygonPath = me.polygonPath;
      let brushShape = me.brushShape;
      const container = me.container;
      if (me.plot && me.inPlot) {
        currentPoint = me._limitCoordScope(currentPoint);
      }

      let rectStartX;
      let rectStartY;
      let rectWidth;
      let rectHeight;

      if (type === 'Y') {
        rectStartX = start.x;
        rectStartY = (currentPoint.y >= startPoint.y) ? startPoint.y : currentPoint.y;
        rectWidth = Math.abs(start.x - end.x);
        rectHeight = Math.abs(startPoint.y - currentPoint.y);
      } else if (type === 'X') {
        rectStartX = (currentPoint.x >= startPoint.x) ? startPoint.x : currentPoint.x;
        rectStartY = end.y;
        rectWidth = Math.abs(startPoint.x - currentPoint.x);
        rectHeight = Math.abs(end.y - start.y);
      } else if (type === 'XY') {
        if (currentPoint.x >= startPoint.x) {
          rectStartX = startPoint.x;
          rectStartY = currentPoint.y >= startPoint.y ? startPoint.y : currentPoint.y;
        } else {
          rectStartX = currentPoint.x;
          rectStartY = currentPoint.y >= startPoint.y ? startPoint.y : currentPoint.y;
        }
        rectWidth = Math.abs(startPoint.x - currentPoint.x);
        rectHeight = Math.abs(startPoint.y - currentPoint.y);
      } else if (type === 'POLYGON') { // 不规则框选
        polygonPath += `L ${currentPoint.x} ${currentPoint.y}`;
        polygonPoints.push([ currentPoint.x, currentPoint.y ]);
        me.polygonPath = polygonPath;
        if (!brushShape) {
          brushShape = container.addShape('path', {
            attrs: Util.mix(me.style, {
              path: polygonPath
            })
          });
        } else {
          !brushShape.get('destroyed') && brushShape.attr(Util.mix({}, brushShape.__attrs, {
            path: polygonPath
          }));
        }
      }
      if (type !== 'POLYGON') {
        if (!brushShape) {
          brushShape = container.addShape('rect', {
            attrs: Util.mix(me.style, {
              x: rectStartX,
              y: rectStartY,
              width: rectWidth,
              height: rectHeight
            })
          });
        } else {
          !brushShape.get('destroyed') && brushShape.attr(Util.mix({}, brushShape.__attrs, {
            x: rectStartX,
            y: rectStartY,
            width: rectWidth,
            height: rectHeight
          }));
        }
        polygonPoints = (brushShape && !brushShape.get('destroyed')) ? [
          [ brushShape.attr('x'), brushShape.attr('y') ],
          [ brushShape.attr('x') + brushShape.attr('width'), brushShape.attr('y') ],
          [ brushShape.attr('x') + brushShape.attr('width'), brushShape.attr('y') + brushShape.attr('height') ],
          [ brushShape.attr('x'), brushShape.attr('y') + brushShape.attr('height') ],
          [ brushShape.attr('x'), brushShape.attr('y') ]
        ] : [];
      }

      me.brushShape = brushShape;
    } else if (dragging) {
      canvasDOM.style.cursor = 'move';
      const selection = me.selection;
      if (selection && !selection.get('destroyed')) {
        if (type === 'POLYGON') {
          me.selection.translate(currentPoint.x - me.dragoffX, currentPoint.y - me.dragoffY);
        } else {
          me.dragoffX && selection.attr('x', currentPoint.x - me.dragoffX);
          me.dragoffY && selection.attr('y', currentPoint.y - me.dragoffY);
        }

        polygonPoints = [
          [ selection.attr('x'), selection.attr('y') ],
          [ selection.attr('x') + selection.attr('width'), selection.attr('y') ],
          [ selection.attr('x') + selection.attr('width'), selection.attr('y') + selection.attr('height') ],
          [ selection.attr('x'), selection.attr('y') + selection.attr('height') ],
          [ selection.attr('x'), selection.attr('y') ]
        ];
      }
    }

    me.polygonPoints = polygonPoints;
    canvas.draw();
    const { data, shapes, xValues, yValues } = me._getSelected(polygonPoints);
    const eventObj = {
      data,
      shapes,
      x: currentPoint.x,
      y: currentPoint.y,
    };

    if (me.xScale) {
      eventObj[me.xScale.field] = xValues;
    }
    if (me.yScale) {
      eventObj[me.yScale.field] = yValues;
    }
    me.onDragmove && me.onDragmove(eventObj);
    me.onBrushmove && me.onBrushmove(eventObj);
  }

  _onCanvasMouseUp(ev) {
    const me = this;
    const { data, shapes, xValues, yValues, canvas, type, startPoint, chart, container, xScale, yScale, dragable } = me;
    const { offsetX, offsetY } = ev;
    const canvasDOM = canvas.get('canvasDOM');
    canvasDOM.style.cursor = 'default';

    if (Math.abs(startPoint.x - offsetX) <= 1 && Math.abs(startPoint.y - offsetY) <= 1) { // 防止点击事件
      me.brushing = false;
      me.dragging = false;
      return;
    }

    const eventObj = {
      data,
      shapes,
      x: offsetX,
      y: offsetY
    };
    if (xScale) {
      eventObj[xScale.field] = xValues;
    }
    if (yScale) {
      eventObj[yScale.field] = yValues;
    }

    if (me.dragging) {
      me.dragging = false;
      me.onDragend && me.onDragend(eventObj);
    } else if (me.brushing) {
      me.brushing = false;
      let currentPoint = {
        x: offsetX,
        y: offsetY
      };
      if (me.plot && me.inPlot) { // 是否限定在画布内
        currentPoint = me._limitCoordScope(currentPoint);
      }
      const brushShape = me.brushShape;
      let polygonPath = me.polygonPath;
      const polygonPoints = me.polygonPoints;

      if (type === 'POLYGON') {
        polygonPath += 'z';
        polygonPoints.push([ polygonPoints[0][0], polygonPoints[0][1] ]);

        brushShape && !brushShape.get('destroyed') && brushShape.attr(Util.mix({}, brushShape.__attrs, {
          path: polygonPath
        }));
        me.polygonPath = polygonPath;
        me.polygonPoints = polygonPoints;
        canvas.draw();
      }


      if (me.onBrushend) {
        me.onBrushend(eventObj);
      } else if (chart && me.filter) {
        container.clear(); // clear the brush
        // filter data
        if (type === 'X') {
          xScale && chart.filter(xScale.field, val => {
            return xValues.indexOf(val) > -1;
          });
        } else if (type === 'Y') {
          yScale && chart.filter(yScale.field, val => {
            return yValues.indexOf(val) > -1;
          });
        } else {
          xScale && chart.filter(xScale.field, val => {
            return xValues.indexOf(val) > -1;
          });
          yScale && chart.filter(yScale.field, val => {
            return yValues.indexOf(val) > -1;
          });
        }
        chart.repaint();
      }
    }
  }

  setMode(type) {
    if (!type) {
      return;
    }

    this.type = type.toUpperCase();
  }

  destroy() {
    this.clearEvents();
  }

  _limitCoordScope(point) {
    const { plot } = this;
    const { start, end } = plot;

    if (point.x < start.x) {
      point.x = start.x;
    }
    if (point.x > end.x) {
      point.x = end.x;
    }
    if (point.y < end.y) {
      point.y = end.y;
    }
    if (point.y > start.y) {
      point.y = start.y;
    }
    return point;
  }

  _getSelected(polygonPoints) {
    const { chart, xScale, yScale } = this;
    const selectedShapes = [];
    const xValues = [];
    const yValues = [];
    const selectedData = [];
    if (chart) {
      // const geoms = chart.getAllGeoms();
      const geoms = chart.get('geoms');
      geoms.map(geom => {
        const shapes = geom.getShapes();
        const coord = geom.get('coord');
        shapes.map(shape => {
          let shapeData = shape.get('origin');
          if (!Array.isArray(shapeData)) { // 线图、区域图等
            shapeData = [ shapeData ];
          }

          shapeData.map(each => {
            const transPoint = coord.applyMatrix(each.x, each.y, 1);
            if (Util.isInside([ transPoint[0], transPoint[1] ], polygonPoints)) {
              selectedShapes.push(shape);
              const origin = each._origin;
              selectedData.push(origin);
              xScale && xValues.push(origin[xScale.field]);
              yScale && yValues.push(origin[yScale.field]);
            }
            return each;
          });

          return shape;
        });
        return geom;
      });
    }
    this.shapes = selectedShapes;
    this.xValues = xValues;
    this.yValues = yValues;
    this.data = selectedData;
    return {
      data: selectedData,
      xValues,
      yValues,
      shapes: selectedShapes
    };
  }
}

module.exports = Brush;
