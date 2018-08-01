# JavaTunnel
A browser based solver for potential flow around airfoils.

## Purpose

The purpose of this project is to create a simple and readable potential flow solver. The hope is that this code is readable enough for someone unfamiliar with the concept to be able to figure out what is going on, and someone who is familiar to be able to see the pieces that go in to such a solver.

## Display

At the moment the display is simple. Clicking the mouse button will emit a stream of "smoke" from the current mouse location which will then propagate through the flow field. The smoke will change color depending on flow speed, with blue representing freestream flow, and progressing towards red as speed increases.

## Shortcomings

This is a potential flow solver, and so is subject to all the shortcomings that come with that. I.E - there is no viscosity or boundary layer separation.

"But it sure looks like the particles are leaving the airfoil! What gives?"

This is due to the nature of the time stepping used. At every time step (every screen draw, which is 60 times per second) each particle is moved using its velocity at the previous time step times the elapsed time. This is a pretty simple, linear way of moving the particles which is nice from a computational standpoint but means that the particles aren't going to perfectly follow the flow, especially in regions where the flow is moving quickly.
