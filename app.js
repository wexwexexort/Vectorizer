function Vectorizer() {
  var that = this;
  let k;

  this.makeVector = function(url, cb, options) {
    options = options || {};
    that.handleOptions(options);
    // loading image, tracing and cb
    that.imgLoader(url,
      function(canvas) {
        cb(that.makeSvgString(that.getImgdata(canvas), options));
      }
    );
  }

  // svg string
  this.makeSvgString = function(imgd, options) {
      options = options || {};
      that.handleOptions(options);
      // tracing imagedata
      var td = that.imgDataToTraceVal(imgd, options);
      // returning SVG string
      return that.getsvgstring(
        imgd.width * options.scale, imgd.height * options.scale,
        td, options);

    } // End 

  //getTracedata and initiate a callback with it as arg
  this.makeTraceValues = function(url, cb, options) {
      options = options || {};
      that.handleOptions(options);
      // loading image, tracing and cb
      that.imgLoader(url,
        function(canvas) {
          cb(
            that.imgDataToTraceVal(that.getImgdata(canvas), options)
          );
        }
      );
    } // End of makeTraceValues()

  // Tracing imagedata, then returning tracedata 
  this.imgDataToTraceVal = function(imgd, options) {
      options = options || {};
      that.handleOptions(options);

      var ii = that.colorquantization(imgd, options.pal, options.numberofcolors, options.mincolorratio, options.colorquantcycles);

      var ls = that.layering(ii);

      if (options.layercontainerid) {
        that.createCanvasLayers(ls, that.customPalette, options.scale, options.layercontainerid);
      }

      var bps = that.pathScanLayers(ls, options.pathLengthThreshold);
      var bis = that.internodeAllLayers(bps);

      return {
        'layers': that.traceAllLayers(bis, options.lowerLinearThreshold, options.quadraticSplineThreshold),
        'palette': ii.palette,
        'background': ii.background
      };

    }, // End of imgDataToTraceVal()

    //User Specified Options handler
    this.handleOptions = function(options) {
      options = options || {};

      //recommended lower linear and quadratic splines error thresholds
      //not to be changed unless you know what youre doing
      //lower 'lower linear'is said to be better when dealing with curves

      options.lowerLinearThreshold = options.lowerLinearThreshold || 1;
      options.quadraticSplineThreshold = options.quadraticSplineThreshold || 1;
      options.pathLengthThreshold = options.pathLengthThreshold || 8;

      // Color quantization
      options.numberofcolors = options.numberofcolors || 16;
      options.mincolorratio = options.mincolorratio || 0.02;
      options.colorquantcycles = options.colorquantcycles || 3;
      options.scale = 2;

      //ctrl pts. let them be 0
      options.lcpr = options.lcpr || 0;
      options.qcpr = options.qcpr || 0;


    } // End of handleOptions()

  //  Vectorizing functions
  // k-means clustering 
  this.colorquantization = function(imgd, pal, numberofcolors, minratio, cycles) {
      var arr = [],
        idx = 0,
        cd, cdl, ci, c1, c2, c3, paletteacc = [],
        pixelnum = imgd.width * imgd.height;
      cycles = cycles || 3;
      minratio = minratio || 0.2;
      numberofcolors = numberofcolors || 16;

      for (var j = 0; j < imgd.height + 2; j++) {
        arr[j] = [];
        for (var i = 0; i < imgd.width + 2; i++) {
          arr[j][i] = -1;
        }
      }

      // Use custom palette if pal is defined or generate custom length palette
      var palette = pal || that.generatepalette(numberofcolors);

      // Repeat clustering step 'cycles' times
      for (var cnt = 0; cnt < cycles; cnt++) {

        // Average colors from the second iteration
        if (cnt > 0) {
          // averaging paletteacc for palette
          for (var k = 0; k < palette.length; k++) {
            // averaging
            if (paletteacc[k].n > 0) {
              palette[k].r = Math.floor(paletteacc[k].r / paletteacc[k].n);
              palette[k].g = Math.floor(paletteacc[k].g / paletteacc[k].n);
              palette[k].b = Math.floor(paletteacc[k].b / paletteacc[k].n);
            }

            //too few colors 
            if ((paletteacc[k].n / pixelnum < minratio) && (cnt < cycles - 1)) {
              palette[k].r = Math.floor(Math.random() * 255);
              palette[k].g = Math.floor(Math.random() * 255);
              palette[k].b = Math.floor(Math.random() * 255);
            }

          } // End of palette loop
        } // End of Average colors from the second iteration

        // Reseting palette accumulator for averaging
        for (var i = 0; i < palette.length; i++) {
          paletteacc[i] = {};
          paletteacc[i].r = 0;
          paletteacc[i].g = 0;
          paletteacc[i].b = 0;
          paletteacc[i].n = 0;
        }

        // loop through all pixels
        for (var j = 0; j < imgd.height; j++) {
          for (var i = 0; i < imgd.width; i++) {

            idx = (j * imgd.width + i) * 4;

            cdl = 256 + 256 + 256;
            ci = 0;
            for (var k = 0; k < palette.length; k++) {

              c1 = Math.abs(palette[k].r - imgd.data[idx]);
              c2 = Math.abs(palette[k].g - imgd.data[idx + 1]);
              c3 = Math.abs(palette[k].b - imgd.data[idx + 2]);
              cd = c1 + c2 + c3;
              if (cd < cdl) {
                //rectilinear distance and closest index save
                cdl = cd;
                ci = k;
              }
            } // End of palette loop

            // add to palettacc
            paletteacc[ci].r += imgd.data[idx];
            paletteacc[ci].g += imgd.data[idx + 1];
            paletteacc[ci].b += imgd.data[idx + 2];
            paletteacc[ci].n++;

            arr[j + 1][i + 1] = ci;
          } // End of i loop
        } // End of j loop

      }

      return {
        'array': arr,
        'palette': palette,
        'background': arr[1][1]
      };
    }, // End of colorquantization()

    // Generating a palette with numberofcolors
    this.generatepalette = function(numberofcolors) {
      var palette = [];
      if (numberofcolors < 8) {

        // Grayscale
        var graystep = Math.floor(255 / (numberofcolors - 1));
        for (var ccnt = 0; ccnt < numberofcolors; ccnt++) {
          palette.push({
            'r': ccnt * graystep,
            'g': ccnt * graystep,
            'b': ccnt * graystep,
            'a': 255
          });
        }

      } else {

        // RGB color cube
        var colorqnum = Math.floor(Math.pow(numberofcolors, 1 / 3)), // Number of points on each edge on the RGB color cube
          colorstep = Math.floor(255 / (colorqnum - 1)), // distance between points
          rndnum = numberofcolors - colorqnum * colorqnum * colorqnum; // number of random colors
        for (var rcnt = 0; rcnt < colorqnum; rcnt++) {
          for (var gcnt = 0; gcnt < colorqnum; gcnt++) {
            for (var bcnt = 0; bcnt < colorqnum; bcnt++) {
              var newr = rcnt * colorstep,
                newg = gcnt * colorstep,
                newb = bcnt * colorstep,
                newcolor = {
                  'r': newr,
                  'g': newg,
                  'b': newb,
                  'a': 255
                };
              palette.push(newcolor);
            } // End of blue loop
          } // End of green loop
        } // End of red loop

        // Rest is random
        for (var rcnt = 0; rcnt < rndnum; rcnt++) {
          palette.push({
            'r': Math.floor(Math.random() * 255),
            'g': Math.floor(Math.random() * 255),
            'b': Math.floor(Math.random() * 255),
            'a': 255
          });
        }

      } // End of numberofcolors check

      return palette;
    }, // End of generatepalette()

    // 15 edge node types 
    // 12  ░░  ▓░  ░▓  ▓▓  ░░  ▓░  ░▓  ▓▓  ░░  ▓░  ░▓  ▓▓  ░░  ▓░  ░▓  ▓▓
    // 48  ░░  ░░  ░░  ░░  ░▓  ░▓  ░▓  ░▓  ▓░  ▓░  ▓░  ▓░  ▓▓  ▓▓  ▓▓  ▓▓
    //     0   1   2   3   4   5   6   7   8   9   10  11  12  13  14  15
    //
    this.layering = function(ii) {
      // Creating layers for each indexed color in arr
      var layers = [],
        val = 0,
        ah = ii.array.length,
        aw = ii.array[0].length,
        n1, n2, n3, n4, n5, n6, n7, n8;

      // Create new layer if there's no one with this indexed color
      for (var k = 0; k < ii.palette.length; k++) {
        layers[k] = [];
        for (var j = 0; j < ah; j++) {
          layers[k][j] = [];
          for (var i = 0; i < aw; i++) {
            layers[k][j][i] = 0;
          }
        }
      }

      // Looping through all pixels and calculating edge node type
      for (var j = 1; j < ah - 1; j++) {
        for (var i = 1; i < aw - 1; i++) {

          // This pixel's indexed color
          val = ii.array[j][i];

          // neighbor pixel 
          if ((j > 0) && (i > 0)) {
            n1 = ii.array[j - 1][i - 1] === val ? 1 : 0;
          } else {
            n1 = 0;
          }
          if (j > 0) {
            n2 = ii.array[j - 1][i] === val ? 1 : 0;
          } else {
            n2 = 0;
          }
          if ((j > 0) && (i < aw - 1)) {
            n3 = ii.array[j - 1][i + 1] === val ? 1 : 0;
          } else {
            n3 = 0;
          }
          if (i > 0) {
            n4 = ii.array[j][i - 1] === val ? 1 : 0;
          } else {
            n4 = 0;
          }
          if (i < aw - 1) {
            n5 = ii.array[j][i + 1] === val ? 1 : 0;
          } else {
            n5 = 0;
          }
          if ((j < ah - 1) && (i > 0)) {
            n6 = ii.array[j + 1][i - 1] === val ? 1 : 0;
          } else {
            n6 = 0;
          }
          if (j < ah - 1) {
            n7 = ii.array[j + 1][i] === val ? 1 : 0;
          } else {
            n7 = 0;
          }
          if ((j < ah - 1) && (i < aw - 1)) {
            n8 = ii.array[j + 1][i + 1] === val ? 1 : 0;
          } else {
            n8 = 0;
          }

          // this pixel's type and looking back on previous pixels
          layers[val][j + 1][i + 1] = 1 + n5 * 2 + n8 * 4 + n7 * 8;
          if (!n4) {
            layers[val][j + 1][i] = 0 + 2 + n7 * 4 + n6 * 8;
          }
          if (!n2) {
            layers[val][j][i + 1] = 0 + n3 * 2 + n5 * 4 + 8;
          }
          if (!n1) {
            layers[val][j][i] = 0 + n2 * 2 + 4 + n4 * 8;
          }

        } // End of i loop
      } // End of j loop

      return layers;
    } // End of layering()



  //  credits to whoever came up with this ingenius way of doing it
  this.scanPaths = function(arr, pathLengthThreshold) {
      pathLengthThreshold = pathLengthThreshold || 8;
      var paths = [],
        pacnt = 0,
        pcnt = 0,
        px = 0,
        py = 0,
        w = arr[0].length,
        h = arr.length,
        dir = 0,
        pathfinished = true,
        holepath = false,
        stepcnt = 0,
        maxsteps = w * h * 2;

      for (var j = 0; j < h; j++) {
        for (var i = 0; i < w; i++) {
          if ((arr[j][i] === 0) || (arr[j][i] === 15)) { // Discard
            stepcnt++;
          } else { // Follow path

            // Init
            px = i;
            py = j;
            paths[pacnt] = [];
            pathfinished = false;
            pcnt = 0;
            // fill paths will be drawn, but hole paths are also required to remove unnecessary edge nodes
            if (arr[py][px] === 1) {
              dir = 0;
            }
            if (arr[py][px] === 2) {
              dir = 3;
            }
            if (arr[py][px] === 3) {
              dir = 0;
            }
            if (arr[py][px] === 4) {
              dir = 1;
              holepath = false;
            }
            if (arr[py][px] === 5) {
              dir = 0;
            }
            if (arr[py][px] === 6) {
              dir = 3;
            }
            if (arr[py][px] === 7) {
              dir = 0;
              holepath = true;
            }
            if (arr[py][px] === 8) {
              dir = 0;
            }
            if (arr[py][px] === 9) {
              dir = 3;
            }
            if (arr[py][px] === 10) {
              dir = 3;
            }
            if (arr[py][px] === 11) {
              dir = 1;
              holepath = true;
            }
            if (arr[py][px] === 12) {
              dir = 0;
            }
            if (arr[py][px] === 13) {
              dir = 3;
              holepath = true;
            }
            if (arr[py][px] === 14) {
              dir = 0;
              holepath = true;
            }
            // Path points loop
            while (!pathfinished) {
              // New path point
              paths[pacnt][pcnt] = {};
              paths[pacnt][pcnt].x = px - 1;
              paths[pacnt][pcnt].y = py - 1;
              paths[pacnt][pcnt].t = arr[py][px];

              // Node types
              if (arr[py][px] === 1) {
                arr[py][px] = 0;
                if (dir === 0) {
                  py--;
                  dir = 1;
                } else if (dir === 3) {
                  px--;
                  dir = 2;
                } else {
                  pathfinished = true;
                  paths.pop();
                }
              } else if (arr[py][px] === 2) {
                arr[py][px] = 0;
                if (dir === 3) {
                  px++;
                  dir = 0;
                } else if (dir === 2) {
                  py--;
                  dir = 1;
                } else {
                  pathfinished = true;
                  paths.pop();
                }
              } else if (arr[py][px] === 3) {
                arr[py][px] = 0;
                if (dir === 0) {
                  px++;
                } else if (dir === 2) {
                  px--;
                } else {
                  pathfinished = true;
                  paths.pop();
                }
              } else if (arr[py][px] === 4) {
                arr[py][px] = 0;
                if (dir === 1) {
                  px++;
                  dir = 0;
                } else if (dir === 2) {
                  py++;
                  dir = 3;
                } else {
                  pathfinished = true;
                  paths.pop();
                }
              } else if (arr[py][px] === 5) {
                if (dir === 0) {
                  arr[py][px] = 13;
                  py++;
                  dir = 3;
                } else if (dir === 1) {
                  arr[py][px] = 13;
                  px--;
                  dir = 2;
                } else if (dir === 2) {
                  arr[py][px] = 7;
                  py--;
                  dir = 1;
                } else if (dir === 3) {
                  arr[py][px] = 7;
                  px++;
                  dir = 0;
                }
              } else if (arr[py][px] === 6) {
                arr[py][px] = 0;
                if (dir === 1) {
                  py--;
                } else if (dir === 3) {
                  py++;
                } else {
                  pathfinished = true;
                  paths.pop();
                }
              } else if (arr[py][px] === 7) {
                arr[py][px] = 0;
                if (dir === 0) {
                  py++;
                  dir = 3;
                } else if (dir === 1) {
                  px--;
                  dir = 2;
                } else {
                  pathfinished = true;
                  paths.pop();
                }
              } else if (arr[py][px] === 8) {
                arr[py][px] = 0;
                if (dir === 0) {
                  py++;
                  dir = 3;
                } else if (dir === 1) {
                  px--;
                  dir = 2;
                } else {
                  pathfinished = true;
                  paths.pop();
                }
              } else if (arr[py][px] === 9) {
                arr[py][px] = 0;
                if (dir === 1) {
                  py--;
                } else if (dir === 3) {
                  py++;
                } else {
                  pathfinished = true;
                  paths.pop();
                }
              } else if (arr[py][px] === 10) {
                if (dir === 0) {
                  arr[py][px] = 11;
                  py--;
                  dir = 1;
                } else if (dir === 1) {
                  arr[py][px] = 14;
                  px++;
                  dir = 0;
                } else if (dir === 2) {
                  arr[py][px] = 14;
                  py++;
                  dir = 3;
                } else if (dir === 3) {
                  arr[py][px] = 11;
                  px--;
                  dir = 2;
                }
              } else if (arr[py][px] === 11) {
                arr[py][px] = 0;
                if (dir === 1) {
                  px++;
                  dir = 0;
                } else if (dir === 2) {
                  py++;
                  dir = 3;
                } else {
                  pathfinished = true;
                  paths.pop();
                }
              } else if (arr[py][px] === 12) {
                arr[py][px] = 0;
                if (dir === 0) {
                  px++;
                } else if (dir === 2) {
                  px--;
                } else {
                  pathfinished = true;
                  paths.pop();
                }
              } else if (arr[py][px] === 13) {
                arr[py][px] = 0;
                if (dir === 2) {
                  py--;
                  dir = 1;
                } else if (dir === 3) {
                  px++;
                  dir = 0;
                } else {
                  pathfinished = true;
                  paths.pop();
                }
              } else if (arr[py][px] === 14) {
                arr[py][px] = 0;
                if (dir === 0) {
                  py--;
                  dir = 1;
                } else if (dir === 3) {
                  px--;
                  dir = 2;
                } else {
                  pathfinished = true;
                  paths.pop();
                }
              }

              // Close path
              if ((px - 1 === paths[pacnt][0].x) && (py - 1 === paths[pacnt][0].y)) {
                pathfinished = true;
                // Discarding 'hole' type paths and paths shorter than pathLengthThreshold
                if (holepath || (paths[pacnt].length < pathLengthThreshold)) {
                  paths.pop();
                } else {
                  pacnt++;
                }
              }

              // Error: path going out of image
              if ((px < 0) || (px >= w) || (py < 0) || (py >= h)) {
                pathfinished = true;
                console.log('path ' + pacnt + ' error w ' + w + ' h ' + h + ' px ' + px + ' py ' + py);
                paths.pop();
              }

              // Error: stepcnt>maxsteps
              if (stepcnt > maxsteps) {
                pathfinished = true;
                console.log('path ' + pacnt + ' error stepcnt ' + stepcnt + ' maxsteps ' + maxsteps + ' px ' + px + ' py ' + py);
                paths.pop();
              }

              stepcnt++;
              pcnt++;

            } // Path points 

          } // Follow path

        }
      } // End of j loop

      return paths;
    } // scanPaths()

  //patchscan all layers
  this.pathScanLayers = function(layers, pathLengthThreshold) {
    pathLengthThreshold = pathLengthThreshold || 8;
    var bpaths = [];
    for (k in layers) {
      if (!layers.hasOwnProperty(k)) {
        continue;
      }
      bpaths[k] = that.scanPaths(layers[k], pathLengthThreshold);
    }
    return bpaths;
  }

  //interpolate
  this.internodes = function(paths) {
      var ins = [],
        palen = 0,
        nextidx = 0,
        nextidx2 = 0,
        nx = 0,
        ny = 0;
      // paths loop
      for (var pacnt = 0; pacnt < paths.length; pacnt++) {
        ins[pacnt] = [];
        palen = paths[pacnt].length;
        // pathpoints loop
        for (var pcnt = 0; pcnt < palen; pcnt++) {

          // interpolate between two path points
          nextidx = (pcnt + 1) % palen;
          nextidx2 = (pcnt + 2) % palen;
          ins[pacnt][pcnt] = {};
          ins[pacnt][pcnt].x = (paths[pacnt][pcnt].x + paths[pacnt][nextidx].x) / 2;
          ins[pacnt][pcnt].y = (paths[pacnt][pcnt].y + paths[pacnt][nextidx].y) / 2;
          nx = (paths[pacnt][nextidx].x + paths[pacnt][nextidx2].x) / 2;
          ny = (paths[pacnt][nextidx].y + paths[pacnt][nextidx2].y) / 2;

          // line segment direction to the next point
          if (ins[pacnt][pcnt].x < nx) {
            if (ins[pacnt][pcnt].y < ny) {
              ins[pacnt][pcnt].linesegment = 1;
            } // SouthEast
            else if (ins[pacnt][pcnt].y > ny) {
              ins[pacnt][pcnt].linesegment = 7;
            } // NE
            else {
              ins[pacnt][pcnt].linesegment = 0;
            } // E
          } else if (ins[pacnt][pcnt].x > nx) {
            if (ins[pacnt][pcnt].y < ny) {
              ins[pacnt][pcnt].linesegment = 3;
            } // SW
            else if (ins[pacnt][pcnt].y > ny) {
              ins[pacnt][pcnt].linesegment = 5;
            } // NW
            else {
              ins[pacnt][pcnt].linesegment = 4;
            } // N
          } else {
            if (ins[pacnt][pcnt].y < ny) {
              ins[pacnt][pcnt].linesegment = 2;
            } // S
            else if (ins[pacnt][pcnt].y > ny) {
              ins[pacnt][pcnt].linesegment = 6;
            } // N
            else {
              ins[pacnt][pcnt].linesegment = 8;
            } // center, this should not happen
          }

        } // End of pathpoints loop 

      } // End of paths loop

      return ins;
    } // End of internodes()

  // Batch interpollation
  this.internodeAllLayers = function(bpaths) {
      var binternodes = [];
      for (k in bpaths) {
        if (!bpaths.hasOwnProperty(k)) {
          continue;
        }
        binternodes[k] = that.internodes(bpaths[k]);
      }
      return binternodes;
    },

    //  getPath() : trying to fit straight and quadratic spline segments on the 8 direction internode path
    //  Fit a straight line on the sequence
    //  if line has an error greater than linearThreshold find the point that shows highest error
    //fit quadratic spline through err point and project it to get control point .. proceed to get errors on each point on the sequence
    //Now, if spline fails the quadratic spline threshold - Do as above and find biggest error value point and calculate splitpoint to be the avg of a fitting point and the error point
    //recursively do this by splitting sequences
    this.getPath = function(path, ltreshold, qtreshold) {
      var pcnt = 0,
        segtype1, segtype2, seqend, smp = [];
      while (pcnt < path.length) {
        // 5.1. Find sequences of points with only 2 segment types
        segtype1 = path[pcnt].linesegment;
        segtype2 = -1;
        seqend = pcnt + 1;
        while (
          ((path[seqend].linesegment === segtype1) || (path[seqend].linesegment === segtype2) || (segtype2 === -1)) &&
          (seqend < path.length - 1)) {
          if ((path[seqend].linesegment !== segtype1) && (segtype2 === -1)) {
            segtype2 = path[seqend].linesegment;
          }
          seqend++;
        }
        if (seqend === path.length - 1) {
          seqend = 0;
        }

        smp = smp.concat(that.fitseq(path, ltreshold, qtreshold, pcnt, seqend));
        // 5.7. TODO? If splitpoint-endpoint is a spline, try to add new points from the next sequence


        if (seqend > 0) {
          pcnt = seqend;
        } else {
          pcnt = path.length;
        }

      }

      return smp;
    }, // End of getPath()

    // called from getPath()
    this.fitseq = function(path, ltreshold, qtreshold, seqstart, seqend) {
      // return if invalid seqend
      if ((seqend > path.length) || (seqend < 0)) {
        return [];
      }
      // variables
      var errorpoint = seqstart,
        errorval = 0,
        curvepass = true,
        px, py, dist2;
      var tl = (seqend - seqstart);
      if (tl < 0) {
        tl += path.length;
      }
      var vx = (path[seqend].x - path[seqstart].x) / tl,
        vy = (path[seqend].y - path[seqstart].y) / tl;

      // 5.2. Fit a straight line on the sequence
      var pcnt = (seqstart + 1) % path.length,
        pl;
      while (pcnt != seqend) {
        pl = pcnt - seqstart;
        if (pl < 0) {
          pl += path.length;
        }
        px = path[seqstart].x + vx * pl;
        py = path[seqstart].y + vy * pl;
        dist2 = (path[pcnt].x - px) * (path[pcnt].x - px) + (path[pcnt].y - py) * (path[pcnt].y - py);
        if (dist2 > ltreshold) {
          curvepass = false;
        }
        if (dist2 > errorval) {
          errorpoint = pcnt;
          errorval = dist2;
        }
        pcnt = (pcnt + 1) % path.length;
      }
      // return straight line if fits
      if (curvepass) {
        return [{
          'type': 'L',
          'x1': path[seqstart].x,
          'y1': path[seqstart].y,
          'x2': path[seqend].x,
          'y2': path[seqend].y
        }];
      }

      // (an error>ltreshold) ---> find the point with the biggest error
      var fitpoint = errorpoint;
      curvepass = true;
      errorval = 0;

      // quadratic spline through this point, measure errors on every point in the sequence--get projections

      var t = (fitpoint - seqstart) / tl,
        t1 = (1 - t) * (1 - t),
        t2 = 2 * (1 - t) * t,
        t3 = t * t;
      var cpx = (t1 * path[seqstart].x + t3 * path[seqend].x - path[fitpoint].x) / -t2,
        cpy = (t1 * path[seqstart].y + t3 * path[seqend].y - path[fitpoint].y) / -t2;

      // Check every point
      pcnt = seqstart + 1;
      while (pcnt != seqend) {
        t = (pcnt - seqstart) / tl;
        t1 = (1 - t) * (1 - t);
        t2 = 2 * (1 - t) * t;
        t3 = t * t;
        px = t1 * path[seqstart].x + t2 * cpx + t3 * path[seqend].x;
        py = t1 * path[seqstart].y + t2 * cpy + t3 * path[seqend].y;

        dist2 = (path[pcnt].x - px) * (path[pcnt].x - px) + (path[pcnt].y - py) * (path[pcnt].y - py);

        if (dist2 > qtreshold) {
          curvepass = false;
        }
        if (dist2 > errorval) {
          errorpoint = pcnt;
          errorval = dist2;
        }
        pcnt = (pcnt + 1) % path.length;
      }
      // return spline if fits
      if (curvepass) {
        return [{
          'type': 'Q',
          'x1': path[seqstart].x,
          'y1': path[seqstart].y,
          'x2': cpx,
          'y2': cpy,
          'x3': path[seqend].x,
          'y3': path[seqend].y
        }];
      }
      //  If the spline fails (an error>qtreshold), find the point with the biggest error
      // set splitpoint = (fitting point + errorpoint)/2
      var splitpoint = Math.floor((fitpoint + errorpoint) / 2);

      var sm = that.fitseq(path, ltreshold, qtreshold, seqstart, splitpoint);
      sm = sm.concat(that.fitseq(path, ltreshold, qtreshold, splitpoint, seqend));
      return sm;

    } // End of fitseq()

  // Batch tracing paths
  this.traceAllPaths = function(internodepaths, lowerLinearThreshold, quadraticSplineThreshold) {
      var btracedpaths = [];
      for (k in internodepaths) {
        if (!internodepaths.hasOwnProperty(k)) {
          continue;
        }
        btracedpaths.push(that.getPath(internodepaths[k], lowerLinearThreshold, quadraticSplineThreshold));
      }
      return btracedpaths;
    },

    //batchtrace
    this.traceAllLayers = function(binternodes, lowerLinearThreshold, quadraticSplineThreshold) {
      var btbis = [];
      for (k in binternodes) {
        if (!binternodes.hasOwnProperty(k)) {
          continue;
        }
        btbis[k] = that.traceAllPaths(binternodes[k], lowerLinearThreshold, quadraticSplineThreshold);
      }
      return btbis;
    }

  //  SVG Drawing functions

  // Getting SVG path element string from a traced path
  this.svgpathstring = function(desc, segments, fillcolor, sc, lcpr, qcpr) {
      // Path
      var str = '<path desc="' + desc + '" fill="' + fillcolor + '" stroke="' + fillcolor + '" stroke-width="1" d="';
      str += 'M' + segments[0].x1 * sc + ' ' + segments[0].y1 * sc + ' ';
      for (var pcnt = 0; pcnt < segments.length; pcnt++) {
        str += segments[pcnt].type + ' ' + segments[pcnt].x2 * sc + ' ' + segments[pcnt].y2 * sc + ' ';
        if (segments[pcnt].x3) {
          str += segments[pcnt].x3 * sc + ' ' + segments[pcnt].y3 * sc + ' ';
        }
      }
      str += 'Z " />';

      // Rendering control points
      if (lcpr && qcpr) {
        for (var pcnt = 0; pcnt < segments.length; pcnt++) {
          if (segments[pcnt].x3) {
            str += '<circle cx="' + segments[pcnt].x2 * sc + '" cy="' + segments[pcnt].y2 * sc + '" r="' + qcpr + '" fill="cyan" stroke-width="' + qcpr * 0.2 + '" stroke="black" />';
            str += '<circle cx="' + segments[pcnt].x3 * sc + '" cy="' + segments[pcnt].y3 * sc + '" r="' + qcpr + '" fill="white" stroke-width="' + qcpr * 0.2 + '" stroke="black" />';
            str += '<line x1="' + segments[pcnt].x1 * sc + '" y1="' + segments[pcnt].y1 * sc + '" x2="' + segments[pcnt].x2 * sc + '" y2="' + segments[pcnt].y2 * sc + '" stroke-width="' + qcpr * 0.2 + '" stroke="cyan" />';
            str += '<line x1="' + segments[pcnt].x2 * sc + '" y1="' + segments[pcnt].y2 * sc + '" x2="' + segments[pcnt].x3 * sc + '" y2="' + segments[pcnt].y3 * sc + '" stroke-width="' + qcpr * 0.2 + '" stroke="cyan" />';
          } else {
            str += '<circle cx="' + segments[pcnt].x2 * sc + '" cy="' + segments[pcnt].y2 * sc + '" r="' + lcpr + '" fill="white" stroke-width="' + lcpr * 0.2 + '" stroke="black" />';
          }
        }
      } else if (lcpr) {
        for (var pcnt = 0; pcnt < segments.length; pcnt++) {
          if (!segments[pcnt].x3) {
            str += '<circle cx="' + segments[pcnt].x2 * sc + '" cy="' + segments[pcnt].y2 * sc + '" r="' + lcpr + '" fill="white" stroke-width="' + lcpr * 0.2 + '" stroke="black" />';
          }
        }
      } else if (qcpr) {
        for (var pcnt = 0; pcnt < segments.length; pcnt++) {
          if (segments[pcnt].x3) {
            str += '<circle cx="' + segments[pcnt].x2 * sc + '" cy="' + segments[pcnt].y2 * sc + '" r="' + qcpr + '" fill="cyan" stroke-width="' + qcpr * 0.2 + '" stroke="black" />';
            str += '<circle cx="' + segments[pcnt].x3 * sc + '" cy="' + segments[pcnt].y3 * sc + '" r="' + qcpr + '" fill="white" stroke-width="' + qcpr * 0.2 + '" stroke="black" />';
            str += '<line x1="' + segments[pcnt].x1 * sc + '" y1="' + segments[pcnt].y1 * sc + '" x2="' + segments[pcnt].x2 * sc + '" y2="' + segments[pcnt].y2 * sc + '" stroke-width="' + qcpr * 0.2 + '" stroke="cyan" />';
            str += '<line x1="' + segments[pcnt].x2 * sc + '" y1="' + segments[pcnt].y2 * sc + '" x2="' + segments[pcnt].x3 * sc + '" y2="' + segments[pcnt].y3 * sc + '" stroke-width="' + qcpr * 0.2 + '" stroke="cyan" />';
          }
        }
      } // End of quadratic control points

      return str;
    } // End of svgpathstring()

  // Converting tracedata to an SVG string, paths are drawn according to a Z-index 
  // the optional lcpr and qcpr are linear and quadratic control point radiuses 
  this.getsvgstring = function(w, h, tracedata, options) {
      options = options || {};
      that.handleOptions(options);
      // SVG start
      var svgstr = '<svg width="' + w + 'px" height="' + h + 'px" version="1.1" xmlns="http://www.w3.org/2000/svg" desc="Created with imagetracer.js" >';

      // Background
      svgstr += '<rect x="0" y="0" width="' + w + 'px" height="' + h + 'px" fill="' + that.torgbstr(tracedata.palette[tracedata.background]) + '" />';

      // creating Z-index
      var zIndex = [],
        label;
      // Layer loop
      for (k in tracedata.layers) {
        if (!tracedata.layers.hasOwnProperty(k)) {
          continue;
        }
        // Path loop
        for (var pcnt = 0; pcnt < tracedata.layers[k].length; pcnt++) {
          // Label (Z-index key) is the startpoint of the path, linearized
          label = tracedata.layers[k][pcnt][0].y1 * w + tracedata.layers[k][pcnt][0].x1;
          zIndex[label] = {
            'l': '' + k,
            'p': '' + pcnt
          };
        } // End of path loop
      } // End of layer loop

      // Sorting Z-index
      var zIndexKeys = Object.keys(zIndex),
        l, p;
      zIndexKeys.sort(that.compareNumbers);

      // Drawing, Z-index loop
      for (var k = 0; k < zIndexKeys.length; k++) {
        l = zIndex[zIndexKeys[k]].l;
        p = zIndex[zIndexKeys[k]].p;
        // Adding SVG <path> string, desc contains layer and path number
        svgstr += that.svgpathstring(
          'l ' + l + ' p ' + p,
          tracedata.layers[l][p],
          that.torgbstr(tracedata.palette[l]),
          options.scale, options.lcpr, options.qcpr);
      } // End of Z-index loop

      // SVG End
      svgstr += '</svg>';

      return svgstr;

    } // End of getsvgstring()

  // Comparator for numeric Array.sort
  this.compareNumbers = function(a, b) {
    return a - b;
  }

  // Convert color object to rgb string
  this.torgbstr = function(c) {
    return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'
  }

  // Appending the svg to container 
  this.SVGToContainer = function(svgstr, containerID) {
    var div;
    if (containerID) {
      div = document.getElementById(containerID);
      if (!div) {
        div = document.createElement('div');
        div.id = containerID;
        document.body.appendChild(div);
      }
    } else {
      div = document.createElement('div');
      document.body.appendChild(div);
    }
    div.innerHTML += svgstr;
  }

  //  Canvas functions
  this.imgLoader = function(url, cb) {
    var img = new Image();
    img.src = url;
    img.onload = function() {
      var canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      var context = canvas.getContext('2d');
      context.drawImage(img, 0, 0);
      cb(canvas);
    }
  }

  // ImageData from  canvas contxt
  this.getImgdata = function(canvas) {
    var context = canvas.getContext('2d');
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }

  //TODO format this better
  // Special palette to use with drawlayers()
  this.customPalette = [{
    r: 0,
    g: 0,
    b: 0,
    a: 255
  }, {
    r: 128,
    g: 128,
    b: 128,
    a: 255
  }, {
    r: 0,
    g: 0,
    b: 128,
    a: 255
  }, {
    r: 64,
    g: 64,
    b: 128,
    a: 255
  }, {
    r: 192,
    g: 192,
    b: 192,
    a: 255
  }, {
    r: 255,
    g: 255,
    b: 255,
    a: 255
  }, {
    r: 128,
    g: 128,
    b: 192,
    a: 255
  }, {
    r: 0,
    g: 0,
    b: 192,
    a: 255
  }, {
    r: 128,
    g: 0,
    b: 0,
    a: 255
  }, {
    r: 128,
    g: 64,
    b: 64,
    a: 255
  }, {
    r: 128,
    g: 0,
    b: 128,
    a: 255
  }, {
    r: 168,
    g: 168,
    b: 168,
    a: 255
  }, {
    r: 192,
    g: 128,
    b: 128,
    a: 255
  }, {
    r: 192,
    g: 0,
    b: 0,
    a: 255
  }, {
    r: 255,
    g: 255,
    b: 255,
    a: 255
  }, {
    r: 0,
    g: 128,
    b: 0,
    a: 255
  }]

  // drawn onto a container
  this.createCanvasLayers = function(layers, palette, scale, containerID) {
    scale = scale || 1;
    var w, h, idx;

    // Preparing container
    var div;
    if (containerID) {
      div = document.getElementById(containerID);
      if (!div) {
        div = document.createElement('div');
        div.id = containerID;
        document.body.appendChild(div);
      }
    } else {
      vectorHolder = document.createElement('div');
      document.body.appendChild(div);
    }

    for (k in layers) {
      if (!layers.hasOwnProperty(k)) {
        continue;
      }
      w = layers[k][0].length;
      h = layers[k].length;
      idx = 0;

      // 1 canvas/layer 
      var canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      var context = canvas.getContext('2d');

      // Drawing
      for (var j = 0; j < h; j++) {
        for (var i = 0; i < w; i++) {
          context.fillStyle = that.torgbstr(palette[layers[k][j][i] % palette.length]);
          context.fillRect(i * scale, j * scale, scale, scale);
        }
      }
      vectorHolder.appendChild(canvas);
    }
  }

  return this;
} // End ..
