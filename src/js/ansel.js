/* 
 * ansel.js | 0.9.0 | February 21st 2018
 * https://github.com/matthiaskunter/ansel
 * Copyright (c) 2018 Matthias Kunter; 
 *	
 * License: MIT
 */

//global variables
var dataURI;			// URI of the data coming from the cam
var picture; 			// a DOM picture Element
var imageData;			// the actual image data
var canv;				// the canvas
var ctx;				// the canvas (context)
var filter = [];		// array of all filters
var actFilterNum = -1;	// remembers the last choosen filter
var undoList = [];		// Undo list for taking back a step 
var pictureLoaded = false;

var canvasWidth = 320;
var canvasHeight = 240;
var canvasOldWidth = 320;
var canvasOldHeight = 320;
var zoom = 100;

// Object for the image area
var imageArea = {
	sizeX:1000,
	sizeY:450,
	mouseX:0,
	mouseY:0,
}

/* 
   Cam Settings
*/

Webcam.set({
	width: 320,
	height: 240,
	image_format: 'png'
});

/* 
   Default MouseEvents Settings
*/
function standardMouseDown(event){
		
	imageArea.mouseX = event.pageX;
	imageArea.mouseY = event.pageY;
	
	// unbind the move and up events
	$('body').mouseup(function(){
		$('body').unbind('mouseup');
		$('body').unbind('mousemove');
	});
	
	// move the image on the image area
	$('body').mousemove(function(event){
		var deltaX = event.pageX - imageArea.mouseX;
		var deltaY = event.pageY - imageArea.mouseY;
		imageArea.mouseX = event.pageX;
		imageArea.mouseY = event.pageY;
		
		var canvXString = $('.image_area').children().css('left');
		var canvYString = $('.image_area').children().css('top');
		var newCanvX = Number( canvXString.substring(0,canvXString.length-2) ) + deltaX;
		var newCanvY = Number( canvYString.substring(0,canvYString.length-2) ) + deltaY;
	
		$('.image_area').children().css('left',newCanvX + 'px');
		$('.image_area').children().css('top',newCanvY + 'px');
	});
}

var lastScrollTop = 0;
function standardMouseScroll(event){
	if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
		// zoom in
		zoom = Math.ceil(zoom * 1.05);
	}
	else {
		// zoom out
		zoom = Math.floor(zoom / 1.05);
		if (zoom < 1){
			zoom = 1;
		}
	}
	
	// if the tool for zoom exits already - update 
	var zoomElement = document.getElementById('zoom_number');
	if (zoomElement != null){
		zoomElement.value = zoom;
	}
	
	if (pictureLoaded){
		imageDraw(createResult());
	}
}

/*
   Window onload	
*/
window.onload = function(){ 		
	
	// hide the download button
	$('#btn_download').hide();
	
	// hide canvas
	$('#image_canvas').hide();
	
	canv = document.getElementById('image_canvas');
	ctx = canv.getContext('2d');
	
	// Camera button
	var CamBtn = document.getElementById('camera_btn');
	CamBtn.onclick = function(){
		// disable elements
		document.getElementById('disablingDiv').style.display='block';
		// hide scrolling bars
		document.querySelector('body').style.overflow = 'hidden';
		
		// open an overlay
		var overlay = document.createElement('DIV');
		overlay.classList.add('overlay');
		overlay.style.zIndex=1001;
		document.body.appendChild(overlay);
		
		// cam area
		var camArea = document.createElement('DIV');
		camArea.id = 'my_camera';
		overlay.appendChild(camArea);
		
		
		// create a button
		var btn = document.createElement('A');
		var t = document.createTextNode('Snapshot'); 
		btn.appendChild(t);
		btn.classList.add('standard_btn');
		btn.onclick = take_snapshot;
		btn.style.left = '0px';
		overlay.appendChild(btn);
		
		Webcam.attach( '#my_camera' );
	}

	// File load button
	var fileBtn = document.getElementById('load_btn');
	fileBtn.onchange = function(event){
		var file =  event.target;
		var reader = new FileReader();
		
		reader.onload = function () {
	
			picture = new Image;
			picture.src = reader.result;
			picture.onload = onPictureLoad;
			
			// show save button
			$('#btn_download').show();		
		};
		
		if (file.files[0]) {
			reader.readAsDataURL(file.files[0]);
		}
		
	}
	
	// Image area mouse events
	$('.image_area').mousedown(standardMouseDown);
	$('.image_area').bind('mousewheel DOMMouseScroll', standardMouseScroll);
	
	// download button
	$('#btn_download').click(function(){
		var button = document.getElementById('btn_download');
		
		// for download we apply all filters and place it into a canvas (unvisible)
		var resultImage = createResult();
		var newCanvas = $("<canvas>")
			.attr("width", resultImage.width)
			.attr("height", resultImage.height)[0];
		newCanvas.getContext("2d").putImageData(resultImage,0,0);
		button.href = newCanvas.toDataURL();
	});
	
	// undo button
	$('#undo_btn').addClass('disabled');
	$('#undo_btn').click(undo);
}

