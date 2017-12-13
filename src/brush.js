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
     * keep the state
     * @type {Boolean}
     */
    this.isBrushing = false;
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
    this.onBrushstart = null;
    this.onBrushmove = null;
    this.onBrushend = null;

    this._init(cfg);
  }

  _init(cfg) {
    Util.mix(this, cfg);

    this.type = this.type.toUpperCase();
    if (BRUSH_TYPES.indexOf(this.type) === -1) {
      this.type = 'XY';
    }

    const chart = this.chart;
    if (chart) {
      const coord = chart.get('coord');

      this.canvas = chart.get('canvas');
      this.plot = {
        start: coord.start,
        end: coord.end
      }
      // this.plotRange = chart.get('plotRange');

      this.frontPlot = chart.get('frontPlot');
      const xScales = chart._getScales('x');
      const yScales = chart._getScales('y');
      this.xScale = this.xField ? xScales[this.xField] : chart.getXScale();
      this.yScale = this.yField ? yScales[this.yField] : chart.getYScales()[0];

      this._bindEvent();
    }
  }

  _bindEvent() {
    const me = this;
    const { chart, frontPlot, type, plot } = me;
    chart.on('mousedown', ev => {
      const { x, y } = ev;
      let container = me.container;
      if (me.inPlot) {
        const { start, end } = plot;
        if (x < start.x || x > end.x || y < end.y || y > start.y) {
          return;
        }
      }
      me.startPoint = {
        x,
        y
      };
      me.polygonPoints = [];
      me.isBrushing = true; // 开始框选
      if (!container) {
        container = frontPlot.addGroup();
        container.initTransform();
      } else {
        container.clear();
      }
      me.container = container;

      if (type === 'POLYGON') { // 不规则筛选
        me.polygonPath = `M ${x} ${y}`;
        me.polygonPoints.push([ x, y ]);
      }

      if (me.onBrushstart) {
        me.onBrushstart(ev); // 用户自定义了 brush start 事件
      }

      me._bindCanvasEvent();
    });
  }

  _bindCanvasEvent() {
    const { canvas } = this;
    const canvasDOM = canvas.get('canvasDOM');
    this.onMouseMoveListener = Util.addEventListener(canvasDOM, 'mousemove', Util.wrapBehavior(this, '_onCanvasMouseMove'));
    this.onMouseUpListener = Util.addEventListener(canvasDOM, 'mouseup', Util.wrapBehavior(this, '_onCanvasMouseUp'));
  }

  _onCanvasMouseMove(ev) {
    const me = this;
    const { isBrushing, type, plot, startPoint } = me;
    if (!isBrushing) {
      return;
    }
    const canvas = me.canvas;
    const { start, end } = plot;
    let polygonPath = me.polygonPath;
    const polygonPoints = me.polygonPoints;
    let brushShape = me.brushShape;
    const container = me.container;
    const { offsetX, offsetY } = ev;
    let currentPoint = {
      x: offsetX,
      y: offsetY
    };
    if (me.inPlot) {
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
        rectStartY = offsetY >= startPoint.y ? startPoint.y : currentPoint.y;
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
      me.polygonPoints = polygonPoints;
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
    }

    me.brushShape = brushShape;

    canvas.draw();
    ev.cancelBubble = true;
    ev.returnValue = false;

    if (me.onBrushmove) {
      me.onBrushmove({
        x: currentPoint.x,
        y: currentPoint.y,
        startX: rectStartX,
        startY: rectStartY,
        width: rectWidth,
        height: rectHeight
      });
    }
  }

  _onCanvasMouseUp(ev) {
    const me = this;
    const { canvas, type, startPoint, chart, container, xScale, yScale } = me;

    me.onMouseMoveListener.remove();
    me.onMouseUpListener.remove();
    me.isBrushing = false;

    const { offsetX, offsetY } = ev;
    if (Math.abs(startPoint.x - offsetX) <= 1 && Math.abs(startPoint.y - offsetY) <= 1) { // 防止点击事件
      return;
    }

    let currentPoint = {
      x: offsetX,
      y: offsetY
    };
    if (me.inPlot) { // 是否限定在画布内
      currentPoint = me._limitCoordScope(currentPoint);
    }
    const brushShape = me.brushShape;
    let polygonPath = me.polygonPath;
    let polygonPoints = me.polygonPoints;

    if (type === 'POLYGON') {
      polygonPath += 'z';
      polygonPoints.push([ polygonPoints[0][0], polygonPoints[0][1] ]);

      brushShape && !brushShape.get('destroyed') && brushShape.attr(Util.mix({}, brushShape.__attrs, {
        path: polygonPath
      }));
      me.polygonPath = polygonPath;
      me.polygonPoints = polygonPoints;
      canvas.draw();
    } else {
      // get selected shapes
      polygonPoints = (brushShape && !brushShape.get('destroyed')) ? [
        [ brushShape.attr('x'), brushShape.attr('y') ],
        [ brushShape.attr('x') + brushShape.attr('width'), brushShape.attr('y') ],
        [ brushShape.attr('x') + brushShape.attr('width'), brushShape.attr('y') + brushShape.attr('height') ],
        [ brushShape.attr('x'), brushShape.attr('y') + brushShape.attr('height') ],
        [ brushShape.attr('x'), brushShape.attr('y') ]
      ] : [];
    }
    const selectedShapes = [];
    const xValues = [];
    const yValues = [];
    const selectedData = [];
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
            xValues.push(origin[xScale.field]);
            yValues.push(origin[yScale.field]);
          }
          return each;
        });

        return shape;
      });
      return geom;
    });

    if (me.onBrushend) {
      me.onBrushend({
        data: selectedData,
        shapes: selectedShapes,
        [`${xScale.field}`]: xValues,
        [`${yScale.field}`]: xValues,
        x: currentPoint.x,
        y: currentPoint.y,
        container,
        canvas
      });
    } else {
      container.clear(); // clear the brush
      // filter data
      if (type === 'X') {
        chart.filter(xScale.field, val => {
          return xValues.indexOf(val) > -1;
        });
      } else if (type === 'Y') {
        chart.filter(yScale.field, val => {
          return yValues.indexOf(val) > -1;
        });
      } else {
        chart.filter(xScale.field, val => {
          return xValues.indexOf(val) > -1;
        });
        chart.filter(yScale.field, val => {
          return yValues.indexOf(val) > -1;
        });
      }
      chart.repaint();
    }

    me.brushShape = null;
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

  setMode(type) {
    if (!type) {
      return;
    }

    this.type = type.toUpperCase();
    // this.brushShape = null;
  }

/*  setChart(chart) {
    if (!chart) {
      return;
    }
    this._init({
      chart
    });
  }*/
}

module.exports = Brush;
