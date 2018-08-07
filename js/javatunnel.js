/***************************************************************/
/*                    JavaTunnel                               */
/*           Written by Kevin Ferguson (2018)                  */
/*     A simple solver for potential flow around an airfoil    */
/*    The goal is for the code to be as readable as possible   */
/* to allow others to follow and understand what is happening  */
/***************************************************************/
// Get our canvas to draw to. Note (0,0) is top left, with x increasing to the right and y increasing downwards
var canv = document.getElementById("windTunnelCanvas");
var ctx = canv.getContext("2d");

var msPerFrame = 1000.0/60.0;
const particleLife = 20000; // Maximum lifespan of a smoke particle in miliseconds. Larger number means longer smoke lifespan, which means more particles may need to be drawn, requiring more power
var Uinf = 0.5; // Freestream velocity

var isMouseClicked = false; // Just a variable keeping track of if the mouse is up or down
var mouseX = 0;
var mouseY = 0;

var timeOfLastSmoke = new Date().getTime();
var minSmokeTime = 20; // Minimum time between creation of smoke particles in miliseconds. Just used to avoid creating too many. Lower number means more smoke, but also more computational power required
var particles = [];

var mux = -0.1;
var muy = 0.0;
var mu = math.complex(mux,muy); // Circle center location
var radius = 1.0;
var alpha;
// We will precalculate these when alpha changes to minimize the number of trig operations being done
var sinalpha;
var cosalpha;
var tanalpha;

function inputControlChanged() {
	Uinf = document.getElementById("Uinf").value;
	mux = -1*document.getElementById("centerX").value;
	muy = -1*document.getElementById("centerY").value;
	alpha = document.getElementById("alphaSlider").value;
	sinalpha = math.sin(alpha);
	cosalpha = math.cos(alpha);
	tanalpha = math.tan(alpha);
	radius = math.sqrt(math.pow(1.0-mux,2.0)+math.pow(muy,2.0)); // Circle radius, chosen to intersect +1 on the real axis
	mu = math.complex(mux,muy); // Circle center location
}
inputControlChanged(); // Call this right away to set our parameters

// This function resizes the canvas when the window resizes so that it always fills the window
function windowResized() {
	canv.width  = window.innerWidth;
	canv.height = window.innerHeight; // Leave 10% of the window height for the controls
};
windowResized(); // Call the window resized routine once to set the size

window.setInterval(drawTunnel,msPerFrame); // Causes the drawTunnel function to be called every msPerFrame miliseoconds
canv.addEventListener("mousedown",function(evt) {
	xi = math.complex((mouseX-canv.width/2.0)/100.0,(mouseY-canv.height/2.0)/100);
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
	};
};