function take_snapshot() {
	
	// take snapshot and get image data
	Webcam.snap( function(data_uri) {
		
		picture = new Image;
		picture.src = data_uri;
		picture.onload = onPictureLoad;

		// hand over URI to global variable
		dataURI = data_uri;
	} );
	
	// remove the overlay
	$('.overlay').remove();
	// enable elements
	document.getElementById('disablingDiv').style.display='none';
	// show scrolling
	document.querySelector('body').style.overflow = 'auto';
	// show save button
	$('#btn_download').show();
}

/*
	Function to be processed if image is uploaded or taken from webcam
*/
function onPictureLoad(){
	// draw loaded picture hidden
	// this is the way to get to the image array from an URL
	canvasWidth = picture.width;
	canvasHeight = picture.height;
	ctx.canvas.width = canvasWidth; 
	ctx.canvas.height = canvasHeight;
	ctx.drawImage(picture,0,0);
	imageData = ctx.getImageData(0,0,picture.width,picture.height);
	
	// calculate zoom
	if (canvasWidth > imageArea.sizeX){
		zoom = Math.floor(imageArea.sizeX / canvasWidth * 100);
	}
	if (canvasHeight > imageArea.sizeY){
		var zoomY = Math.floor(imageArea.sizeY / canvasHeight * 100);
		if( zoomY < zoom ){
			zoom = zoomY;
		}
	}
	
	canvasOldWidth = canvasWidth;
	canvasOldHeigth = canvasHeight;
	imageDraw(imageData);
	
	// place the canvas in the middle of the image Area
	$('#image_canvas').css('left', (imageArea.sizeX/2-canvasWidth/2) + 'px');
	$('#image_canvas').css('top', (imageArea.sizeY/2-canvasHeight/2) + 'px');
	$('#image_canvas').show();
	
	filter = [];
	initFilter(filter);
	removeFilter();
	actFilterNum =-1;
	showFilter();
	
	pictureLoaded = true;
}

/*
	Function to draw the image into the visible canvas
*/
function imageDraw(imgData){
	
	if(typeof imgData === "undefined") {
		return;
	}
	canvasWidth = imgData.width * zoom/100;
	canvasHeight = imgData.height * zoom/100;
	
	// new Size of canvas
	ctx.canvas.width = canvasWidth; 
	ctx.canvas.height = canvasHeight;
	
	// new Position of Canvas
	var deltaX = canvasWidth - canvasOldWidth;
	var deltaY = canvasHeight - canvasOldHeight;
	var canvXString = $('.image_area').children().css('left');
	var canvYString = $('.image_area').children().css('top');
	var newCanvX = Number( canvXString.substring(0,canvXString.length-2) ) - deltaX/2;
	var newCanvY = Number( canvYString.substring(0,canvYString.length-2) ) - deltaY/2;
	
	$('.image_area').children().css('left',newCanvX + 'px');
	$('.image_area').children().css('top',newCanvY + 'px');
	canvasOldWidth = canvasWidth;
	canvasOldHeight = canvasHeight;
	
	// zoom in or out as canvas operation
	ctx.scale(zoom/100, zoom/100);
	var newCanvas = $("<canvas>")
		.attr("width", imgData.width)
		.attr("height", imgData.height)[0];
	newCanvas.getContext("2d").putImageData(imgData,0,0);
	
	ctx.drawImage(newCanvas,0,0);
}

