import { readFileSync } from 'node:fs';
import { updateProjectSchema } from './src/modules/projects/projects.schema';

const raw = JSON.parse(readFileSync('/tmp/proj.json', 'utf8')).project;
const payload = {
  name: raw.name,
  width: raw.width,
  height: raw.height,
  pages: raw.pages,
  meta: raw.meta,
};
const r = updateProjectSchema.safeParse(payload);
console.log('VALID:', r.success);
if (!r.success) {
  const flat = r.error.flatten();
  console.log('\n=== formErrors ===');
  console.log(flat.formErrors);
  console.log('\n=== top-level fieldErrors keys ===');
  console.log(Object.keys(flat.fieldErrors));
  console.log('\n=== full issues (path -> message) ===');
  for (const iss of r.error.issues) {
    console.log(`  ${iss.path.join('.') || '<root>'}  →  ${iss.message}`);
  }
}
