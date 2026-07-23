import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { bboxOf, fmt, polygonCentroid } from '../geometry'

// Downscale the uploaded photo so the data URL stays small enough for
// localStorage / JSON files while staying sharp on screen.
const MAX_DIM = 2048

function readAsRefImage(file: Blob, onReady: (dataUrl: string, aspect: number) => void) {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    onReady(canvas.toDataURL('image/jpeg', 0.82), canvas.height / canvas.width)
  }
  img.onerror = () => URL.revokeObjectURL(url)
  img.src = url
}

// Attach a new photo (defaults roughly covering the plot) or, if one is
// already attached, swap the picture while KEEPING its position, size,
// rotation and calibration.
function attachBlob(blob: Blob) {
  readAsRefImage(blob, (dataUrl, aspect) => {
    const st = useStore.getState()
    if (st.refImage) {
      st.editRefImage({ dataUrl, aspect })
      return
    }
    const bb = bboxOf(st.plot.pts)
    const c = polygonCentroid(st.plot.pts)
    const width = Math.max(40, (bb.maxX - bb.minX) * 1.2)
    st.attachRefImage({
      dataUrl,
      x: c.x,
      y: c.y,
      width,
      aspect,
      rotation: 0,
      opacity: 0.7,
      visible: true,
      locked: false,
    })
  })
}

export function RefImagePanel() {
  const refImage = useStore((s) => s.refImage)
  const tool = useStore((s) => s.tool)
  const fileRef = useRef<HTMLInputElement>(null)
  const s = useStore.getState

  // Ctrl+V anywhere in the app: if the clipboard holds an image, attach it
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      const imgItem = Array.from(items).find((i) => i.type.startsWith('image/'))
      if (!imgItem) return // plain text paste (e.g. into a label field) stays untouched
      const f = imgItem.getAsFile()
      if (!f) return
      e.preventDefault()
      attachBlob(f)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  // Button fallback: read the clipboard via the async API (needs permission)
  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith('image/'))
        if (type) {
          attachBlob(await it.getType(type))
          return
        }
      }
      alert('ไม่พบรูปภาพในคลิปบอร์ด — คัดลอกภาพก่อน แล้วลองใหม่ (หรือกด Ctrl+V)')
    } catch {
      alert('เบราว์เซอร์ไม่อนุญาตให้อ่านคลิปบอร์ดจากปุ่มนี้ — กด Ctrl+V บนหน้าจอแทน')
    }
  }

  return (
    <section className="refimg">
      <h2>ภาพถ่ายที่ดินจริง / Aerial Photo</h2>
      {!refImage && (
        <>
          <p className="insp-empty">
            แนบภาพถ่ายทางอากาศของแปลงจริงเป็นพื้นหลัง (เหมือน Canvas ใน Fusion 360) — เลือกไฟล์ หรือคัดลอกภาพแล้วกด{' '}
            <b>Ctrl+V</b> ได้เลย
          </p>
          <div className="insp-actions">
            <button onClick={() => fileRef.current?.click()}>📷 แนบภาพ</button>
            <button onClick={pasteFromClipboard} title="วางภาพที่คัดลอกไว้ (หรือกด Ctrl+V ที่หน้าจอ)">
              📋 วางจากคลิปบอร์ด
            </button>
          </div>
        </>
      )}
      {refImage && (
        <>
          <label className="insp-field">
            <span>ความทึบ {Math.round(refImage.opacity * 100)}%</span>
            <input
              type="range"
              min={5}
              max={100}
              value={Math.round(refImage.opacity * 100)}
              onChange={(e) => s().updateRefImage({ opacity: parseInt(e.target.value) / 100 })}
            />
          </label>
          <div className="insp-grid">
            <label className="insp-field">
              <span>กว้าง (ม.)</span>
              <input
                type="number"
                value={Math.round(refImage.width * 10) / 10}
                min={1}
                step={5}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  if (!Number.isNaN(v) && v > 0) s().updateRefImage({ width: v })
                }}
              />
            </label>
            <label className="insp-field">
              <span>หมุน (°)</span>
              <input
                type="number"
                value={Math.round(refImage.rotation * 10) / 10}
                step={1}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  if (!Number.isNaN(v)) s().updateRefImage({ rotation: v })
                }}
              />
            </label>
            <label className="insp-field">
              <span>X (ม.)</span>
              <input
                type="number"
                value={Math.round(refImage.x * 10) / 10}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  if (!Number.isNaN(v)) s().updateRefImage({ x: v })
                }}
              />
            </label>
            <label className="insp-field">
              <span>Y (ม.)</span>
              <input
                type="number"
                value={Math.round(refImage.y * 10) / 10}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  if (!Number.isNaN(v)) s().updateRefImage({ y: v })
                }}
              />
            </label>
          </div>
          <div className="insp-readout">
            ขนาดปัจจุบัน {fmt(refImage.width)} × {fmt(refImage.width * refImage.aspect)} ม.
            {refImage.locked ? ' · ล็อกอยู่' : ' · ลากภาพบนแผนที่เพื่อย้ายได้'}
          </div>
          <div className="insp-actions">
            <button
              className={tool.type === 'calibrate' ? 'on' : ''}
              title="คลิก 2 จุดบนภาพที่รู้ระยะจริง แล้วกรอกระยะเป็นเมตร — ภาพจะถูกปรับขนาดให้ตรงสเกลจริง"
              onClick={() =>
                s().setTool(tool.type === 'calibrate' ? { type: 'select' } : { type: 'calibrate', pts: [] })
              }
            >
              📏 ปรับสเกล
            </button>
            <button
              className={refImage.locked ? 'on' : ''}
              title="ล็อกภาพไม่ให้ถูกลากโดยบังเอิญ"
              onClick={() => s().editRefImage({ locked: !refImage.locked })}
            >
              {refImage.locked ? '🔒 ล็อก' : '🔓 ปลดล็อก'}
            </button>
            <button
              className={refImage.visible ? 'on' : ''}
              onClick={() => s().editRefImage({ visible: !refImage.visible })}
            >
              👁 แสดง
            </button>
            <button onClick={() => fileRef.current?.click()} title="เปลี่ยนรูป โดยคงตำแหน่ง/สเกลเดิมไว้">
              🔄 เปลี่ยนภาพ
            </button>
            <button onClick={pasteFromClipboard} title="วางภาพจากคลิปบอร์ดแทนรูปเดิม โดยคงตำแหน่ง/สเกลเดิมไว้ (หรือกด Ctrl+V)">
              📋 วางภาพ
            </button>
            <button
              className="danger"
              onClick={() => {
                if (confirm('ลบภาพพื้นหลัง? / Remove the aerial photo?')) s().removeRefImage()
              }}
            >
              🗑 ลบภาพ
            </button>
          </div>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) attachBlob(f)
          e.target.value = ''
        }}
      />
    </section>
  )
}
