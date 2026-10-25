# Lead climbing figure

An interactive isometric figure of a 9.2 m lead lane with seven quickdraws (first at 2.6 m, then every metre, the last is the top anchor). The climber trails the rope and stops to clip each quickdraw, pulling up about 0.9 m of rope to do it; the belayer pays out through an assisted-braking device.

Hover to set the climber's height (up and down) and slack (left and right), click to fall, `L` to lower. Arrow keys and Space work too. `model.mjs` is the fall model, shared by the page: free fall of twice the height above the last clip plus slack, then a rope whose stiffness is set so the UIAA test (80 kg, factor 1.77) peaks at 8.2 kN, 180° friction at the top quickdraw and a little at each lower one, and a 70 kg belayer who is lifted when the rope pulls harder than their weight. The readout gives the fall, the fall factor, the peak load on the climber and on the top quickdraw. The idle tour shows a fall high on the route, then a fall while clipping the second quickdraw that reaches the ground.

Open `lead-climb.html` (dark) or `lead-climb-light.html` (light). Rebuild with `node figures/lead-climb/build.mjs [--light]`. `kit/` is vendored from [Anatomy](https://github.com/wheresryan22/anatomy) (MIT).
