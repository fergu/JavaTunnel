/***************************************************************/
/*                    JavaTunnel                               */
/*           Written by Kevin Ferguson (2018)                  */
/*     A simple solver for potential flow around an airfoil    */
/*    The goal is for the code to be as readable as possible   */
/* to allow others to follow and understand what is happening  */
/***************************************************************/
// Get our canvas to draw to. Note (0,0) is top left, with x increasing to the right and y increasing downwards
var canv = document.getElementById("windTunnelCanvas");
canv.width  = window.innerWidth;
canv.height = window.innerHeight;
var ctx = canv.getContext("2d");

var msPerFrame = 1000.0/60.0;
const particleLife = 5000; // Maximum lifespan of a smoke particle in miliseconds. Larger number means longer smoke lifespan, which means more particles may need to be drawn, requiring more power
const Uinf = 0.5; // Freestream velocity
//const a = 100; // Cylinder radius

var isMouseClicked = false; // Just a variable keeping track of if the mouse is up or down
var mouseX = 0;
var mouseY = 0;

var timeOfLastSmoke = new Date().getTime();
var minSmokeTime = 1; // Minimum time between creation of smoke particles in miliseconds. Just used to avoid creating too many. Lower number means more smoke, but also more computational power required
var particles = [];

var mux = -0.1;
var muy = -0.1;

// This function resizes the canvas when the window resizes so that it always fills the window
function windowResized() {
	canv.width  = window.innerWidth;
	canv.height = window.innerHeight;
};

window.setInterval(drawTunnel,msPerFrame); // Causes the drawTunnel function to be called every msPerFrame miliseoconds
canv.addEventListener("mousedown",function(evt) {
	isMouseClicked = true;
},false); // Calls mouseClicked() when the mouse button is clicked

canv.addEventListener("mouseup", function(evt) {
	isMouseClicked = false;
},false); // Calls mouseUnClicked() when the mouse button is raised

canv.addEventListener("mousemove", function(evt) {
	mouseX = evt.clientX+document.body.scrollLeft;
	mouseY = evt.clientY+document.body.scrollTop;
},false);

// This class represents a "smoke particle" that traces the flow
// FIXME: May represent the smoke as a polygon eventually, which will let it deform with the flow
// This may look more realistic
class smokeParticle {
	constructor(originX,originY,originT) {
		this.x = originX;
		this.y = originY;
		this.born = originT;
		this.u = 0;
		this.v = 0;
		this.vel = math.sqrt(math.pow(this.u,2.0)+math.pow(this.v,2.0));
	};

	update(xVel,yVel) {
		this.x += xVel*msPerFrame;
		this.y += yVel*msPerFrame;
		this.u = xVel;
		this.v = yVel;
		this.vel = math.sqrt(math.pow(this.u,2.0)+math.pow(this.v,2.0));
	};

	// FIXME: Something to make the smoke look more "realistic". At the moment they're just hard circles.
	drawToCtx(ctx) {
		ctx.beginPath();
		var hval = 240+120*(this.vel-Uinf)/(Uinf);
		ctx.fillStyle = "hsl("+hval+",100%,50%)";
		ctx.arc(this.x,this.y,5,0,2*Math.PI);
		ctx.fill();
		//ctx.stroke();
	};
};

