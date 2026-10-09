<script setup lang="ts">
// A few gold and red sparkles twinkling behind every page, mostly near the top and the edges so they stay off the text.
// Only opacity and transform animate (cheap on phones), and they hold still for people who turned on "reduce motion".
const SPARKS=[
  {x:1,y:1,s:16,d:0,t:3.4,c:'g'},{x:22,y:9,s:11,d:1.2,t:2.8,c:'r'},{x:46,y:1,s:14,d:2.1,t:3.8,c:'g'},
  {x:58,y:11,s:10,d:.6,t:2.6,c:'g'},{x:74,y:5,s:21,d:1.8,t:4.2,c:'g'},{x:90,y:13,s:13,d:.3,t:3.1,c:'r'},
  {x:3,y:28,s:13,d:2.6,t:3.6,c:'g'},{x:95,y:34,s:16,d:1,t:3.9,c:'g'},{x:2,y:52,s:10,d:.9,t:2.9,c:'r'},
  {x:96,y:58,s:11,d:2.3,t:3.3,c:'g'},{x:4,y:74,s:16,d:1.5,t:4,c:'g'},{x:93,y:80,s:13,d:.2,t:3.5,c:'r'},
  {x:48,y:19,s:8,d:3,t:2.7,c:'r'},{x:83,y:22,s:10,d:2.8,t:3,c:'g'},
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
@keyframes twinkle{0%,100%{opacity:0;transform:scale(.3) rotate(0)}50%{opacity:1;transform:scale(1) rotate(45deg)}}
@media (prefers-reduced-motion:reduce){.sparkles i{animation:none;opacity:.45}}
</style>
