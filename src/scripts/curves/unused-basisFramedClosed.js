// Custom fork of d3.curveBasisClosed
// The idea is to not interpolate (curve) line along the frame
// points = [[0, 833],[0, 0],[1007, 0],[1007, 833]]
// d3.line().curve(d3.curveBasisClosed)(points) // => M 167.8,138.8 C 335.7,0,671.3,0,839.2,138.8 C1007,277.7,1007,555.3,839.2,694.2C671.3,833,335.7,833,167.8,694.2 C0,555.3,0,277.7,167.8,138.8
// d3.line().curve(d3.curveBasisFramedClosed)(points) // => M 0,833 L 0,0 L 1007,0 L 1007,833

const PRECISION = 2;
const round = number => Number(number.toFixed(PRECISION));

function noop() {}

function point(that, x, y) {
  that._context.bezierCurveTo(
    round((2 * that._x0 + that._x1) / 3),
    round((2 * that._y0 + that._y1) / 3),
    round((that._x0 + 2 * that._x1) / 3),
    round((that._y0 + 2 * that._y1) / 3),
    round((that._x0 + 4 * that._x1 + x) / 6),
    round((that._y0 + 4 * that._y1 + y) / 6)
  );
}

function isEdge(x, y) {
  return x <= 0 || y <= 0 || x >= graphWidth || y >= graphHeight;
}

function BasisFramedClosed(context) {
  this._context = context;
}

BasisFramedClosed.prototype = {
  areaStart: noop,
  areaEnd: noop,
  lineStart: function () {
    this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = NaN;
    this._point = 0;
  },
  lineEnd: function () {
    switch (this._point) {
      case 1: {
        this._context.moveTo(this._x2, this._y2);
        this._context.closePath();
        break;
      }
      case 2: {
        this._context.moveTo(round((this._x2 + 2 * this._x3) / 3), round((this._y2 + 2 * this._y3) / 3));
        this._context.lineTo(round((this._x3 + 2 * this._x2) / 3), round((this._y3 + 2 * this._y2) / 3));
        this._context.closePath();
        break;
      }
      case 3: {
        this.point(this._x2, this._y2);
        this.point(this._x3, this._y3);
        this.point(this._x4, this._y4);
        break;
      }
    }
  },
  point: function (x, y) {
    const edge = isEdge(x, y);
    if (x <= 0) x -= 20;
    if (y <= 0) y -= 20;
    if (x >= graphWidth) x += 20;
    if (y >= graphHeight) y += 20;

    switch (this._point) {
      case 0:
        this._point = 1;
        this._x2 = x;
        this._y2 = y;
        break;
      case 1:
        this._point = 2;
        this._x3 = x;
        this._y3 = y;
        break;
      case 2:
        this._point = 3;
        this._x4 = x;
        this._y4 = y;

        if (edge) {
          this._context.moveTo(round((this._x1 + x) / 2), round((this._y1 + y) / 2));
          break;
        }

        this._context.moveTo(round((this._x0 + 4 * this._x1 + x) / 6), round((this._y0 + 4 * this._y1 + y) / 6));
        break;
      default:
        if (edge) {
          this._context.lineTo(x, y);
          break;
        }

        point(this, x, y);
        break;
    }
    this._x0 = this._x1;
    this._x1 = x;
    this._y0 = this._y1;
    this._y1 = y;
  }
};

export function curveBasisFramedClosed(context) {
  return new BasisFramedClosed(context);
}