// The smoke does not exactly follow the streamlines due to the explicit nature of the time integration being used
// I.E - The particles jump streamlines slightly due to the discrete, linear updates of particle position in each update
// FIXME: Need to add conformal mapping routine to map circle to airfoil
// This should have the complex flow in the circle plan completed. Now just need to implement the mapping.
// Now we're mapping to the airfoil, but something funny is happening. Seems like something about our coordinate map is wrong
function getVelocityAtPoint(x,y,centerX,centerY) {
	var radius = math.sqrt(math.pow(1-centerX,2.0)+math.pow(centerY,2.0));
	var unmap = math.complex((x-canv.width/2.0)/100.0,(y-canv.height/2.0)/100.0); // This is the coordinate of the click in airfoil coordinates
	// z = xi + 1/xi -> xi^2 - z*xi + 1 = 0, xi = (z+/-sqrt(z^2-4))/2
	var xiplus = math.divide(math.add(unmap,math.sqrt(math.subtract(math.pow(unmap,2.0),4.0))),2.0);
	var ximinus = math.divide(math.subtract(unmap,math.sqrt(math.subtract(math.pow(unmap,2.0),4.0))),2.0);
	var xi; // Need to invert the jowkowski transform
	if (xiplus.toPolar().r > 1.0) {
		xi = xiplus;
	} else {
		xi = ximinus;
	}
	var mu = math.complex(centerX,centerY)
	var W = math.complex(0,0);
	var freestream = math.complex(0,0);
	freestream = Uinf*1.0;
	var vortex = math.complex(0,0);
	var gamma = math.chain(math.multiply(4,math.pi)).multiply(Uinf).multiply(radius).done();
	gamma = math.multiply(gamma,math.sin(math.add(0.0,math.asin(math.divide(mu.im,radius)))));
	vortex = math.chain(math.multiply(math.i,gamma)).divide(math.chain(math.multiply(2,math.pi)).multiply(math.subtract(xi,mu)).done()).done();
	var doublet = math.complex(0,0);
	doublet = math.divide(Uinf*math.pow(radius,2.0),math.pow(math.subtract(xi,mu),2.0));
	W = math.add(W,freestream); // Freestream flow
	W = math.add(W, vortex); // Vortex
	W = math.subtract(W, doublet); // Doublet
	W = math.divide(W,math.subtract(1.0,math.divide(1.0,math.pow(xi,2.0)))); // Convert to airfoil coordinates
	var Vel = new Object();
	Vel['U'] = W.re;
	Vel['V'] = -W.im; // Velocity is given as W = u - i*v, so v is actually the negative of what we have here
	return Vel;
}

function airfoilMap(centerX,centerY) {
	var i;
	var mapped = [];
	var radius = math.sqrt(math.pow(1-centerX,2.0)+math.pow(centerY,2.0));
	for (i=0; i<360; i=i+2) {
		var rad = i*math.pi/180;
		var xi = math.complex(radius*math.cos(rad)+centerX,radius*math.sin(rad)+centerY);
		var psi = math.add(xi,math.divide(1.0,xi));
		//var psi = xi;
		mapped[i] = 100.0*psi.re+canv.width/2;
		mapped[i+1] = 100.0*psi.im+canv.height/2;
	}
	return mapped;
}

// This function draws the current data to the screen
function drawTunnel() {
	var T = new Date().getTime();
	// Clear the page
	ctx.clearRect(0,0,canv.width,canv.height);
	ctx.fillStyle = "#000";
	ctx.fillRect(0,0,canv.width,canv.height);
	var airfoil = airfoilMap(mux,muy);
	ctx.beginPath();
	ctx.fillStyle = "#CCC";
	ctx.moveTo(airfoil[0],airfoil[1]);
	var j;
	for (j=2; j<360; j=j+2) {
		ctx.lineTo(airfoil[j],airfoil[j+1]);
	}
	ctx.closePath();
//	ctx.arc(canv.width/2.0,canv.height/2.0,a,0,2*Math.PI);
	ctx.fill();

	// Add a smoke particle if we should
	if (isMouseClicked == true && (T-timeOfLastSmoke) > minSmokeTime) {
		var newSmoke = new smokeParticle(mouseX,mouseY,T);
		particles.push(newSmoke);
		timeOfLastSmoke = T;
	}

	// Update the position of the smoke and draw it
	var i;
	for (i=0; i<particles.length; i++) {
		vel = getVelocityAtPoint(particles[i].x,particles[i].y,mux,muy);
		particles[i].update(vel['U'],vel['V']);
		particles[i].drawToCtx(ctx);
	}

	// Now remove any particles which have lived too long
	// The filter function removes any element where this expression returns false
	// This removes particles that are either outside the canvas or have lived longer than the particle lifespan
	particles = particles.filter(p => (T-p.born) < particleLife && (p.x < canv.width) && (p.x > 0.0) && (p.y < canv.height) && (p.y > 0.0));
}