/*
	Function to initialize all Filter
*/
function initFilter(toolsArray){
		
	// Resize Filter
	var filterResize = {
		name: 'Resize',
		hasChanged: false,
		lastResult: {},
		data:[],
		tools: [			//Array of tools
			{
				name: 'aspect',
				tooltype: 'check',
				flagNames: [
					'Aspect',
				],
				flagValues: [
					true,
				]
			},
			{
				name: 'Width',
				tooltype: 'int',
				min: 1,
				max: 9999,
				step: 1,
				value: imageData.width,
				lastValue: imageData.width
			},
			{
				name: 'Height',
				tooltype: 'int',
				min: 1,
				max: 9999,
				step: 1,
				value: imageData.height,
				lastValue: imageData.height,
			},
		],
		process: function(imgData){
			
			var newCanvas = $("<canvas>")
				.attr("width", imgData.width)
				.attr("height", imgData.height)[0];
			newCanvas.getContext("2d").putImageData(imgData,0,0);
			
			var newX;
			var newY;
			// if width has changed
			if(this.tools[1].lastValue != this.tools[1].value){	
				newX = this.tools[1].value;
				if(this.tools[0].flagValues[0]){
					newY = Math.round(newX*imgData.height/imgData.width);
					this.tools[2].value = newY;
				} else {
					newY = this.tools[2].value;
				}
			// if height has changed
			} else{		
				newY = this.tools[2].value;
				if(this.tools[0].flagValues[0]){
					newX = Math.round(newY*imgData.width/imgData.height);
					this.tools[1].value = newX;
				} else {
					newX = this.tools[1].value;
				}
			}
			this.tools[1].lastValue = this.tools[1].value;
			this.tools[2].lastValue = this.tools[2].value;
			
			// if aspect ratio is checked
			if(this.tools[0].flagValues[0]){
				newY = Math.round(newX*imgData.height/imgData.width);
				this.tools[2].value = newY;
			} else {
				newY = this.tools[2].value;
			}
			
			var newCanvas2 = $("<canvas>")
				.attr("width", newX) 
				.attr("height", newY)[0];
			var ctx2 = newCanvas2.getContext("2d");
			ctx2.scale( newX/imgData.width, newY/imgData.height);
			ctx2.drawImage(newCanvas,0,0);
			
			var resultData = ctx2.getImageData(0,0, newX,newY);
			
			this.lastResult = resultData;
			return resultData;
		}
	};
	toolsArray.push(filterResize);
	
	// Croping Filter
	var filterCrop = {
		name: 'Crop',
		hasChanged: false,
		lastResult: {},
		data:[],
		tools: [			//Array of tools
			{
				name: 'Left',
				tooltype: 'int',
				min: 0,
				max: imageData.width,
				step: 1,
				value: 0,
			},
			{
				name: 'Right',
				tooltype: 'int',
				min: 0,
				max: imageData.width,
				step: 1,
				value: 0,
			},
			{
				name: 'Top',
				tooltype: 'int',
				min: 0,
				max: imageData.height,
				step: 1,
				value: 0,
			},
			{
				name: 'Bottom',
				tooltype: 'int',
				min: 0,
				max: imageData.height,
				step: 1,
				value: 0,
			},
		],
		process: function(imgData){
			var width = imgData.width - this.tools[0].value - this.tools[1].value;
			var height = imgData.height - this.tools[2].value - this.tools[3].value;
			var newCanvas = $("<canvas>")
				.attr("width", imgData.width)
				.attr("height", imgData.height)[0];
			
			var ctxNew = newCanvas.getContext("2d");
			ctxNew.putImageData(imgData,0,0);
			
			var resultData = ctxNew.getImageData(this.tools[0].value,this.tools[2].value, width,height);
			
			this.lastResult = resultData;
			return resultData;
		}
	};
	toolsArray.push(filterCrop);
	
	// Brightness Filter
	var filterBrightness = {
		name: 'Brightness',
		hasChanged: false,
		lastResult: {},
		data:[],
		tools: [			//Array of tools
			{
				name: 'Level',
				tooltype: 'int-slider',
				min: -10,
				max: 10,
				value: 0,
			}
		],
		process: function(imgData){
			var resultData=ctx.createImageData(imgData.width,imgData.height);
			for (var i=0; i<imgData.data.length; i+=4){
				resultData.data[i] = Math.min(imgData.data[i] + this.tools[0].value*10, 255);
				resultData.data[i+1] = Math.min(imgData.data[i+1] + this.tools[0].value*10, 255);					
				resultData.data[i+2] = Math.min(imgData.data[i+2] + this.tools[0].value*10, 255);
				resultData.data[i+3] = imgData.data[i+3];
			}					
			
			this.lastResult = resultData;
			return resultData;
		}
	};
	toolsArray.push(filterBrightness);
	
	// Contrast Filter
	var filterContrast = {
		name: 'Contrast',
		hasChanged: false,
		lastResult: {},
		data:[],
		tools: [			//Array of tools
			{
				name: 'Level',
				tooltype: 'int-slider',
				min: -10,
				max: 10,
				value: 0,
			}
		],
		process: function(imgData){
			var resultData=ctx.createImageData(imgData.width,imgData.height);
			var max = -1;
			var min = 256;
			for (var i=0; i<imgData.data.length; i+=4){
				max = Math.max(imgData.data[i],max);
				max = Math.max(imgData.data[i+1],max);
				max = Math.max(imgData.data[i+2],max);
				min = Math.min(imgData.data[i],min);
				min = Math.min(imgData.data[i+1],min);
				min = Math.min(imgData.data[i+2],min);
			}
			for (var i=0; i<imgData.data.length; i+=4){
				resultData.data[i] = (max-min)/2 + (1+0.1 * this.tools[0].value) * (imgData.data[i]-(max-min)/2);
				resultData.data[i+1] = (max-min)/2 + (1+0.1 * this.tools[0].value) * (imgData.data[i+1]-(max-min)/2);	
				resultData.data[i+2] = (max-min)/2 + (1+0.1 * this.tools[0].value) * (imgData.data[i+2]-(max-min)/2);
				resultData.data[i+3] = imgData.data[i+3];
			}					
			
			this.lastResult = resultData;
			return resultData;
		}
	};
	toolsArray.push(filterContrast);

	// Colorize filter
	var filterColorize = {
		name: 'Colorize',
		hasChanged: false,
		lastResult: {},
		data:[],
		tools: [			//Array of tools
			{
				name: 'Select',
				tooltype: 'switch',
				actualCase: 'None',
				cases: [
					'None',
					'Mono Color',
					'Sepia',
					'Red',
					'Green',
					'Blue',
				]
			}
		],
		process: function(imgData){
			var resultData=ctx.createImageData(imgData.width,imgData.height);
			
			switch(this.tools[0].actualCase){
				case this.tools[0].cases[0]:
					for (var i=0; i<imgData.data.length; i+=4){
						resultData.data[i] = imgData.data[i];
						resultData.data[i+1] = imgData.data[i+1];
						resultData.data[i+2] = imgData.data[i+2];
						resultData.data[i+3] = imgData.data[i+3];
					}
					break;
				case this.tools[0].cases[1]:	//mono color
					for (var i=0; i<imgData.data.length; i+=4){
						var gray = (imgData.data[i] * 0.3 + imgData.data[i+1] * 0.59 + imgData.data[i+2] * 0.11);
						resultData.data[i] = gray;
						resultData.data[i+1] = gray;
						resultData.data[i+2] = gray;
						resultData.data[i+3] = imgData.data[i+3];
					}
					break;
				case this.tools[0].cases[2]:	//sepia
					for (var i=0; i<imgData.data.length; i+=4){
						resultData.data[i] = (imgData.data[i] * 0.393) + (imgData.data[i+1] * 0.769) + (imgData.data[i+2] * 0.189);
						resultData.data[i+1] =(imgData.data[i] * .349) + (imgData.data[i+1] *.686) + (imgData.data[i+2] * .168);
						resultData.data[i+2] = (imgData.data[i] * .272) + (imgData.data[i+1] *.534) + (imgData.data[i+2] * .131);
						resultData.data[i+3] = imgData.data[i+3];
					}
					break;
				case this.tools[0].cases[3]:	//red
					for (var i=0; i<imgData.data.length; i+=4){
						var gray = (imgData.data[i] * 0.3 + imgData.data[i+1] * 0.59 + imgData.data[i+2] * 0.11);
						resultData.data[i] = gray;
						resultData.data[i+1] = 0;
						resultData.data[i+2] = 0;
						resultData.data[i+3] = imgData.data[i+3];
					}
					break;
				case this.tools[0].cases[4]:	//red
					for (var i=0; i<imgData.data.length; i+=4){
						var gray = (imgData.data[i] * 0.3 + imgData.data[i+1] * 0.59 + imgData.data[i+2] * 0.11);
						resultData.data[i] = 0;
						resultData.data[i+1] = gray;
						resultData.data[i+2] = 0;
						resultData.data[i+3] = imgData.data[i+3];
					}
					break;
				case this.tools[0].cases[5]:	//red
					for (var i=0; i<imgData.data.length; i+=4){
						var gray = (imgData.data[i] * 0.3 + imgData.data[i+1] * 0.59 + imgData.data[i+2] * 0.11);
						resultData.data[i] = 0;
						resultData.data[i+1] = 0;
						resultData.data[i+2] = gray;
						resultData.data[i+3] = imgData.data[i+3];
					}
					break;
				default:
		
			}
			
			this.lastResult = resultData;
			return resultData;
		}
	};
	toolsArray.push(filterColorize);
	
	// Blur filter
	var filterBlur = {
		name: 'Blur',
		hasChanged: false,
		lastResult: {},
		data:[],
		tools: [			//Array of tools
			{
				name: 'Strength',
				tooltype: 'int-slider',
				min: 0,
				max: 10,
				value: 0,
			}
		],
		process: function(imgData){
			
			if (this.tools[0].value == 0){
				this.lastResult = imgData;
				return imgData;
			}
			
			var resultData1=imgData;
			
			for (var i=0; i<2*this.tools[0].value; i++){
				var resultData2=ctx.createImageData(imgData.width,imgData.height);
				// first and last row
				for (var x = 0; x < imgData.width; x++){
					resultData2.data[x*4] = resultData1.data[x*4];
					resultData2.data[x*4+1] = resultData1.data[x*4+1];
					resultData2.data[x*4+2] = resultData1.data[x*4+2];
					resultData2.data[x*4+3] = resultData1.data[x*4+3];
					
					resultData2.data[(imgData.width*(imgData.height-1)+x)*4] = resultData1.data[(imgData.width*(imgData.height-1)+x)*4];
					resultData2.data[(imgData.width*(imgData.height-1)+x)*4+1] = resultData1.data[(imgData.width*(imgData.height-1)+x)*4+1];
					resultData2.data[(imgData.width*(imgData.height-1)+x)*4+2] = resultData1.data[(imgData.width*(imgData.height-1)+x)*4+2];
					resultData2.data[(imgData.width*(imgData.height-1)+x)*4+3] = resultData1.data[(imgData.width*(imgData.height-1)+x)*4+3];
				}

				// first and last column
				for (var y = 1; y < imgData.height-1; y++){
					resultData2.data[y*imgData.width*4] = resultData1.data[y*imgData.width*4];
					resultData2.data[y*imgData.width*4+1] = resultData1.data[y*imgData.width*4+1];
					resultData2.data[y*imgData.width*4+2] = resultData1.data[y*imgData.width*4+2];
					resultData2.data[y*imgData.width*4+3] = resultData1.data[y*imgData.width*4+3];
					
					resultData2.data[(y*imgData.width+imgData.width-1)*4] = resultData1.data[(y*imgData.width+imgData.width-1)*4];
					resultData2.data[(y*imgData.width+imgData.width-1)*4+1] = resultData1.data[(y*imgData.width+imgData.width-1)*4+1];
					resultData2.data[(y*imgData.width+imgData.width-1)*4+2] = resultData1.data[(y*imgData.width+imgData.width-1)*4+2];
					resultData2.data[(y*imgData.width+imgData.width-1)*4+3] = resultData1.data[(y*imgData.width+imgData.width-1)*4+3];
				}
				
				for (var x = 1; x < imgData.width-1; x++){
					for (var y = 1; y < imgData.height-1; y++){
					
						var valueR = resultData1.data[((y-1)*imgData.width+(x-1))*4]
								   + resultData1.data[((y-1)*imgData.width+(x))*4]
								   + resultData1.data[((y-1)*imgData.width+(x+1))*4]
								   + resultData1.data[((y)*imgData.width+(x-1))*4]
								   + resultData1.data[((y)*imgData.width+(x))*4]
								   + resultData1.data[((y)*imgData.width+(x+1))*4]
								   + resultData1.data[((y+1)*imgData.width+(x-1))*4]
								   + resultData1.data[((y+1)*imgData.width+(x))*4]
								   + resultData1.data[((y+1)*imgData.width+(x+1))*4];
								   
					    var valueG = resultData1.data[((y-1)*imgData.width+(x-1))*4+1]
								   + resultData1.data[((y-1)*imgData.width+(x))*4+1]
								   + resultData1.data[((y-1)*imgData.width+(x+1))*4+1]
								   + resultData1.data[((y)*imgData.width+(x-1))*4+1]
								   + resultData1.data[((y)*imgData.width+(x))*4+1]
								   + resultData1.data[((y)*imgData.width+(x+1))*4+1]
								   + resultData1.data[((y+1)*imgData.width+(x-1))*4+1]
								   + resultData1.data[((y+1)*imgData.width+(x))*4+1]
								   + resultData1.data[((y+1)*imgData.width+(x+1))*4+1];
								   
						var valueB = resultData1.data[((y-1)*imgData.width+(x-1))*4+2]
								   + resultData1.data[((y-1)*imgData.width+(x))*4+2]
								   + resultData1.data[((y-1)*imgData.width+(x+1))*4+2]
								   + resultData1.data[((y)*imgData.width+(x-1))*4+2]
								   + resultData1.data[((y)*imgData.width+(x))*4+2]
								   + resultData1.data[((y)*imgData.width+(x+1))*4+2]
								   + resultData1.data[((y+1)*imgData.width+(x-1))*4+2]
								   + resultData1.data[((y+1)*imgData.width+(x))*4+2]
								   + resultData1.data[((y+1)*imgData.width+(x+1))*4+2];
								   
						resultData2.data[(y*imgData.width+x)*4] = valueR/9;		
						resultData2.data[(y*imgData.width+x)*4+1] = valueG/9;
						resultData2.data[(y*imgData.width+x)*4+2] = valueB/9;						
						resultData2.data[(y*imgData.width+x)*4+3] = resultData1.data[(y*imgData.width+x)*4+3];
				
					}
				}
				
				resultData1=resultData2;
			}
			
			this.lastResult = resultData2;
			return resultData2;
		}
	};
	toolsArray.push(filterBlur);
	
	// Paint filter
	var filterDraw	= {
		name: 'Draw',
		hasChanged: false,
		lastResult: {},
		newCanvas:[],
		newCtx:[],
		data:[],
		tools: [			//Array of tools
			{
				name: 'Select',
				tooltype: 'switch',
				actualCase: 'Position',
				cases: [
					'Position',
					'Draw',
				]
			},
			{
				name: 'Red',
				tooltype: 'int',
				min: 0,
				max: 255,
				step: 1,
				value: 0,
			},
			{
				name: 'Green',
				tooltype: 'int',
				min: 0,
				max: 255,
				step: 1,
				value: 0,
			},
			{
				name: 'Blue',
				tooltype: 'int',
				min: 0,
				max: 255,
				step: 1,
				value: 0,
			},
			{
				name: 'Brush',
				tooltype: 'int',
				min: 1,
				max: 50,
				step: 1,
				value: 1,
			}
		],
		process: function(imgData){
			
			if(actFilterNum >-1 && filter[actFilterNum].name == this.name){
				// set the mouse events according to the selection
				switch(this.tools[0].actualCase){
					case 'Position': 
						// unbind from the other selection
						$('#image_canvas').unbind('mousedown');
						
						// bind to standard mouse events on image area
						$('.image_area').mousedown(standardMouseDown);
						$('.image_area').bind('mousewheel DOMMouseScroll', standardMouseScroll);
						break;
					case 'Draw':
						// unbind from the other selection
						$('.image_area').unbind('mousedown');
						$('.image_area').unbind('mousewheel DOMMouseScroll');
						
						// bind to mouse events for canvas drawing
						$('#image_canvas').bind('mousedown', {filter:this}, this.drawMouseDown);
						break;
					default:
				} 
			}
			
			// We have an array of lines that will be drawn here
			this.newCanvas = $("<canvas>")
				.attr("width", imgData.width)
				.attr("height", imgData.height)[0];
			this.newCtx = this.newCanvas.getContext("2d");
			
			var z = zoom/100;
			this.newCtx.putImageData(imgData,0,0);
			
			// draw all the lines 
			for (var i=0; i<this.data.length; i++){
				this.newCtx.beginPath();
				this.newCtx.moveTo(this.data[i].line[0].x,this.data[i].line[0].y);
				
				for (var j=1; j<this.data[i].line.length; j++){
					this.newCtx.lineTo(this.data[i].line[j].x,this.data[i].line[j].y);
				}
				
				this.newCtx.strokeStyle = 'rgb(' + this.data[i].r + ',' 
												 + this.data[i].g + ',' 
												 + this.data[i].b + ')';	
				this.newCtx.lineWidth =	 this.data[i].width;							 
				this.newCtx.stroke();
			}
			
			// take out the pixel data from the context				
			var resultData=this.newCtx.getImageData(0,0,imgData.width,imgData.height);	
			this.lastResult = resultData;
			return resultData;
		},
		drawMouseDown:function(event){
	
			var z = zoom/100;
			var canvX = $('#image_canvas').offset().left;
			var canvY = $('#image_canvas').offset().top;
			var mouseX = event.pageX - canvX;
			var mouseY = event.pageY - canvY;
			var lineObject = {
				line: [],
				r: event.data.filter.tools[1].value,
				g: event.data.filter.tools[2].value,
				b: event.data.filter.tools[3].value,
				width: event.data.filter.tools[4].value
			}
			var point = {
				x:mouseX/z, 
				y:mouseY/z,
			}
			lineObject.line.push(point);
			event.data.filter.data.push(lineObject);
			
			// paint directly on global canvas
			ctx.beginPath();
			ctx.moveTo(mouseX/z,mouseY/z);
			
			// mouse events that are only valid if mouse button is pressed
			$('body').bind('mousemove', {filter:event.data.filter}, event.data.filter.drawMouseMove);
			$('body').bind('mouseup', event.data.filter.drawMouseUp);
			
			// save actual state in undo list
			undoList.push({
				name:event.data.filter.name,
				tools:JSON.stringify(event.data.filter.tools),
				data:JSON.stringify(event.data.filter.data),
			});
			
			// show that content has changed
			event.data.filter.hasChanged = true;
		},
		
		drawMouseMove:function(event){
			
			var lineObject = event.data.filter.data[event.data.filter.data.length-1];
			
			var z = zoom/100;
			var canvX = $('#image_canvas').offset().left;
			var canvY = $('#image_canvas').offset().top;
			var mouseX = event.pageX - canvX;
			var mouseY = event.pageY - canvY;
			
			var point = {
				x:mouseX/z, 
				y:mouseY/z,
			}
			lineObject.line.push(point);
			
			// paint directly on global canvas
			ctx.lineTo(mouseX/z,mouseY/z);
			ctx.strokeStyle = 'rgb(' + lineObject.r + ',' 
			                         + lineObject.g + ',' 
									 + lineObject.b + ')';
			ctx.lineWidth =	 lineObject.width;
			ctx.stroke();	
		},
		
		drawMouseUp:function(event){
			$('body').unbind('mouseup');
			$('body').unbind('mousemove');
		}
	};
	toolsArray.push(filterDraw);
}
/*
  The filter on the left side will be shown dynamically as buttons
*/
function removeFilter(){
	$('.filter_btn').remove();
	$('.filter_btn_wrap').remove();
	$('#filter_tools').children().remove();
}

