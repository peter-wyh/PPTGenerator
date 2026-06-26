import { useParams } from 'react-router-dom'
import Editor from '../editor/Editor'

export default function ProjectShell() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <div className="p-6 text-red-600">缺少项目 id</div>
  return <Editor projectId={id} />
}
