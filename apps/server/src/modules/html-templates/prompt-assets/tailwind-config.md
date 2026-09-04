═══ TAILWIND CONFIG ═══
Extend tailwind.config with brand color tokens from the design guide. Read the hex values from the design guide and inject them:
<script>tailwind.config = { theme: { extend: { colors: {
  'brand-primary': '<EXACT hex from design guide>',
  'grey-primary': '<EXACT hex from design guide>',
  'grey-secondary': '<EXACT hex from design guide>',
  'grey-tertiary': '<EXACT hex from design guide>',
  'bg-layout': '<EXACT hex from design guide>',
  'bg-card': '<EXACT hex from design guide>',
  'stroke-card': '<EXACT hex from design guide>',
} } } };</script>