function showFilter(){
	
	// Filter
	for ( var i=0; i < filter.length; i++)
	{
		// create a button
		var div = document.createElement('DIV');
		div.classList.add('filter_btn_wrap');
		var btn = document.createElement('A');
		var t = document.createTextNode(filter[i].name); 
		btn.appendChild(t);
		btn.classList.add('standard_btn');
		btn.classList.add('filter_btn');
		btn.filterId = i;
		btn.onclick = showToolsFromButton;
		div.appendChild(btn);
		document.getElementById('filter').appendChild(div);
		
		//set to changed
		filter[i].hasChanged = true;	
	}
	
	// permanent attributes (eg. zoom)
	var divWrapper = document.createElement('DIV');
	divWrapper.classList.add('zoom_element_wrapper');

	var h3 = document.createElement('H3');
	var t = document.createTextNode('Zoom'); 
	h3.appendChild(t);
	divWrapper.appendChild(h3);
	
	var div = document.createElement('DIV');
	div.classList.add('area');
	div.classList.add('zoom_element');
	divWrapper.appendChild(div)
	
	var label = document.createElement('Label');
	label.setAttribute('for','zoom');
	label.innerHTML = 'Percent';
	div.appendChild(label);
	
	var input = document.createElement('input');
	input.type = 'number';
	input.value = zoom;
	input.id = 'zoom_number';
	input.min = 1;
	input.max = 1000;
	input.onchange = function(){
		zoom = this.value;
		imageDraw(createResult());
	}
	div.appendChild(input);
	
	document.getElementById('filter_tools').appendChild(divWrapper);
	
}
/*
	if a filter button is pressed we have to do certain things before we show the tools 
*/
function showToolsFromButton(){
	actFilterNum = this.filterId;
	
	// this is still a hack:
	// unbind mouse from draw modus
	$('#image_canvas').unbind('mousedown');
	// reset draw filter radio button
	for (var i = 0; i < filter.length; i++){
		if (filter[i].name == 'Draw'){
			filter[i].tools[0].actualCase = filter[i].tools[0].cases[0];
		}
	}
	
	// bind mouse move events for standard zoom
	$('.image_area').mousedown(standardMouseDown);
	$('.image_area').bind('mousewheel DOMMouseScroll', standardMouseScroll);
	
	showTools();
}

