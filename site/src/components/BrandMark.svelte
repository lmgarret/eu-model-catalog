<!-- The site logo: a leaf-shaped tile holding a grid of the EU's stars, one of them picked out. -->
<script lang="ts">
  let { size = 24 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" class="shrink-0">
  <path d="M4 28V12C4 7.6 7.6 4 12 4h16v16c0 4.4-3.6 8-8 8z" fill="var(--brand)" />
  <g fill="#fff">
    <circle cx="11" cy="11" r="1.8" />
    <circle cx="16.5" cy="11" r="1.8" />
    <circle cx="22" cy="11" r="1.8" fill="#ffd400" />
    <circle cx="11" cy="16.5" r="1.8" />
    <circle cx="16.5" cy="16.5" r="1.8" />
    <circle cx="22" cy="16.5" r="1.8" />
    <circle cx="11" cy="22" r="1.8" />
    <circle cx="16.5" cy="22" r="1.8" />
  </g>
</svg>