// This is called by every particle at every time step to figure out its velocity.
function getVelocityAtPoint(x,y) {
	x = x-canv.width/2.0;
	y = y-canv.height/2.0;
	// I think the bug is here. X and Y are airfoil coordinates, and we're solving a system of 2 equations for 2 unknown circle coordinates
	// FIXME: Fix this
	var unmapy = (y+x*tanalpha)/(100*(tanalpha*sinalpha+cosalpha));
	var unmapx = x/(100.0*cosalpha)-unmapy*tanalpha;
	//var unmapx = x/100.0+y*math.sin(alpha)/math.cos(alpha);
	//var unmapy = y/100.0-x*math.sin(alpha)/math.cos(alpha);
	var unmap = math.complex(unmapx,unmapy); // This is the coordinate of the click in airfoil coordinates
	// Solve the inverse joukowski transform. We get two roots. One root will lie inside the circle. The other will lie outside.
	// The catch is that which root we should pick depends on where we are, so we need to calculate both.
	var xiplus = math.divide(math.add(unmap,math.sqrt(math.subtract(math.pow(unmap,2.0),4.0))),2.0);
	var ximinus = math.divide(math.subtract(unmap,math.sqrt(math.subtract(math.pow(unmap,2.0),4.0))),2.0);
	// Now we want the root which has the largest radius. This is the root that lies outside of the circle in the circle plane.
	// These next two lines are simply to calculate the distance of the root from the circle center
	var xiplusr = math.subtract(mu,xiplus);
	var ximinusr = math.subtract(mu,ximinus);
	var xi; // This will hold the value of the root we ultimately pick
	if (xiplusr.toPolar().r > radius) {
		xi = xiplus;
	} else {
		xi = ximinus;
	}
	// Now construct the flow solution in the circle plane
	// Potential flow lets us sum together a bunch of linear solutions to get a more complex solution
	// In this case, we need a uniform flow, a doublet, and a vortex.
	var W = math.complex(0,0); // W is the total flow field.
	var freestream = math.complex(0,0); // THe freestream flow
	freestream = math.multiply(Uinf,math.exp(math.chain(-1).multiply(math.i).multiply(alpha).done()));
	var vortex = math.complex(0,0); // The vortex flow.
	var gamma = math.chain(math.multiply(4,math.pi)).multiply(Uinf).multiply(radius).done(); // Gamma is the value of the circulation we need to satisfy the kutta condition (Flow leaves tangent to the trailing edge)
	gamma = math.multiply(gamma,math.sin(math.add(alpha,math.asin(math.divide(mu.im,radius)))));
	vortex = math.chain(math.multiply(math.i,gamma)).divide(math.chain(math.multiply(2,math.pi)).multiply(math.subtract(xi,mu)).done()).done(); // Now calculate the vortex
	var doublet = math.complex(0,0); // Calculate the doublet
	doublet = math.divide(math.chain(Uinf).multiply(math.pow(radius,2.0)).multiply(math.exp(math.chain(math.i).multiply(alpha).done())).done(),math.pow(math.subtract(xi,mu),2.0));
	// Now add them all together
	W = math.add(W,freestream); // Freestream flow
	W = math.add(W, vortex); // Vortex
	W = math.subtract(W, doublet); // Doublet
	W = math.divide(W,math.subtract(1.0,math.divide(1.0,math.pow(xi,2.0)))); // Convert the velocity to airfoil coordinates
	var Vel = new Object(); // Now construct an object to return the flow velocity
	Vel['U'] = W.re*cosalpha+W.im*sinalpha;
	Vel['V'] = -W.re*sinalpha-W.im*cosalpha; // Velocity is given as W = u - i*v, so v is actually the negative of what we have here
	//Vel['U'] = W.re;
	//Vel['V'] = -W.im; // Velocity is given as W = u - i*v, so v is actually the negative of what we have here
	return Vel;
}

// This is to take a circle and run it through the joukowski transformation to get an airfoil.
function airfoilMap() {
	var i;
	var mapped = [];
	for (i=0; i<360; i++) {
		var rad = i*math.pi/180;
		var xi = math.complex(radius*math.cos(rad)+mu.re,radius*math.sin(rad)-mu.im);
		var psi = math.add(xi,math.divide(1.0,xi));
		// Output the x and y points. Using z=x+i*y
		// Need to scale our output for the screen
		// TODO: Maybe eventually use a variable scale based on screen size
		// Normally potential flow rotates the flow while keeping the airfoil horizontal.
		// This isn't very intuitive to look at, so instead we'll rotate the airfoil and keep the flow horizontal
		var xcoord = 100.0*(psi.re*cosalpha-psi.im*sinalpha)+canv.width/2.0;
		var ycoord = 100.0*(-psi.re*sinalpha-psi.im*cosalpha)+canv.height/2.0;
		mapped[i] = math.complex(xcoord,ycoord);
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
	ctx.moveTo(airfoil[0].re,airfoil[0].im);
	var j;
	for (j=1; j<360; j++) {
		ctx.lineTo(airfoil[j].re,airfoil[j].im);
	}
	ctx.closePath();
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
		vel = getVelocityAtPoint(particles[i].x,particles[i].y);
		particles[i].update(vel['U'],vel['V']);
		particles[i].drawToCtx(ctx);
	}

	// Now remove any particles which have lived too long
	// The filter function removes any element where this expression returns false
	// This removes particles that are either outside the canvas or have lived longer than the particle lifespan
	particles = particles.filter(p => (T-p.born) < particleLife && (p.x < canv.width) && (p.x > 0.0) && (p.y < canv.height) && (p.y > 0.0));
}
