import type { Category, ObjectDef } from './types'

/**
 * Everything that can be placed INSIDE a building. Sizes are the defaults in
 * meters (w × d × h) and every one of them is editable per instance after
 * placement. Adding a type = one row here — but it must also appear in
 * CATEGORY_ORDER below or it never shows up in the palette.
 */
export const CATALOG: ObjectDef[] = [
  /* ---------------- structure & enclosure ---------------- */
  { id: 'door_main', labelTh: 'ประตูทางเข้าหลัก', labelEn: 'Main Entrance', category: 'door', w: 2.0, d: 0.3, h: 2.4, color: '#f59e0b', rule: 'edge' },
  { id: 'door_fire', labelTh: 'ประตูหนีไฟ', labelEn: 'Fire Exit', category: 'door', w: 1.5, d: 0.3, h: 2.4, color: '#ef4444', rule: 'edge' },
  { id: 'door_roller', labelTh: 'ประตูม้วน', labelEn: 'Roller Shutter', category: 'door', w: 5.0, d: 0.35, h: 5.0, color: '#94a3b8', rule: 'edge', note: 'ประตูรถเข้า-ออกโรงงาน' },
  { id: 'door_slide', labelTh: 'ประตูบานเลื่อนใหญ่', labelEn: 'Sliding Factory Door', category: 'door', w: 6.0, d: 0.35, h: 5.0, color: '#a8b3bf', rule: 'edge' },
  { id: 'door_room', labelTh: 'ประตูห้อง', labelEn: 'Room Door', category: 'door', w: 0.9, d: 0.15, h: 2.1, color: '#c9a06c', rule: 'floor' },
  { id: 'door_glass', labelTh: 'ประตูกระจก (ภายใน)', labelEn: 'Glass Door', category: 'door', w: 1.8, d: 0.15, h: 2.2, color: '#2f3237', rule: 'floor' },

  { id: 'window_wall', labelTh: 'ช่องกระจก (ผนังอาคาร)', labelEn: 'Glass Opening (facade)', category: 'window', w: 4.0, d: 0.3, h: 2.0, color: '#9ec8d8', rule: 'edge' },
  { id: 'window_part', labelTh: 'ช่องกระจก (ผนังภายใน)', labelEn: 'Glass Opening (interior)', category: 'window', w: 2.0, d: 0.15, h: 1.4, color: '#9ec8d8', rule: 'floor' },

  { id: 'partition', labelTh: 'ผนังกั้นห้อง', labelEn: 'Wall Partition', category: 'partition', w: 3.0, d: 0.15, h: 2.6, color: '#eae6dd', rule: 'floor' },
  { id: 'rail', labelTh: 'ราวกันตก', labelEn: 'Steel Railing', category: 'partition', w: 3.0, d: 0.08, h: 1.0, color: '#3e434a', rule: 'floor' },
  { id: 'column', labelTh: 'เสา', labelEn: 'Column', category: 'column', w: 0.4, d: 0.4, h: 6.0, color: '#9aa2ad', rule: 'floor' },
  { id: 'mezzanine', labelTh: 'ชั้นลอย', labelEn: 'Mezzanine Floor', category: 'mezzanine', w: 10.0, d: 6.0, h: 4.0, color: '#dcbd90', rule: 'floor', note: 'H = ระดับพื้นชั้นลอย' },
  { id: 'stairs', labelTh: 'บันได', labelEn: 'Staircase', category: 'stairs', w: 2.0, d: 5.0, h: 4.0, color: '#b0a695', rule: 'floor', note: 'H = ระดับที่ขึ้นถึง' },
  { id: 'ceiling', labelTh: 'ฝ้าเพดาน', labelEn: 'Ceiling Panel', category: 'ceiling', w: 6.0, d: 6.0, h: 3.0, color: '#f4f1e8', rule: 'floor', note: 'H = ระดับท้องฝ้า' },
  { id: 'bulkhead', labelTh: 'ฝ้าตั้ง / ผนังฝ้า', labelEn: 'Vertical Ceiling', category: 'ceiling', w: 6.0, d: 0.15, h: 3.0, color: '#f4f1e8', rule: 'floor', note: 'H = ขอบล่าง' },

  /* ---------------- 4.1 เครื่องจักรตัด / ขึ้นรูป ---------------- */
  { id: 'laser_cut', labelTh: 'เครื่องตัดเลเซอร์ไฟเบอร์ (3015)', labelEn: 'Fiber Laser Cutter', category: 'machine', w: 9.0, d: 2.6, h: 2.2, color: '#f59e0b', rule: 'floor', note: 'โต๊ะสับเปลี่ยน + chiller + ตู้ควบคุม' },
  { id: 'plasma_cut', labelTh: 'โต๊ะตัดพลาสม่า CNC', labelEn: 'CNC Plasma Table', category: 'machine', w: 4.5, d: 2.4, h: 1.6, color: '#fb923c', rule: 'floor', note: 'โต๊ะน้ำ + รางวิ่ง' },
  { id: 'shear', labelTh: 'เครื่องตัดเฉือนแผ่น', labelEn: 'Shearing Machine', category: 'machine', w: 3.4, d: 1.8, h: 1.9, color: '#64748b', rule: 'floor' },
  { id: 'press_brake', labelTh: 'เครื่องพับ (100T × 3.2 ม.)', labelEn: 'Press Brake', category: 'machine', w: 3.8, d: 1.9, h: 2.7, color: '#475569', rule: 'floor', note: 'เว้นที่ด้านหน้าให้คนรับชิ้นงาน' },
  { id: 'roller', labelTh: 'เครื่องม้วนเหล็ก (3 ลูกกลิ้ง)', labelEn: '3-Roll Bending', category: 'machine', w: 3.2, d: 1.8, h: 1.7, color: '#6b7280', rule: 'floor' },
  { id: 'bandsaw', labelTh: 'เครื่องเลื่อยสายพาน', labelEn: 'Band Saw', category: 'machine', w: 2.8, d: 1.6, h: 1.7, color: '#52525b', rule: 'floor' },
  { id: 'ironworker', labelTh: 'เครื่องปั๊ม/ตัดเหล็กรูปพรรณ', labelEn: 'Ironworker', category: 'machine', w: 1.6, d: 1.0, h: 1.9, color: '#71717a', rule: 'floor' },

  /* ---------------- 4.2 กลึง / เจาะ ---------------- */
  { id: 'lathe_cnc', labelTh: 'เครื่องกลึง CNC', labelEn: 'CNC Lathe', category: 'machine', w: 3.6, d: 1.9, h: 2.0, color: '#0ea5e9', rule: 'floor' },
  { id: 'lathe_manual', labelTh: 'เครื่องกลึงมือ', labelEn: 'Manual Lathe', category: 'machine', w: 2.6, d: 1.1, h: 1.6, color: '#38bdf8', rule: 'floor' },
  { id: 'mill_cnc', labelTh: 'เครื่องกัด / Machining Center', labelEn: 'Machining Center', category: 'machine', w: 3.2, d: 2.6, h: 2.7, color: '#0284c7', rule: 'floor' },
  { id: 'drill_radial', labelTh: 'เครื่องเจาะเรเดียล', labelEn: 'Radial Drill', category: 'machine', w: 2.2, d: 1.1, h: 2.5, color: '#475569', rule: 'floor' },
  { id: 'drill_bench', labelTh: 'เครื่องเจาะตั้งโต๊ะ', labelEn: 'Bench Drill', category: 'machine', w: 0.8, d: 0.7, h: 1.9, color: '#64748b', rule: 'floor' },
  { id: 'tapping', labelTh: 'เครื่องต๊าปเกลียว (แขนหมุน)', labelEn: 'Tapping Arm', category: 'machine', w: 1.4, d: 0.9, h: 2.0, color: '#7c8794', rule: 'floor' },
  { id: 'grinder', labelTh: 'เครื่องเจียร / ลับคม', labelEn: 'Pedestal Grinder', category: 'machine', w: 0.9, d: 0.7, h: 1.5, color: '#94a3b8', rule: 'floor' },

  /* ---------------- 4.3 เชื่อม / ประกอบ / ผิวงาน ---------------- */
  { id: 'weld_bay', labelTh: 'สถานีเชื่อม (โต๊ะ+ตู้+ฉากกั้น)', labelEn: 'Welding Bay', category: 'weld', w: 3.0, d: 2.4, h: 2.0, color: '#ea580c', rule: 'floor' },
  { id: 'welder', labelTh: 'ตู้เชื่อม', labelEn: 'Welding Machine', category: 'weld', w: 0.9, d: 0.6, h: 1.2, color: '#c2410c', rule: 'floor' },
  { id: 'fume_ext', labelTh: 'เครื่องดูดควันเชื่อม', labelEn: 'Fume Extractor', category: 'weld', w: 1.0, d: 0.8, h: 2.2, color: '#a16207', rule: 'floor' },
  { id: 'fit_table', labelTh: 'โต๊ะประกอบ / Fit-up', labelEn: 'Fit-up Table', category: 'weld', w: 3.0, d: 1.5, h: 0.9, color: '#78716c', rule: 'floor' },
  { id: 'assembly_zone', labelTh: 'โซนประกอบชิ้นงาน', labelEn: 'Assembly Zone', category: 'zone', w: 12, d: 8, h: 0.1, color: '#fcd34d', rule: 'floor' },
  { id: 'paint_booth', labelTh: 'ห้องพ่นสี', labelEn: 'Paint Booth', category: 'room', w: 9.0, d: 5.0, h: 4.0, color: '#d6d3d1', rule: 'floor' },
  { id: 'blast_booth', labelTh: 'ห้องพ่นทราย', labelEn: 'Blast Booth', category: 'room', w: 8.0, d: 5.0, h: 4.0, color: '#c7c3bd', rule: 'floor' },
  { id: 'qc_table', labelTh: 'โต๊ะตรวจสอบ QC', labelEn: 'QC Table', category: 'weld', w: 2.4, d: 1.2, h: 0.9, color: '#a8a29e', rule: 'floor' },

  /* ---------------- 4.4 ยกและขนย้าย ---------------- */
  { id: 'crane_eot', labelTh: 'เครนเหนือศีรษะ (EOT)', labelEn: 'Overhead Crane (EOT)', category: 'crane', w: 15, d: 2.5, h: 8.0, color: '#eab308', rule: 'floor', note: 'W = span, H = ระดับรางวิ่ง' },
  { id: 'crane_gantry', labelTh: 'เครนขาตั้งพื้น (Gantry)', labelEn: 'Gantry Crane', category: 'crane', w: 8.0, d: 3.0, h: 6.0, color: '#facc15', rule: 'floor' },
  { id: 'crane_jib', labelTh: 'เครนแขนหมุน (Jib)', labelEn: 'Jib Crane', category: 'crane', w: 5.0, d: 5.0, h: 4.5, color: '#ca8a04', rule: 'floor', note: 'W = รัศมีแขน × 2' },
  { id: 'forklift', labelTh: 'โฟล์คลิฟท์ (2.5 ตัน)', labelEn: 'Forklift', category: 'crane', w: 3.0, d: 1.25, h: 2.2, color: '#f97316', rule: 'floor' },
  { id: 'xlift', labelTh: 'X-Lift / Scissor Lift', labelEn: 'Scissor Lift', category: 'crane', w: 2.6, d: 1.3, h: 1.3, color: '#fb923c', rule: 'floor' },
  { id: 'pallet_jack', labelTh: 'รถลากพาเลท', labelEn: 'Pallet Jack', category: 'crane', w: 1.6, d: 0.7, h: 1.2, color: '#f59e0b', rule: 'floor' },
  { id: 'dock_leveler', labelTh: 'ชานชาลาขนถ่าย (Dock Leveler)', labelEn: 'Dock Leveler', category: 'crane', w: 2.5, d: 3.0, h: 1.2, color: '#78716c', rule: 'edge' },

  /* ---------------- 4.5 เก็บของและงานระบบ ---------------- */
  { id: 'store_room', labelTh: 'ห้องสโตร์', labelEn: 'Store Room', category: 'room', w: 6.0, d: 4.0, h: 2.8, color: '#b9b2a6', rule: 'floor' },
  { id: 'tool_crib', labelTh: 'ห้องเก็บเครื่องมือ', labelEn: 'Tool Crib', category: 'room', w: 4.0, d: 3.0, h: 2.6, color: '#a8a29e', rule: 'floor' },
  { id: 'shop_office', labelTh: 'ออฟฟิศช่างในโรงงาน', labelEn: 'Shop Office', category: 'room', w: 5.0, d: 4.0, h: 2.8, color: '#93c5fd', rule: 'floor', note: 'ห้องกระจก วางบนชั้นลอยได้' },
  { id: 'rack_cantilever', labelTh: 'แร็คแขนยื่น (เหล็กเส้น/ท่อ)', labelEn: 'Cantilever Rack', category: 'storage', w: 6.0, d: 1.2, h: 3.0, color: '#0891b2', rule: 'floor' },
  { id: 'rack_pallet', labelTh: 'แร็คพาเลท', labelEn: 'Pallet Rack', category: 'storage', w: 2.7, d: 1.1, h: 6.0, color: '#0e7490', rule: 'floor' },
  { id: 'sheet_rack', labelTh: 'ชั้นวางแผ่นเหล็ก', labelEn: 'Sheet Rack', category: 'storage', w: 3.2, d: 1.6, h: 1.4, color: '#155e75', rule: 'floor' },
  { id: 'scrap_bin', labelTh: 'ถังเศษเหล็ก', labelEn: 'Scrap Bin', category: 'storage', w: 1.8, d: 1.2, h: 1.0, color: '#7f1d1d', rule: 'floor' },
  { id: 'compressor', labelTh: 'ปั๊มลม + ถังลม', labelEn: 'Air Compressor', category: 'hvac', w: 2.4, d: 1.2, h: 1.9, color: '#0369a1', rule: 'floor' },
  { id: 'mdb_room', labelTh: 'ห้องไฟฟ้า / MDB', labelEn: 'Electrical Room / MDB', category: 'room', w: 4.0, d: 2.5, h: 2.8, color: '#fde047', rule: 'floor' },
  { id: 'gas_rack', labelTh: 'แร็คถังแก๊ส (O₂ / Argon)', labelEn: 'Gas Cylinder Rack', category: 'storage', w: 1.6, d: 0.8, h: 1.8, color: '#16a34a', rule: 'floor' },
  { id: 'fire_point', labelTh: 'จุดถังดับเพลิง / สายฉีดน้ำ', labelEn: 'Fire Point', category: 'fixture', w: 0.8, d: 0.4, h: 1.5, color: '#dc2626', rule: 'floor' },

  /* ---------------- 4.6 แสงสว่างและระบายอากาศ ---------------- */
  { id: 'fan_industrial', labelTh: 'พัดลมโรงงานตั้งพื้น', labelEn: 'Industrial Floor Fan', category: 'hvac', w: 1.0, d: 0.8, h: 2.1, color: '#374151', rule: 'floor' },
  { id: 'fan_wall', labelTh: 'พัดลมระบายอากาศติดผนัง', labelEn: 'Wall Exhaust Fan', category: 'hvac', w: 1.4, d: 0.5, h: 1.4, color: '#4b5563', rule: 'edge' },
  { id: 'bigfan', labelTh: 'พัดลม HVLS', labelEn: 'HVLS Big Fan', category: 'hvac', w: 7.0, d: 7.0, h: 7.0, color: '#6b7280', rule: 'floor', note: 'H = ระดับติดตั้ง' },
  { id: 'duct', labelTh: 'ท่อลมแอร์', labelEn: 'Air Duct Run', category: 'hvac', w: 6.0, d: 0.6, h: 3.6, color: '#b8bcc2', rule: 'floor', note: 'H = ระดับติดตั้ง' },
  { id: 'fcu', labelTh: 'คอยล์เย็น / FCU', labelEn: 'Cooling Coil / FCU', category: 'hvac', w: 1.4, d: 0.45, h: 2.6, color: '#eef0f2', rule: 'floor', note: 'H = ระดับติดตั้ง' },
  { id: 'light_floor', labelTh: 'ไฟส่องสว่างตั้งพื้น', labelEn: 'Floor Work Light', category: 'tech', w: 0.9, d: 0.9, h: 2.2, color: '#fbbf24', rule: 'floor' },
  { id: 'highbay', labelTh: 'โคมไฮเบย์', labelEn: 'UFO High-Bay Light', category: 'tech', w: 0.5, d: 0.5, h: 7.0, color: '#2f3237', rule: 'floor', note: 'H = ระดับติดตั้ง' },
  { id: 'tracklight', labelTh: 'ไฟราง', labelEn: 'Track Light', category: 'tech', w: 2.5, d: 0.15, h: 3.2, color: '#2b2f35', rule: 'floor', note: 'H = ระดับติดตั้ง' },
  { id: 'cctv', labelTh: 'กล้องวงจรปิด', labelEn: 'CCTV Camera', category: 'tech', w: 0.3, d: 0.3, h: 3.0, color: '#e8eaec', rule: 'floor', note: 'H = ระดับติดตั้ง' },
  { id: 'speaker', labelTh: 'ลำโพงประกาศ', labelEn: 'PA Speaker', category: 'tech', w: 0.35, d: 0.3, h: 2.8, color: '#23262b', rule: 'floor', note: 'H = ระดับติดตั้ง' },

  /* ---------------- 4.7 ออฟฟิศ — โต๊ะและที่นั่ง ---------------- */
  { id: 'desk_single', labelTh: 'โต๊ะทำงานเดี่ยว + เก้าอี้', labelEn: 'Single Desk', category: 'workstation', w: 1.6, d: 0.8, h: 0.75, color: '#d6bfa3', rule: 'floor' },
  { id: 'desk_pod4', labelTh: 'คลัสเตอร์โต๊ะ 4 ที่', labelEn: 'Desk Pod (4)', category: 'workstation', w: 3.2, d: 1.6, h: 0.75, color: '#cdb59a', rule: 'floor' },
  { id: 'desk_pod6', labelTh: 'คลัสเตอร์โต๊ะ 6 ที่', labelEn: 'Desk Pod (6)', category: 'workstation', w: 4.8, d: 1.6, h: 0.75, color: '#c9b193', rule: 'floor' },
  { id: 'desk_manager', labelTh: 'โต๊ะผู้จัดการ + ตู้ข้าง', labelEn: 'Manager Desk', category: 'workstation', w: 2.0, d: 1.8, h: 0.75, color: '#a1785c', rule: 'floor' },
  { id: 'desk_standing', labelTh: 'โต๊ะยืนทำงาน', labelEn: 'Standing Desk', category: 'workstation', w: 1.6, d: 0.8, h: 1.1, color: '#b98a5a', rule: 'floor' },
  { id: 'sofa_wait', labelTh: 'โซฟารับแขก', labelEn: 'Waiting Sofa', category: 'furniture', w: 2.2, d: 0.9, h: 0.8, color: '#7c8794', rule: 'floor' },
  { id: 'table_meet', labelTh: 'โต๊ะประชุม + เก้าอี้', labelEn: 'Meeting Table', category: 'workstation', w: 2.4, d: 1.2, h: 0.75, color: '#b98a5a', rule: 'floor' },
  { id: 'table_canteen', labelTh: 'โต๊ะโรงอาหาร', labelEn: 'Canteen Table', category: 'furniture', w: 1.8, d: 0.8, h: 0.75, color: '#a3a3a3', rule: 'floor' },

  /* ---------------- 4.8 ออฟฟิศ — ห้องและโซน ---------------- */
  { id: 'room_meeting', labelTh: 'ห้องประชุม', labelEn: 'Meeting Room', category: 'room', w: 6.0, d: 4.0, h: 2.7, color: '#bfdbfe', rule: 'floor' },
  { id: 'room_board', labelTh: 'ห้องประชุมใหญ่', labelEn: 'Board Room', category: 'room', w: 9.0, d: 5.0, h: 2.9, color: '#a5b4fc', rule: 'floor' },
  { id: 'room_huddle', labelTh: 'ห้องประชุมย่อย 4 ที่', labelEn: 'Huddle Room', category: 'room', w: 3.0, d: 2.5, h: 2.6, color: '#c7d2fe', rule: 'floor' },
  { id: 'booth_phone', labelTh: 'บูธโทรศัพท์', labelEn: 'Phone Booth', category: 'room', w: 1.2, d: 1.2, h: 2.2, color: '#94a3b8', rule: 'floor' },
  { id: 'room_server', labelTh: 'ห้อง Server / IT', labelEn: 'Server Room', category: 'room', w: 3.5, d: 2.5, h: 2.8, color: '#334155', rule: 'floor' },
  { id: 'room_pantry', labelTh: 'แพนทรี่', labelEn: 'Pantry', category: 'room', w: 4.0, d: 3.0, h: 2.7, color: '#fde68a', rule: 'floor' },
  { id: 'room_archive', labelTh: 'ห้องเก็บเอกสาร', labelEn: 'Archive Room', category: 'room', w: 4.0, d: 3.0, h: 2.7, color: '#d6d3d1', rule: 'floor' },
  { id: 'room_prayer', labelTh: 'ห้องละหมาด / ห้องพัก', labelEn: 'Prayer / Rest Room', category: 'room', w: 3.0, d: 3.0, h: 2.6, color: '#bbf7d0', rule: 'floor' },
  { id: 'room_locker', labelTh: 'ห้องล็อกเกอร์ / เปลี่ยนชุด', labelEn: 'Locker Room', category: 'room', w: 5.0, d: 3.0, h: 2.6, color: '#cbd5e1', rule: 'floor' },
  { id: 'room_firstaid', labelTh: 'ห้องพยาบาล', labelEn: 'First Aid Room', category: 'room', w: 3.5, d: 3.0, h: 2.6, color: '#fecaca', rule: 'floor' },
  { id: 'toilet', labelTh: 'ห้องน้ำ', labelEn: 'Restrooms', category: 'room', w: 4.0, d: 3.0, h: 2.6, color: '#7dd3fc', rule: 'floor' },
  { id: 'reception', labelTh: 'เคาน์เตอร์ต้อนรับ', labelEn: 'Reception Counter', category: 'reception', w: 3.0, d: 1.5, h: 1.1, color: '#d9995f', rule: 'floor' },
  { id: 'zone_open', labelTh: 'โซน Open Plan', labelEn: 'Open Plan Zone', category: 'zone', w: 12, d: 8, h: 0.1, color: '#86efac', rule: 'floor' },
  { id: 'zone_lounge', labelTh: 'โซนพักผ่อน / Breakout', labelEn: 'Lounge / Breakout', category: 'zone', w: 6, d: 4, h: 0.1, color: '#fca5a5', rule: 'floor' },
  { id: 'zone_canteen', labelTh: 'โซนโรงอาหาร', labelEn: 'Canteen Zone', category: 'zone', w: 10, d: 6, h: 0.1, color: '#fdba74', rule: 'floor' },
  { id: 'core_lift', labelTh: 'ปล่องลิฟต์', labelEn: 'Lift Core', category: 'room', w: 2.6, d: 2.6, h: 3.0, color: '#64748b', rule: 'floor', note: 'ทะลุหลายชั้น' },

  /* ---------------- 4.9 ออฟฟิศ — เฟอร์นิเจอร์และอุปกรณ์ ---------------- */
  { id: 'cab_file', labelTh: 'ตู้เอกสาร 4 ลิ้นชัก', labelEn: 'Filing Cabinet', category: 'furniture', w: 0.9, d: 0.5, h: 1.35, color: '#9ca3af', rule: 'floor' },
  { id: 'cab_tall', labelTh: 'ตู้สูงบานเปิด', labelEn: 'Tall Cabinet', category: 'furniture', w: 1.2, d: 0.5, h: 1.8, color: '#a8a29e', rule: 'floor' },
  { id: 'bookshelf', labelTh: 'ชั้นหนังสือ', labelEn: 'Bookshelf', category: 'furniture', w: 1.2, d: 0.35, h: 1.8, color: '#b98a5a', rule: 'floor' },
  { id: 'printer', labelTh: 'เครื่องพิมพ์ / ถ่ายเอกสาร', labelEn: 'Printer / Copier', category: 'fixture', w: 0.8, d: 0.7, h: 1.2, color: '#4b5563', rule: 'floor' },
  { id: 'water_cooler', labelTh: 'ตู้กดน้ำ', labelEn: 'Water Cooler', category: 'fixture', w: 0.4, d: 0.4, h: 1.3, color: '#38bdf8', rule: 'floor' },
  { id: 'coffee', labelTh: 'เครื่องชงกาแฟ + เคาน์เตอร์', labelEn: 'Coffee Counter', category: 'fixture', w: 1.2, d: 0.6, h: 1.4, color: '#78350f', rule: 'floor' },
  { id: 'lockers', labelTh: 'ตู้ล็อกเกอร์ (แถว)', labelEn: 'Lockers', category: 'furniture', w: 1.8, d: 0.5, h: 1.8, color: '#60a5fa', rule: 'floor' },
  { id: 'whiteboard', labelTh: 'ไวท์บอร์ด', labelEn: 'Whiteboard', category: 'fixture', w: 2.4, d: 0.1, h: 1.2, color: '#f8fafc', rule: 'floor' },
  { id: 'tv_stand', labelTh: 'จอ TV บนขาตั้ง', labelEn: 'TV on Stand', category: 'fixture', w: 1.6, d: 0.5, h: 1.8, color: '#1f2937', rule: 'floor' },
  { id: 'plant', labelTh: 'กระถางต้นไม้', labelEn: 'Potted Plant', category: 'furniture', w: 0.6, d: 0.6, h: 1.4, color: '#16a34a', rule: 'floor' },
  { id: 'signage', labelTh: 'ป้ายตัวอักษรหน้าอาคาร', labelEn: 'Facade Signage', category: 'fixture', w: 6, d: 0.12, h: 0.9, color: '#2f3237', rule: 'edge' },
  { id: 'person', labelTh: 'คน', labelEn: 'Person', category: 'person', w: 0.5, d: 0.4, h: 1.7, color: '#3b82f6', rule: 'floor' },
]

