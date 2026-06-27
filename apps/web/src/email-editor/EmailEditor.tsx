import { EmailSidebar } from './EmailSidebar'
import { EmailPreview } from './EmailPreview'

export default function EmailEditor() {
  return (
    <div className="flex h-full">
      <EmailSidebar />
      <EmailPreview />
    </div>
  )
}
