# JavaTunnel
A browser based solver for potential flow around airfoils.

## Purpose

The purpose of this project is to create a simple and readable potential flow solver. The hope is that this code is readable enough for someone unfamiliar with the concept to be able to figure out what is going on, and someone who is familiar to be able to see the pieces that go in to such a solver.

## Display

At the moment the display is simple. Clicking the mouse button will emit a stream of "smoke" from the current mouse location which will then propagate through the flow field. The smoke will change color depending on flow speed, with blue representing freestream flow, and progressing towards red as speed increases.

Clicking the "Controls" button on the bottom of the page will bring up a control panel which lets you adjust things like flow speed, airfoil thickness, camber, and angle of attack.

## Shortcomings

This is a potential flow solver, and so is subject to all the shortcomings that come with that. I.E - there is no viscosity or boundary layer separation.

"But it sure looks like the particles are leaving the airfoil! What gives?"

This is due to the nature of the time stepping used. At every time step (every screen draw, which is 60 times per second) each particle is moved using its velocity at the previous time step times the elapsed time. This is a pretty simple, linear way of moving the particles which is nice from a computational standpoint but means that the particles aren't going to perfectly follow the flow, especially in regions where the flow is moving quickly.

## Under the hood

This is a potential flow solver for flow around an airfoil subject to the Kutta Condition. This solver functions by solving for flow around a cylinder with circulation, and then applying the Joukowski Transformation to the resulting solution.

### Potential flow

Potential flow is a particular type of solution to the Navier-Stokes equations. In particular, these solutions are linear which means that if A and B are both solutions, then A + B is also a solution. This means we can take simple solutions and add them together to make a more complicated solution.

Solving for flow around an airfoil is actually kind of hard, so instead we make use of something called the Joukowski Transformation together with the potential flow solution around an Airfoil. Potential flow around a cylinder is a lot easier and something we know how to do. The Joukowski Transformation transforms a circle in to an airfoil. Specific choices during the transformation allow you to give the airfoil thickness, as well as camber (curvature). This means that we can take our solution around a cylinder and turn it in to a solution around an airfoil!
