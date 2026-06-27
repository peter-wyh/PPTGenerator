import type { FC } from 'react'
import type { TableData } from '@ppt-generator/shared'
import type { BlockDef } from './types'

const TableBlock: FC<{ data: unknown }> = ({ data }) => {
  const d = data as TableData
  const headers = d.headers ?? []
  const rows = d.rows ?? []
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <table className="h-full w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-neutral-50">
            {headers.map((h, i) => (
              <th
                key={i}
                className={`border-b border-neutral-200 px-3 py-2 font-semibold text-neutral-500 ${i === 0 ? 'text-left' : 'text-right'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 1 ? 'bg-neutral-50' : ''}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`border-b border-neutral-100 px-3 py-2 ${ci === 0 ? 'text-left font-medium' : 'text-right font-mono'}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const tableBlock: BlockDef = {
  label: '表格',
  defaultSize: { w: 420, h: 200 },
  defaultData: () => ({ headers: ['列1', '列2', '列3'], rows: [['--', '--', '--'], ['--', '--', '--']] }),
  Block: TableBlock,
  propertySchema: [{ key: 'table', label: '表格', kind: 'table' }],
}
