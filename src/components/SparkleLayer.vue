<script setup lang="ts">
// A few gold and red sparkles flashing now and then behind every page, mostly near the top and the edges so they stay off the text.
// Only opacity and transform animate (cheap on phones), and they hold still for people who turned on "reduce motion".
// Each one flashes briefly once per cycle (t = 10–15 s), staggered by d so they never flash together
const SPARKS=[
  {x:1,y:1,s:16,d:0,t:12,c:'g'},{x:74,y:5,s:21,d:4,t:14,c:'g'},{x:90,y:13,s:13,d:8,t:11,c:'r'},
  {x:3,y:28,s:13,d:2,t:15,c:'g'},{x:95,y:34,s:16,d:6.5,t:13,c:'g'},{x:4,y:74,s:16,d:10,t:12.5,c:'g'},
]
</script>
<template><div class="sparkles" aria-hidden="true"><i v-for="(p,i) in SPARKS" :key="i" :class="p.c" :style="{left:`${p.x}%`,top:`${p.y}%`,'--z':`${p.s}px`,animationDelay:`${p.d}s`,animationDuration:`${p.t}s`}"></i></div></template>
<style scoped>
.sparkles{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden}
.sparkles i{position:absolute;width:var(--z);height:var(--z);opacity:0;will-change:opacity,transform;animation:twinkle 3s ease-in-out infinite}
/* A soft glow (gradient, no filter) under a four-point star */
.sparkles i::before{content:"";position:absolute;inset:-75%;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,currentColor 40%,transparent) 0,transparent 62%)}
.sparkles i::after{content:"";position:absolute;inset:0;background:currentColor;clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%)}
.sparkles i.g{color:#f5b301}.sparkles i.r{color:#ef4444}
@keyframes twinkle{0%,100%{opacity:0;transform:scale(.3) rotate(0)}6%{opacity:1;transform:scale(1) rotate(45deg)}12%{opacity:0;transform:scale(.3) rotate(90deg)}}
@media (prefers-reduced-motion:reduce){.sparkles i{animation:none;opacity:.45}}
</style>
