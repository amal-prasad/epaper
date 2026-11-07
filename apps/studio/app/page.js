import { redirect } from 'next/navigation'

// ponytail: Home (v6) is a later slice; until then the app opens the sample issue.
export default function Home() { redirect('/issue/sample') }
