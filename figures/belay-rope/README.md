# Top-rope belay figure

An interactive isometric figure of a 6 m top-rope lane: wall, holds, a two-bolt anchor with two carabiners, a 75 kg climber and a 70 kg belayer with an assisted-braking device. The rope is the lit part, marked every 0.5 m; the marks spread when it stretches.

Hover to set the climber's height (up and down) and the belayer's slack (left and right), click to fall. Arrow keys and Space do the same. The fall is a small simulation: free fall through the slack, then a dynamic rope (8% static elongation at 80 kg), 1.7× friction over the carabiners, damping, and a belayer who leaves the mat when the rope pulls harder than their weight. Too much slack low on the wall ends in a ground fall.

Open `belay-rope.html` (dark) or `belay-rope-light.html` (light). Rebuild with `node figures/belay-rope/build.mjs [--light]`. `man.mjs` holds the posable people, shared by the build and the page. `kit/` is vendored from [Anatomy](https://github.com/wheresryan22/anatomy) (MIT).