export const defById = (id: string): ObjectDef | undefined => CATALOG.find((d) => d.id === id)

export const CATEGORY_LABELS: Record<Category, string> = {
  machine: 'เครื่องจักร',
  weld: 'เชื่อม / ประกอบ',
  crane: 'เครนและขนย้าย',
  storage: 'แร็คและที่เก็บของ',
  workstation: 'โต๊ะทำงาน',
  room: 'ห้อง',
  zone: 'โซน',
  reception: 'ต้อนรับ',
  furniture: 'เฟอร์นิเจอร์',
  fixture: 'อุปกรณ์',
  partition: 'ผนังกั้น',
  column: 'เสา',
  mezzanine: 'ชั้นลอย',
  stairs: 'บันได',
  ceiling: 'ฝ้าเพดาน',
  hvac: 'ลม / แอร์',
  tech: 'ไฟและระบบ',
  door: 'ประตู',
  window: 'ช่องกระจก',
  person: 'คน',
}

/**
 * Palette order. An item whose category is missing here never appears —
 * the single most expensive mistake carried over from the gym planner.
 */
export const CATEGORY_ORDER: Category[] = [
  'machine',
  'weld',
  'crane',
  'storage',
  'workstation',
  'room',
  'zone',
  'reception',
  'furniture',
  'fixture',
  'partition',
  'column',
  'mezzanine',
  'stairs',
  'ceiling',
  'hvac',
  'tech',
  'door',
  'window',
  'person',
]

/** Items that are a fixed module: no resize arrows, no size fields. */
export const FIXED_SIZE_DEFS = new Set<string>([])

/** Categories drawn as a flat floor patch rather than a solid block. */
export const FLAT_CATEGORIES = new Set<Category>(['zone'])