/*
   Function that shows the tools that belong to a certain filter in the 
   tool area above the image area
*/
function showTools(){
	
	if (actFilterNum<0){
		return;
	}
	
	//Delete all non-permanent childs of filtertools
	$('#filter_tools').find('.tool_element').remove();
	$('#filter_tools').find('#toolH3').remove();
	
	// Add the Toolname
	var h3 = document.createElement('H3');
	var t = document.createTextNode(filter[actFilterNum].name); 
	h3.id = 'toolH3';
	h3.appendChild(t);
	document.getElementById('filter_tools').appendChild(h3);
	
	// go over all tools and create the UI elements
	for (var i=0; i<filter[actFilterNum].tools.length; i++){
		var div = document.createElement('DIV');
		div.classList.add('area');
		div.classList.add('tool_element');
		
		switch (filter[actFilterNum].tools[i].tooltype){
			case 'int':
				createIntTool(div, false, filter[actFilterNum].tools[i], filter[actFilterNum]);
				break;
			case 'int-slider':
				createIntTool(div,true, filter[actFilterNum].tools[i], filter[actFilterNum]);
				break;
			case 'switch':
				createSwitchTool(div, filter[actFilterNum].tools[i], filter[actFilterNum]);
			break;
			case 'check':
				createCheckTool(div, filter[actFilterNum].tools[i], filter[actFilterNum]);
			default:
		}
		document.getElementById('filter_tools').appendChild(div);
	}
}

