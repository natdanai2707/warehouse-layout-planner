import { LAYERS } from '../catalog'
import { useStore } from '../store'

export function LayersPanel() {
  const hiddenLayers = useStore((s) => s.hiddenLayers)
  const toggleLayer = useStore((s) => s.toggleLayer)
  return (
    <section className="layers">
      <h2>เลเยอร์ / Layers</h2>
      {LAYERS.map((l) => (
        <label key={l.id} className="layer-row">
          <input type="checkbox" checked={!hiddenLayers.includes(l.id)} onChange={() => toggleLayer(l.id)} />
          <span>
            {l.labelTh} <em>{l.labelEn}</em>
          </span>
        </label>
      ))}
    </section>
  )
}
