# Pallet putaway figure

An interactive isometric figure of one bay of selective pallet racking and a triplex-mast counterbalance forklift. Click an empty slot (or use the arrow keys and Enter) and the truck runs a real putaway cycle: travel with the load 150 mm up, lift 100 mm above the target beam, inch in, set down on the wire deck, back out, lower, return to the P&D spot and fork the next pallet. With nobody touching it, an idle tour fills the empty slots.

Open `pallet-putaway.html` (dark) or `pallet-putaway-light.html` (light) in a browser. Both are standalone.

Rebuild after editing `build.mjs`:

```bash
node figures/pallet-putaway/build.mjs
node figures/pallet-putaway/build.mjs --light
```

Built with the [Anatomy](https://github.com/wheresryan22/anatomy) skill. `kit/` is vendored from it (MIT, see `kit/LICENSE`).