/*
	Integer tools have a number input and optional a slider
*/
function createIntTool(parent, sliderUsed, tool, actFilter){
	
	var label = document.createElement('Label');
	label.setAttribute("for",tool.name);
	label.innerHTML = tool.name;
	parent.appendChild(label);
	
	var input = document.createElement('input');
	input.type = 'number';
	input.value = tool.value;
	input.id = tool.name + 'number';
	input.min = tool.min;
	input.max = tool.max
	if (tool.step){
		input.step = tool.step;
	}
	input.onchange = function(){
		
		undoList.push({
			name:actFilter.name,
			tools:JSON.stringify(actFilter.tools),
			data:JSON.stringify(actFilter.data),
		});
		$('#undo_btn').removeClass('disabled');
		actFilter.hasChanged = true;
		
		tool.value = this.value;
		
		if (sliderUsed){
			var prefix = this.id.substring(0,this.id.length-6);
			$('#' + prefix + 'range').val(this.value);
		}
		imageDraw(createResult());
	}
	parent.appendChild(input);
	
	var br = document.createElement('BR');
	parent.appendChild(br);
	
	if (sliderUsed){
		var input2 = document.createElement('input');
		input2.type = 'range';
		input2.value = tool.value;
		input2.min = tool.min;
		input2.max = tool.max;
		input2.id = tool.name + 'range';
		input2.onchange = function(){
			{
				undoList.push({
					name:actFilter.name,
					tools:JSON.stringify(actFilter.tools),
					data:JSON.stringify(actFilter.data)
				});
				$('#undo_btn').removeClass('disabled');
				actFilter.hasChanged = true;
				
				tool.value = this.value;
				
				var prefix = this.id.substring(0,this.id.length-5);
				$('#' + prefix + 'number').val(this.value);
				imageDraw(createResult());
			}
		}
		parent.appendChild(input2);
	}
	
}
/*
	Switch tools are basically radio buttons to select one-out-of-many attributes
*/
function createSwitchTool(parent, tool, actFilter){
	var wrapper_div;
	for (var i=0; i<tool.cases.length; i++){
		if ( i%3 == 0 ){
			wrapper_div = document.createElement('DIV');
			wrapper_div.classList.add('switch_wrapper');
			parent.appendChild(wrapper_div);
		} 
		
		var input = document.createElement('input');
		input.type = 'radio';
		input.name = tool.name;
		input.value = tool.cases[i];
		input.id = tool.cases[i];
		if (tool.actualCase == tool.cases[i]) {
			input.checked = true;
		}
		input.onclick = function(){
			
			undoList.push({
				name:actFilter.name,
				tools:JSON.stringify(actFilter.tools),
				data:JSON.stringify(actFilter.data),
			});
			$('#undo_btn').removeClass('disabled');
			actFilter.hasChanged = true;
			
			tool.actualCase = this.value;
			imageDraw(createResult());
		}
		wrapper_div.appendChild(input);
		
		var label = document.createElement('Label');
		label.setAttribute("for",tool.cases[i]);
		label.innerHTML = tool.cases[i];
		wrapper_div.appendChild(label);
		
		var br = document.createElement('BR');
		wrapper_div.appendChild(br);
		
	}
}

