import { notFound } from 'next/navigation'
import { readIssue, readInks } from '../../../lib/store.js'
import Editor from '../../../components/Editor.js'

export default async function IssuePage({ params }) {
  const { id } = await params
  const doc = await readIssue(id)
  if (!doc) notFound()
  return <Editor doc={doc} inks={await readInks()} />
}
