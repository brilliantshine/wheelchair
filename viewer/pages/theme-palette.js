'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.wcThemePalette = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const PRESETS = [
  {
    "id": "default",
    "label": "Wheelchair Default",
    "swatches": [
      "#18212c",
      "#5b9dd9",
      "#354a60"
    ],
    "defaultAccent": "#5b9dd9",
    "dark": {
      "--bg": "#14161a",
      "--panel": "#1c1f25",
      "--panel-2": "#23262d",
      "--panel-3": "#181a1e",
      "--band": "#161a20",
      "--line": "#2a2f38",
      "--line-2": "#3a3f48",
      "--ink": "#e6e8ec",
      "--ink-2": "#c5cad3",
      "--dim": "#8b929e",
      "--figure": "#111316",
      "--code-bg": "#23262d",
      "--idle": "#6b7280"
    },
    "light": {
      "--bg": "#f6f7f9",
      "--panel": "#ffffff",
      "--panel-2": "#edf0f4",
      "--panel-3": "#f2f4f7",
      "--band": "#eef1f5",
      "--line": "#d8dee6",
      "--line-2": "#bfc8d4",
      "--ink": "#161b22",
      "--ink-2": "#3d4754",
      "--dim": "#576371",
      "--figure": "#e7ecf2",
      "--code-bg": "#edf0f4",
      "--idle": "#64707d"
    }
  },
  {
    "id": "midnight",
    "label": "Midnight",
    "swatches": [
      "#101725",
      "#8294e8",
      "#303b61"
    ],
    "defaultAccent": "#8294e8",
    "dark": {
      "--bg": "#101522",
      "--panel": "#171e2f",
      "--panel-2": "#1f273c",
      "--panel-3": "#131928",
      "--band": "#121827",
      "--line": "#27314a",
      "--line-2": "#374464",
      "--ink": "#e7ebf5",
      "--ink-2": "#c4cce0",
      "--dim": "#8d98b3",
      "--figure": "#0c101b",
      "--code-bg": "#1f273c",
      "--idle": "#6d7896"
    },
    "light": {
      "--bg": "#f5f7fc",
      "--panel": "#ffffff",
      "--panel-2": "#ebeefa",
      "--panel-3": "#f0f3fb",
      "--band": "#edf0f9",
      "--line": "#d5dcef",
      "--line-2": "#bcc7e2",
      "--ink": "#151b2b",
      "--ink-2": "#39435c",
      "--dim": "#545f7a",
      "--figure": "#e4e9f7",
      "--code-bg": "#ebeefa",
      "--idle": "#646f8a"
    }
  },
  {
    "id": "forest",
    "label": "Forest",
    "swatches": [
      "#14251e",
      "#10b981",
      "#365848"
    ],
    "defaultAccent": "#10b981",
    "dark": {
      "--bg": "#111c17",
      "--panel": "#17261f",
      "--panel-2": "#1e3128",
      "--panel-3": "#14201b",
      "--band": "#131f1a",
      "--line": "#273d33",
      "--line-2": "#365346",
      "--ink": "#e6efe9",
      "--ink-2": "#c2d4c9",
      "--dim": "#89a193",
      "--figure": "#0d1612",
      "--code-bg": "#1e3128",
      "--idle": "#6b8275"
    },
    "light": {
      "--bg": "#f7f8f7",
      "--panel": "#ffffff",
      "--panel-2": "#edf1ee",
      "--panel-3": "#f2f5f3",
      "--band": "#eef2ef",
      "--line": "#dce3de",
      "--line-2": "#c4d0c7",
      "--ink": "#18231c",
      "--ink-2": "#3e4d43",
      "--dim": "#55645a",
      "--figure": "#e4ebe6",
      "--code-bg": "#edf1ee",
      "--idle": "#637368"
    }
  },
  {
    "id": "amber",
    "label": "Amber",
    "swatches": [
      "#2c2418",
      "#e5a63a",
      "#705831"
    ],
    "defaultAccent": "#e5a63a",
    "dark": {
      "--bg": "#1b1712",
      "--panel": "#252019",
      "--panel-2": "#2f2820",
      "--panel-3": "#201b15",
      "--band": "#1e1913",
      "--line": "#3d3428",
      "--line-2": "#524636",
      "--ink": "#f0ebe3",
      "--ink-2": "#d3c9ba",
      "--dim": "#a49784",
      "--figure": "#15120e",
      "--code-bg": "#2f2820",
      "--idle": "#807464"
    },
    "light": {
      "--bg": "#faf7f2",
      "--panel": "#ffffff",
      "--panel-2": "#f2ece2",
      "--panel-3": "#f6f1e9",
      "--band": "#f3ede3",
      "--line": "#e3d9ca",
      "--line-2": "#cfc1ac",
      "--ink": "#231d15",
      "--ink-2": "#4d4234",
      "--dim": "#665847",
      "--figure": "#ebe3d5",
      "--code-bg": "#f2ece2",
      "--idle": "#756858"
    }
  },
  {
    "id": "rose",
    "label": "Rose",
    "swatches": [
      "#291d22",
      "#e06c75",
      "#704650"
    ],
    "defaultAccent": "#e06c75",
    "dark": {
      "--bg": "#1b1418",
      "--panel": "#261c21",
      "--panel-2": "#31242b",
      "--panel-3": "#20181c",
      "--band": "#1e161a",
      "--line": "#402e37",
      "--line-2": "#573f4b",
      "--ink": "#f2e9ed",
      "--ink-2": "#d6c3cc",
      "--dim": "#a8909c",
      "--figure": "#151013",
      "--code-bg": "#31242b",
      "--idle": "#846e79"
    },
    "light": {
      "--bg": "#fbf6f7",
      "--panel": "#ffffff",
      "--panel-2": "#f4eaec",
      "--panel-3": "#f7eff1",
      "--band": "#f4ebed",
      "--line": "#e5d5d9",
      "--line-2": "#d2bcc2",
      "--ink": "#26181d",
      "--ink-2": "#523b43",
      "--dim": "#6b515a",
      "--figure": "#ede0e3",
      "--code-bg": "#f4eaec",
      "--idle": "#7a6069"
    }
  },
  {
    "id": "slate",
    "label": "Slate",
    "swatches": [
      "#20262c",
      "#94a3b8",
      "#4e5a69"
    ],
    "defaultAccent": "#94a3b8",
    "dark": {
      "--bg": "#16191d",
      "--panel": "#1f242a",
      "--panel-2": "#272d35",
      "--panel-3": "#1a1e23",
      "--band": "#181c21",
      "--line": "#303741",
      "--line-2": "#414a57",
      "--ink": "#e7eaee",
      "--ink-2": "#c5cbd3",
      "--dim": "#8f98a4",
      "--figure": "#111417",
      "--code-bg": "#272d35",
      "--idle": "#6e7784"
    },
    "light": {
      "--bg": "#f5f6f8",
      "--panel": "#ffffff",
      "--panel-2": "#eceff3",
      "--panel-3": "#f1f3f6",
      "--band": "#edeff3",
      "--line": "#d7dde5",
      "--line-2": "#bfc7d2",
      "--ink": "#181d23",
      "--ink-2": "#3e4652",
      "--dim": "#586270",
      "--figure": "#e5e9ef",
      "--code-bg": "#eceff3",
      "--idle": "#66707e"
    }
  }
];
  const QUICK_ACCENTS = ['#5b9dd9', '#10b981', '#d6a53b', '#e06c75', '#a78bfa', '#94a3b8'];
  const status = {
    dark: ['#4ea87b','#0c1410','#172019','#3f7a5c','#1d2a23','#8fd0ad','#d9a441','#241f15','#5c4a24','#1a1813','#c4645f','#e09a96','#2a1a19','#0c0e10'],
    light: ['#197a48','#ffffff','#e8f5ee','#8bc9a8','#eef8f2','#15693e','#7c5000','#fdf5e6','#e2c27d','#faf4e8','#c23b3b','#a32626','#fdeeee',null],
  };
  const statusKeys = ['good','good-ink','good-bg','good-line','good-soft','good-text','warn','warn-bg','warn-line','warn-tint','bad','bad-text','bad-bg','term-bg'];
  function parseHexColor(input) {
    if (typeof input !== 'string') return null;
    const m = /^#?([a-f0-9]{3}|[a-f0-9]{6})$/i.exec(input.trim());
    if (!m) return null;
    const value = m[1].toLowerCase(); return '#' + (value.length === 3 ? [...value].map(x => x + x).join('') : value);
  }
  function rgb(hex) { return [1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
  function hex(rgbValues) { return '#' + rgbValues.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); }
  function luminance(color) { const c = rgb(color).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]; }
  function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }
  function pickContrastInk(bg) { const dark = contrast(bg, '#0e1114'), white = contrast(bg, '#ffffff'); return dark >= 4.5 && dark >= white ? '#0e1114' : contrast(bg, '#000000') >= white ? '#000000' : '#ffffff'; }
  function mix(a, b, weight) { const x = rgb(a), y = rgb(b); return hex(x.map((v,i) => v*weight+y[i]*(1-weight))); }
  function hsl(color) { const [r,g,b] = rgb(color).map(x=>x/255), max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min, l=(max+min)/2; let h=0; if (d) { if(max===r) h=((g-b)/d)%6; else if(max===g) h=(b-r)/d+2; else h=(r-g)/d+4; h=(h*60+360)%360; } return [h,d ? d/(1-Math.abs(2*l-1)) : 0,l]; }
  function fromHsl(h,s,l) { const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2; const v=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x]; return hex(v.map(n=>(n+m)*255)); }
  function adjust(color, delta) { const [h,s,l]=hsl(color); return fromHsl(h,s,Math.max(0,Math.min(1,l+delta))); }
  function accessible(color, surfaces, floor, mode, fallback) { if (surfaces.every(s => contrast(color,s)>=floor)) return color; const [h,s,l]=hsl(color), direction=mode==='dark'?1:-1; for (let n=1;n<=1000;n++) { const candidate=fromHsl(h,s,Math.max(0,Math.min(1,l+direction*n/1000))); if (surfaces.every(x=>contrast(candidate,x)>=floor)) return candidate; } return fallback; }
  function cappedMix(accent, base, weight, foregrounds) { for (let w=weight;w>=-0.00001;w-=0.01) { const result=mix(accent,base,Math.max(0,w)); if (foregrounds.every(x=>contrast(x,result)>=4.5)) return result; } return base; }
  function deriveAccent(color, mode, surfaces, presetId) {
    const accent=parseHexColor(color) || '#5b9dd9';
    if (presetId==='default' && mode==='dark' && accent==='#5b9dd9') return Object.fromEntries(Object.entries({accent:'#5b9dd9','accent-ink':'#0e1114','accent-hover':'#a9cdf0','accent-hover-ink':'#0e1114','accent-vis':'#5b9dd9','accent-soft':'#1a2230','accent-line':'#3a5778','accent-text':'#7fb4e6','accent-hi':'#a9cdf0','accent-chip':'#1f2b3a',human:'#23303f'}).map(([k,v])=>['--'+k,v]));
    const dark=mode==='dark', st=Object.fromEntries(statusKeys.map((k,i)=>['--'+k,status[mode][i]]));
    const l=hsl(accent)[2], delta=dark ? (l>=0.92 ? -0.08 : 0.08) : (l<=0.08 ? 0.08 : -0.08), hover=adjust(accent,delta);
    const soft=cappedMix(accent,surfaces['--panel'],dark?0.14:0.10,[surfaces['--ink'],surfaces['--dim'],st['--warn'],st['--good-text'],st['--bad-text']]);
    const chip=mix(accent,surfaces['--panel'],dark?0.20:0.14), human=cappedMix(accent,surfaces['--panel-2'],dark?0.16:0.12,[surfaces['--ink'],surfaces['--ink-2']]);
    const textSurfaces=[surfaces['--bg'],surfaces['--panel'],surfaces['--panel-2'],soft,chip,human];
    const text=accessible(accent,textSurfaces,4.5,mode,surfaces['--ink']);
    const hi=accessible(adjust(text,dark?0.08:-0.08),textSurfaces,4.5,mode,surfaces['--ink']);
    const vis=accessible(accent,[surfaces['--bg'],surfaces['--panel'],surfaces['--panel-2'],surfaces['--panel-3'],surfaces['--figure'],surfaces['--line-2'],soft],3,mode,surfaces['--ink']);
    return {'--accent':accent,'--accent-ink':pickContrastInk(accent),'--accent-hover':hover,'--accent-hover-ink':pickContrastInk(hover),'--accent-soft':soft,'--accent-line':mix(accent,surfaces['--line'],dark?0.42:0.38),'--accent-chip':chip,'--accent-vis':vis,'--human':human,'--accent-text':text,'--accent-hi':hi};
  }
  function buildSpinnerUrls(ink,idle,accentVis) {
    const encode=c=>c.replace('#','%23'); const [i,d,a]=[ink,idle,accentVis].map(encode);
    function build(wheel,caster) { return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' fill='none' stroke-linecap='round' stroke-linejoin='round'%3E %3Cstyle%3E @keyframes spin { to { transform: rotate(360deg) } } .wheel { transform-box: view-box; transform-origin: 26px 42px; animation: spin ${wheel}s linear infinite } .caster { transform-box: view-box; transform-origin: 52px 57px; animation: spin ${caster}s linear infinite } @media (prefers-reduced-motion: reduce) { .wheel { animation-duration: 4s } .caster { animation-duration: 1.3s } } %3C/style%3E %3Cg class='wheel'%3E %3Ccircle cx='26' cy='42' r='17' stroke='${i}' stroke-width='3.5'/%3E %3Cpath d='M26 25v34M11.3 33.5l29.4 17M11.3 50.5l29.4-17' stroke='${d}' stroke-width='1.8'/%3E %3Cpath d='M26 25A17 17 0 0 1 43 42' stroke='${a}' stroke-width='4'/%3E %3Ccircle cx='26' cy='42' r='2.6' fill='${i}'/%3E %3C/g%3E %3Cg class='caster'%3E %3Ccircle cx='52' cy='57' r='3.6' stroke='${i}' stroke-width='2.4'/%3E %3Cpath d='M52 53.4v1.4' stroke='${a}' stroke-width='2.4'/%3E %3C/g%3E %3Cpath d='M13 6l4 2 5 22h22l2 16h8M46 46l5 7.5' stroke='${i}' stroke-width='3.5'/%3E %3C/svg%3E")`; }
    return {'--spinner-svg':build(1.2,0.4),'--spinner-svg-reduced':build(4,1.3)};
  }
  function resolveTheme(theme, prefersLight) {
    theme=theme || {}; const mode=['dark','light','system'].includes(theme.mode)?theme.mode:'dark', preset=PRESETS.find(p=>p.id===theme.preset)||PRESETS[0], accent=theme.accent===null?null:(parseHexColor(theme.accent)||null), resolvedMode=mode==='system'?(prefersLight?'light':'dark'):mode, effectiveAccent=accent||preset.defaultAccent;
    const surfaces=preset[resolvedMode], semantic=Object.fromEntries(statusKeys.map((k,i)=>['--'+k,status[resolvedMode][i]||surfaces['--figure']]));
    const vars={...surfaces,...semantic,...deriveAccent(effectiveAccent,resolvedMode,surfaces,preset.id)}; Object.assign(vars,buildSpinnerUrls(vars['--ink'],vars['--idle'],vars['--accent-vis']));
    return {mode,preset:preset.id,accent,resolvedMode,effectiveAccent,vars};
  }
  return { PRESETS, QUICK_ACCENTS, parseHexColor, pickContrastInk, deriveAccent, buildSpinnerUrls, resolveTheme, luminance, contrast };
});