/*
	Check tools are basically check buttons that sign a flag 
*/
function createCheckTool(parent, tool, actFilter){
	var wrapper_div;
	for (var i=0; i<tool.flagNames.length; i++){
		if ( i%3 == 0 ){
			wrapper_div = document.createElement('DIV');
			wrapper_div.classList.add('switch_wrapper');
			parent.appendChild(wrapper_div);
		} 
		
		var input = document.createElement('input');
		input.type = 'checkbox';
		input.name = tool.name;
		input.value = tool.flagNames[i];
		input.id = tool.flagNames[i];
		if (tool.flagValues[i]) {
			input.checked = true;
		}
		input.onclick = function(){
			
			undoList.push({
				name:actFilter.name,
				tools:JSON.stringify(actFilter.tools),
				data:JSON.stringify(actFilter.data),
			});
			$('#undo_btn').removeClass('disabled');
			actFilter.hasChanged = true;
			
			for (var i=0; i<tool.flagNames.length; i++){
				if (tool.flagNames[i] == this.id){
					tool.flagValues[i] = this.checked;
				}
			}
				
			imageDraw(createResult());
		}
		wrapper_div.appendChild(input);
		
		var label = document.createElement('Label');
		label.setAttribute("for",tool.flagNames[i]);
		label.innerHTML = tool.flagNames[i];
		wrapper_div.appendChild(label);
		
		var br = document.createElement('BR');
		wrapper_div.appendChild(br);
		
	}
}
/*
	The routine that iterates all the filters (top to bottom) and uses
	the individual filter result as input for the following filter
*/
function createResult(){
	//iterate over all Filters
	var resultImage = imageData;
	var hasChanged = false;
	for (var i=0; i<filter.length; i++){
		// if one of the filter has changed, all following filter have to be executed
		hasChanged = hasChanged || filter[i].hasChanged;
		if (hasChanged){
			resultImage=filter[i].process(resultImage);
		} else {
			resultImage = filter[i].lastResult;
		}
		filter[i].hasChanged = false;
	}
	showTools();
	return resultImage;
}

/*
	Undo functionality:
	- if a tool changes its attributes we will create a JSON blob out of it and append 
	  it to the undo list, 
	- when undo is pressed we parse the last element in the undo list and replace the
	  respective filter tools with it
*/
function undo(){
	if (undoList.length > 0){
		var i = 0;
		while( i < filter.length && undoList[undoList.length-1].name != filter[i].name){
			i++;
		}
		
		if(i < filter.length){
			filter[i].tools = JSON.parse(undoList[undoList.length-1].tools);
			filter[i].data = JSON.parse(undoList[undoList.length-1].data);
			undoList.pop();
			filter[i].hasChanged = true;
			showTools();
			imageDraw(createResult());
		}
		
		if (undoList.length == 0){
			$('#undo_btn').addClass('disabled');
		}
	}
}


