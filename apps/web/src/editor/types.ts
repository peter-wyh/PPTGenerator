import type { ResizeDir } from '@ppt-generator/shared'

export type {
  ResizeDir,
  TextData,
  ImageData,
  EditorComponent,
  EditorPage,
} from '@ppt-generator/shared'

// 临时拖拽态（放 useRef，不进 store）
export interface DragState {
  type: 'move' | 'resize'
  id: string
  dir?: ResizeDir
  startX: number
  startY: number
  origin: { x: number; y: number; w: number; h: number }
}
