/**
 * Created by Daniel on 12-07-2014.
 * Based on svgPan - https://github.com/talos/jquery-svgpan
 */
/*global define, jQuery, window*/

(function (factory) {
    "use strict";
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery'], factory);
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {
    "use strict";
    var NONE = 0,
        PAN = 1,
        DRAG = 2,
        init = function (root, svgRoot, brushID, enablePan, enableZoom, enableDrag, zoomScale) {

            var state = NONE,
                stateTarget,
                stateOrigin,
                stateTf,
                $root = $(root),
                $brush = $('#'+brushID),
                $parent = $root.parent(),
                recentOffset = $root.offset(),
                // FF sometimes doesn't calculate this anything near correctly for SVGs.
                offsetIsBroken = Math.abs($root.offset().left) > 1e5,
                isMouseOverElem = false,
                isMouseOverBrushElem = false,

                /**
                 * Dumps a matrix to a string (useful for debug).
                 */
                dumpMatrix = function (matrix) {
                    var s = "[ " + matrix.a + ", " + matrix.c + ", " + matrix.e + "\n  " + matrix.b + ", " + matrix.d + ", " + matrix.f + "]";

                    return s;
                },

                /**
                 * Instance an SVGPoint object with given event coordinates.
                 */
                getEventPoint = function (evt) {
                    var p = root.createSVGPoint(),
                        offsetX = evt.offsetX,
                        offsetY = evt.offsetY,
                        offset,
                        ctm,
                        matrix;

                    if (typeof offsetX === "undefined" || typeof offsetY === "undefined") {
                        offset = offsetIsBroken ? $parent.offset() : recentOffset;
                        offsetX = evt.pageX - offset.left;
                        offsetY = evt.pageY - offset.top;
                    }

                    p.x = offsetX;
                    p.y = offsetY;

                    return p;
                },

                /**
                 * Sets the current transform matrix of an element.
                 */
                setCTM = function (element, matrix) {
                    var s = "matrix(" + matrix.a + "," + matrix.b + "," + matrix.c + "," + matrix.d + "," + matrix.e + "," + matrix.f + ")";

                    element.setAttribute("transform", s);
                },

                zoomCanvas = function (evt, zoomFactor) {
                    if (!enableZoom) {
                        return;
                    }

                    var z = zoomFactor,
                        g = svgRoot,
                        p = getEventPoint(evt),
                        k;

                    p = p.matrixTransform(g.getCTM().inverse());

                    // Compute new scale matrix in current mouse position
                    k = root.createSVGMatrix().translate(p.x, p.y).scale(z).translate(-p.x, -p.y);

                    setCTM(g, g.getCTM().multiply(k));

                    if (typeof stateTf === "undefined") {
                        stateTf = g.getCTM().inverse();
                    }

                    stateTf = stateTf.multiply(k.inverse());

                    renderBrush();

                },

                panCanvas = function (dx, dy, dt) {
                    //Optionally pan with time tween
                    //set brush coordinates if map was translated.
                    var vp = document.getElementById("viewport"),
                        canvasScale = vp.getCTM().a;

                    var bdx = ($brush.getCTM().e * (scale * canvasScale));
                    var bdy = ($brush.getCTM().f * (scale * canvasScale));

                    //Update instead of delete and replace.
                    $(vp).attr("transform", "matrix(1,0,0,1," + -(bdx) + "," + -(bdy) + ")"); //TODO: Add id and style thru CSS

                },

                renderBrush = function (tx, ty) {
                    var brushWidth,
                        brushHeight,
                        scale = 20, //TODO: replace this with minimapScale
                        vp = document.getElementById("viewport"),
                        canvasScale = vp.getCTM().a,
                        dx = (vp.getCTM().e ),
                        dy = (vp.getCTM().f ),
                        scaleFactor = scale * canvasScale; //get scale from transformation Matrix

                    brushWidth = (document.documentElement.clientWidth / scale) / canvasScale;
                    brushHeight = (document.documentElement.clientHeight / scale) / canvasScale;

                    //console.log("Brush Size - w:" + brushWidth + "h: " + brushHeight + " scaleFactor: " + scaleFactor);

                    //get coordinates from viewport translate to brush

                    if (tx) {
                        dx = +( (tx * scale * canvasScale));
                        setCTM(vp, vp.getCTM().translate(dx, 0));
                    }

                    if (ty) {
                        dy = +(ty * scale * canvasScale);
                        setCTM(vp, vp.getCTM().translate(0, dy));
                    }

                    //set brush coordinates if map was translated.
                    var bdx = (vp.getCTM().e / (scale * canvasScale));
                    var bdy = (vp.getCTM().f / (scale * canvasScale));

                    //Update instead of delete and replace.
                    $('#' + brushID).attr("width", brushWidth)
                        .attr("height", brushHeight)
                        .attr("style", "fill: #" + Math.floor(Math.random() * 16777215).toString(16) + "; fill-opacity: 0.4;")
                        .attr("transform", "matrix(1,0,0,1," + -(bdx) + "," + -(bdy) + ")"); //TODO: Add id and style thru CSS
                },

                /**
                 * Handle mouse wheel event.
                 */
                handleMouseWheel = function (evt) {
                    if (!enableZoom) {
                        return;
                    }

                    if (!isMouseOverElem) {
                        return;
                    }

                    if (evt.preventDefault) {
                        evt.preventDefault();
                    }

                    // evt.returnValue = false;
                    recentOffset = $root.offset();

                    var delta = evt.wheelDelta ? evt.wheelDelta / 360 : evt.detail / -9,
                        z = Math.pow(1 + zoomScale, delta),
                        g = svgRoot,
                        p = getEventPoint(evt),
                        k;

                    zoomCanvas(evt, z);
                },

                /**
                 * Handle mouse move event.
                 */
                handleMouseMove = function (evt) {

                    if (evt.preventDefault) {
                        evt.preventDefault();
                    }

                    evt.returnValue = false;

                    var g = svgRoot,
                        p;

                    if (state === PAN && enablePan) {
                        // Pan mode
                        p = getEventPoint(evt).matrixTransform(stateTf);

                        setCTM(g, stateTf.inverse().translate(p.x - stateOrigin.x, p.y - stateOrigin.y));

                        //console.log("renderBrush()");
                        renderBrush();
                    } else if (state === DRAG && enableDrag) {
                        // Drag mode
                        p = getEventPoint(evt).matrixTransform(g.getCTM().inverse());

                        setCTM(stateTarget, root.createSVGMatrix().translate(p.x - stateOrigin.x, p.y - stateOrigin.y).multiply(g.getCTM().inverse()).multiply(stateTarget.getCTM()));

                        stateOrigin = p;
                    }

                },

                /**
                 * Handle mouseenter event.  This has been added to stop ignoring
                 * inputs when the mouse is over the element.
                 **/
                handleMouseEnter = function (evt) {
                    // bind our mousemove listener only when we have mouse in view
                    if (!isMouseOverElem) {
                        recentOffset = $root.offset();
                        $root.bind('mousemove', handleMouseMove);
                        isMouseOverElem = true;
                    }
                },

                /**
                 * Handle mouseleave event.  This has been added to ignore
                 * inputs when the mouse is not over the element.
                 **/
                handleMouseLeave = function (evt) {
                    // unbind our mousemove listener only when we no longer have mouse in view
                    if (isMouseOverElem) {
                        $root.unbind('mousemove', handleMouseMove);
                        isMouseOverElem = false;
                    }
                    state = NONE;
                },

                /**
                 * Handle click event.
                 */
                handleMouseDown = function (evt) {
                    if (evt.preventDefault) {
                        evt.preventDefault();
                    }

                    evt.returnValue = false;

                    //var svgDoc = evt.target.ownerDocument;

                    //var g = getRoot(svgDoc);
                    var g = svgRoot;

                    // Pan anyway when drag is disabled and the user clicked on an element
                    if (evt.target.tagName === "svg" || !enableDrag) {
                        // Pan mode
                        state = PAN;

                        stateTf = g.getCTM().inverse();

                        stateOrigin = getEventPoint(evt).matrixTransform(stateTf);
                    } else {
                        // Drag mode
                        state = DRAG;

                        stateTarget = evt.target;

                        stateTf = g.getCTM().inverse();

                        stateOrigin = getEventPoint(evt).matrixTransform(stateTf);
                    }
                },

                /**
                 * Handle mouse button release event.
                 */
                handleMouseUp = function (evt) {
                    if (evt.preventDefault) {
                        evt.preventDefault();
                    }

                    evt.returnValue = false;

                    //var svgDoc = evt.target.ownerDocument;

                    if (state === PAN || state === DRAG) {
                        // Quit pan mode
                        state = NONE;
                    }
                },

                handleBrushMouseMove = function(evt){

                    if (evt.preventDefault) {
                        evt.preventDefault();
                    }

                    evt.returnValue = false;

                    var g = $brush[0],
                        p,
                        vp = document.getElementById("viewport"),
                        vpzoom = vp.getCTM().a,
                        canvasScale = g.getCTM().a;

                    if (state === PAN && enablePan) {
                        // Pan mode
                        p = getEventPoint(evt).matrixTransform(stateTf);

                        var dx = (p.x - stateOrigin.x);
                        var dy = (p.y - stateOrigin.y);

                        setCTM(g, stateTf.inverse().translate(dx, dy));
                        //console.log("MOVE BRUSH - dX:"+dx+" dY:"+dy);

                        //Update Canvas
                        var bdx = (g.getCTM().e * (scale * vpzoom));
                        var bdy = (g.getCTM().f * (scale * vpzoom));

                        //Update instead of delete and replace.
                        //maintain zoom factor

                        $(vp).attr("transform", "matrix("+vpzoom+",0,0,"+vpzoom+"," + -(bdx) + "," + -(bdy) + ")");

                    }
                },

                handleBrushMouseUp = function(evt){
                    //console.log("handleBrushMouseUp");
                    if (evt.preventDefault) {
                        evt.preventDefault();
                    }

                    evt.returnValue = false;

                    //var svgDoc = evt.target.ownerDocument;

                    if (state === PAN || state === DRAG) {
                        // Quit pan mode
                        state = NONE;
                    }
                },

                handleBrushMouseDown = function(evt){
                    //console.log("handleBrushMouseDown");
                    if (evt.preventDefault) {
                        evt.preventDefault();
                    }

                    evt.returnValue = false;

                    //var svgDoc = evt.target.ownerDocument;

                    //var g = getRoot(svgDoc);
                    var g = $brush[0];

                    // Pan anyway when drag is disabled and the user clicked on an element
                    if (evt.target.tagName === "svg" || !enableDrag) {
                        // Pan mode
                        state = PAN;

                        stateTf = g.getCTM().inverse();

                        stateOrigin = getEventPoint(evt).matrixTransform(stateTf);
                    } else {
                        // Drag mode
                        state = DRAG;

                        stateTarget = evt.target;

                        stateTf = g.getCTM().inverse();

                        stateOrigin = getEventPoint(evt).matrixTransform(stateTf);
                    }
                },

                handleBrushMouseEnter = function(evt){
                    //console.log("handleBrushMouseEnter");
                    // bind our mousemove listener only when we have mouse in view
                    if (!isMouseOverBrushElem) {
                        recentOffset = $root.offset();
                        $brush.bind('mousemove', handleBrushMouseMove);
                        isMouseOverBrushElem = true;
                    }
                },

                handleBrushMouseLeave = function(evt){
                    //console.log("handleBrushMouseLeave");
                    // unbind our mousemove listener only when we no longer have mouse in view
                    if (isMouseOverBrushElem) {
                        $root.unbind('mousemove', handleBrushMouseMove);
                        isMouseOverBrushElem = false;
                    }
                    state = NONE;
                }
            ;

            /**
             * Register handlers
             */
            // MODIFICATION: registers events through jQuery
            $root.bind('mouseup', handleMouseUp)
                .bind('mousedown', handleMouseDown)
                .bind('mouseenter', handleMouseEnter)
                .bind('mouseleave', handleMouseLeave);

                //Handle Brush Events
            $brush.bind('mouseup', handleBrushMouseUp)
                .bind('mousedown', handleBrushMouseDown)
                .bind('mouseenter', handleBrushMouseEnter)
                .bind('mouseleave', handleBrushMouseLeave);

            //if (navigator.userAgent.toLowerCase().indexOf('webkit') >= 0) {
            window.addEventListener('mousewheel', handleMouseWheel, false); // Chrome/Safari/others
            window.addEventListener('DOMMouseScroll', handleMouseWheel, false); // Firefox

            //Add event for screen resize
            window.addEventListener('resize', function () {
                renderBrush();
            });

            //Add Keyboard handling... TODO: Bind via jQuery .bind()
            window.addEventListener('keydown', function (key) {
                var keycode;
                if (key == null) {
                    keycode = event.keyCode;
                } else {
                    keycode = key.keyCode;
                    switch (keycode) {
                        case 37:
                            //alert('left');
                            renderBrush(1, 0);
                            break;
                        case 38:
                            //alert('up');
                            renderBrush(0, 1);
                            break;
                        case 39:
                            //alert('right');
                            renderBrush(-1, 0);
                            break;
                        case 40:
                            //alert('down');
                            renderBrush(0, -1);
                            break;
                        case 73:
                            //alert('i - zoomIn');
                            zoomCanvas(window.event, 1.25);
                            break;
                        case 79:
                            //alert('o - zoomOut');
                            zoomCanvas(window.event, 0.75);
                            break;
                    }
                }
            });
        };

    /**
     Enable SVG panning on an SVG element.

     @param canvasId the ID of an element to use as the window canvas to display what is inside the brush area.  Required.
     @param brushID the ID of an element to use as the window canvas to disply what is inside the brush area.  Required.
     @param enablePan Boolean enable or disable panning (default enabled)
     @param enableZoom Boolean enable or disable zooming (default enabled)
     @param zoomScale Float zoom sensitivity, defaults to .2
     @param zoomRange Float zoom range, defaults to [0.25,2] (1/4x, 2x)
     **/
    $.fn.svgMiniMap = function (canvasId, brushID, enablePan, enableZoom, zoomScale, zoomRange) {
        enablePan = typeof enablePan !== 'undefined' ? enablePan : true;
        enableZoom = typeof enableZoom !== 'undefined' ? enableZoom : true;
        zoomScale = typeof zoomScale !== 'undefined' ? zoomScale : 0.25;
        zoomRange = typeof zoomRange !== 'undefined' ? zoomRange : [0.5, 2];

        return $.each(this, function (i, el) {
            var $el = $(el),
                svg,
                viewport;
            // only call upon elements that are SVGs and haven't already been initialized.

            if ($el.is('svg') && $el.data('svgMiniMap') !== true) {
                console.log("create svgMiniMap!!!");
                viewport = $el.find('#' + canvasId)[0];
                if (viewport) {
                    $el.data('svgMiniMap', true);
                    init($el[0], viewport, brushID, enablePan, enableZoom, zoomScale, zoomRange);
                } else {
                    throw "Could not find viewport with id #" + canvasId;
                }
            }
        });
    };
}));
