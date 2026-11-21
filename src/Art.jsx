import React from 'react';

export function Leaf({ className = '', ...props }) {
  return <svg viewBox="0 0 40 40" fill="none" className={className} {...props}><path d="M10 32C13 17 21 8 33 6c2 15-5 24-18 22" fill="#91a176" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"/><path d="M11 33 26 15M17 24l-1-7m6 2 7-1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}

function Books({ x = 0, y = 0 }) {
  return <g transform={`translate(${x} ${y})`}><path d="M0 0v-33l9 5V5z" fill="#9fa8a2"/><path d="M12 6v-41l8 4v41z" fill="#b7a38b"/><path d="m24 12 8-32 8 6-8 31z" fill="#919c77"/><path d="M3-24 7-22M15-24l3 1M28 2l7 4" stroke="#eee5c8" strokeWidth="2"/></g>;
}

export function Furniture({ type, custom }) {
  const common = { stroke: '#67705a', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' };
  let art;
  switch (type) {
    case 'sofa': art = <>
      <ellipse cx="-3" cy="14" rx="111" ry="24" fill="#797859" opacity=".12" stroke="none"/>
      <path d="m-90-23-4 23 10 5 5-22M47 32l1 17 10-4 4-24" fill="#b5936f"/>
      <path d="M-102-70v-40q0-20 19-12L52-54q17 8 14 25v48L38 36-99-33z" fill="#91a17f"/>
      <path d="m-96-73 42-25L81-29 38-3z" fill="#c0c8a5"/>
      <path d="M-96-73v39L38 35V-3z" fill="#a8b88e"/>
      <path d="m38-3 43-26V9L38 35z" fill="#8e9e77"/>
      <path d="m-51-94 2 32M-17-53l39 20M-73-66l52 26" stroke="#83936f" strokeWidth="1.8"/>
      <path d="M-111-79q-1-15 11-12l25 13q9 4 9 17v25l-15 8-25-13z" fill="#b2bf99"/>
      <path d="m-111-79 27 14q7 4 7 16v21M-84-65l16-9" fill="none"/>
      <path d="M28-9q-2-14 9-18l24-12q15-6 17 7v29L42 17 29 9z" fill="#bdc9a7"/>
      <path d="m29-9 14 8 35-21M43-1v18" fill="none"/>
      <path d="m-70-98 22-9 29 16-4 27-31-15z" fill="#e5c48c"/>
      <path d="m-63-96 7 4m4-1 10 20m3-18 8 4" stroke="#c6a569" strokeWidth="1.5"/>
      <path d="m-3-65 19-14 28 14-6 30-28-12z" fill="#eee8d2"/>
      <path d="m7-63 21 11m-11-19 15 9" stroke="#d9d1b5" strokeWidth="1.5"/>
    </>; break;
    case 'chair': art = <>
      <ellipse cx="0" cy="12" rx="50" ry="14" fill="#797859" opacity=".12" stroke="none"/>
      <path d="m-32-20-5 37 9 4 8-35M26-10l4 28 9-5-2-33" fill="#ae8c66"/>
      <path d="M-37-44v-54q-1-15 13-19l44-4q15-1 20 12l9 59-17 31z" fill="#c69a6c"/>
      <path d="M-27-49v-46q0-10 11-11l33-4q9 0 12 10l8 45z" fill="#dfbc88"/>
      <path d="m-38-45 36-18 48 26-37 24z" fill="#e6c794"/>
      <path d="m-38-45 1 25L8 3l38-20v-20L9-13z" fill="#cda578"/>
      <path d="M-44-54q0-10 9-9l13 7 1 27-14 6-10-7zM31-25v-28q1-9 11-10l11 6v29L40-18z" fill="#d6b180"/>
      <path d="m-20-89 44-5m-42 14 43-5m-36 39 27 14" stroke="#c3a374" strokeWidth="1.5"/>
    </>; break;
    case 'table': art = <>
      <ellipse cx="0" cy="6" rx="76" ry="15" fill="#797859" opacity=".1" stroke="none"/>
      <path d="M-53-48v47q1 8 10 3l7-42M41-42v48q0 7 9 2l5-46M-1-26v42l9 3 6-48" fill="#ac8864"/>
      <path d="M-78-62q-4-16 17-26 50-23 110 3 31 13 28 30-2 27-67 31-59-1-81-22z" fill="#bfa077"/>
      <ellipse cx="0" cy="-63" rx="79" ry="32" fill="#dec397"/>
      <path d="M-59-71q48-20 106-2M-51-55q55 15 96-1M-15-85l-12 9m59 30 10-4" fill="none" stroke="#c7aa80" strokeWidth="1.6"/>
      <path d="m-31-72 25-11 24 12-25 12z" fill="#e9dfc2" strokeWidth="1.5"/>
      <ellipse cx="24" cy="-65" rx="13" ry="7" fill="#ece7ce" strokeWidth="1.5"/>
      <path d="M14-68v-13q10-8 20 0v13q-9 9-20 0M34-79q13 0 5 10h-5" fill="#f5efda" strokeWidth="1.7"/>
      <ellipse cx="24" cy="-81" rx="10" ry="4" fill="#a18a66" strokeWidth="1.5"/>
      <path d="M23-93q-6-7 1-12" fill="none" stroke="#a9a78b" strokeWidth="1.5"/>
    </>; break;
    case 'shelf': art = <>
      <path d="m-72-28-2 24 9 4 6-22M48 27v24l10-4 4-28" fill="#a28260"/>
      <path d="m-78-185 25-15 127 66v158L49 40-78-26z" fill="#ac8c66"/>
      <path d="m-68-171 115 59V24L-68-35z" fill="#c7b08a"/>
      <path d="m-60-166 1 128 106 55v-129z" fill="#d7c4a0"/>
      <path d="m-78-185 127 66 25-15M49-119V40" fill="none"/>
      <path d="m-68-123 115 60v10l-115-60zM-68-76 115 60v10L-68-66z" fill="#b4946c"/>
      <Books x={-52} y={-128}/><Books x={1} y={-101}/><Books x={-51} y={-35}/>
      <path d="m-42-83 24 12 8-5-24-13z" fill="#e1d9ba"/><path d="m-42-87 24 12 8-5-24-13z" fill="#8d9c81"/>
      <path d="M7-26v-22q13-1 23 12v23z" fill="#b6b58d"/><path d="M17-45q-14-13-7-24 17 5 14 18M20-46q14-13 21-3-4 14-18 7" fill="#819269"/>
      <path d="m-73-174 1 141M54-109v137" stroke="#e5ce9e" strokeWidth="1.3"/>
    </>; break;
    case 'plant': art = <>
      <ellipse cx="0" cy="5" rx="34" ry="10" fill="#797859" opacity=".12" stroke="none"/>
      <path d="M-30-42-22-4q20 15 43 0l9-38" fill="#d2b48d"/><ellipse cy="-42" rx="30" ry="12" fill="#e4caa2"/><ellipse cy="-44" rx="23" ry="7" fill="#8c805c"/>
      <path d="M0-44q-6-43-1-76M1-68q24-26 23-43M-2-80q-22-18-25-37M-1-58q-23-18-30-16M1-92q9-17 15-20" fill="none" strokeWidth="3"/>
      <path d="M-1-102q-37-5-30-41 33 1 30 41zM2-97q3-36 36-28-1 31-36 28zM-4-75q-37 5-40-21 27-17 40 21zM9-70q10-33 38-17-8 28-38 17zM-4-54q-32 8-32-13 18-16 32 13zM0-119q-16-29 7-40 21 21-7 40z" fill="#8b9e6d"/>
      <path d="m-25-131 21 26M8-101l22-17M-34-92l25 15M16-73l23-9M2-124l3-24" fill="none" stroke="#6f8356" strokeWidth="1.7"/>
      <path d="m-17-26 3 20m11-17 1 21m13-22-2 20" stroke="#b89b78" strokeWidth="1.5"/>
    </>; break;
    case 'fern': art = <>
      <path d="m-29-40 7 36q23 14 44 0l7-36" fill="#b39e7c"/><ellipse cy="-40" rx="29" ry="11" fill="#d5c09a"/>
      <path d="M0-42q-27-39-46-26M0-41q23-43 44-29M-1-40q-10-50-27-54M1-41q11-50 29-56M0-40v-68" fill="none" stroke="#6e825a" strokeWidth="3"/>
      {Array.from({length: 6}, (_, i) => <g key={i} transform={`rotate(${i*28-70} 0 -43)`}><path d="M0-43q-18-18-13-30Q1-67 0-43M0-59q15-7 14-23Q-1-78 0-59M0-73q-11-14-7-24Q4-88 0-73M0-84q12-9 6-21-8 6-6 21" fill={i%2 ? '#98a87a' : '#849769'} strokeWidth="1.4"/></g>)}
    </>; break;
    case 'lamp': art = <>
      <ellipse cy="0" rx="30" ry="10" fill="#aa9975"/><ellipse cy="-5" rx="29" ry="10" fill="#c7b68e"/>
      <path d="M-3-8v-132h7V-8" fill="#a18f6e"/>
      <path d="m-40-100 17-62q22-10 45 0l18 62q-36 18-80 0" fill="#ecdbac"/><ellipse cy="-100" rx="40" ry="12" fill="#e2ca96"/>
      <path d="m-14-153-9 51m25-51v51m14-51 10 51" stroke="#d3bc88" strokeWidth="1.5"/>
      <path d="M28-96v35" strokeWidth="1.4"/><circle cx="28" cy="-58" r="3" fill="#a18f6e"/>
    </>; break;
    case 'rug': art = <>
      <path d="M-137-31Q-145-45-120-53l106-57q13-6 29 2l124 64q16 9-2 20L20 40q-16 10-34 0z" fill="#b7bf94" stroke="#98a376"/>
      <path d="m-122-38 114-61 131 67L8 29z" fill="none" stroke="#dce0b8" strokeWidth="3"/>
      <path d="m-107-39 100-53L109-32 8 21z" fill="none" stroke="#98a376" strokeWidth="1.5"/>
      {[-4, 19, 42, 65, 88, 111].map((n, i) => <path key={i} d={`m${-133+n} ${-23+n*.52} -9 5m${12+n} ${38-n*.52} 9 5`} stroke="#9da87e" strokeWidth="2"/>)}
      <path d="m-26-35 25-14 29 15L1-20z" fill="#d0d5ad" strokeWidth="1.3"/>
    </>; break;
    case 'bed': art = <>
      <path d="m-92-48-1 42 11 7 5-39M74 19v30l11-5 2-33" fill="#ad8d6a"/>
      <path d="M-93-67v-78q0-14 12-9l88 44q12 7 12 21v64" fill="#c7a879"/>
      <path d="m-93-72 83-44 111 59-82 48z" fill="#f1e6ca"/>
      <path d="M-93-72v35L19 24l82-45v-36L19-9z" fill="#d8be91"/>
      <path d="m-53-88 32-18 37 19-32 20z" fill="#f7efd9"/>
      <path d="m-57-51 82-44 76 38v36L19 24z" fill="#b0ba9a"/>
      <path d="m-40-44 79-42m-60 52 80-42m-61 52 80-42m-62 52 79-42" stroke="#d3d9bd" strokeWidth="2"/>
      <path d="M19-9v28M-77-139l69 35" fill="none"/>
    </>; break;
    case 'cabinet': case 'nightstand': art = <g transform={type==='nightstand'?'scale(.7)':''}>
      <path d="m-69-29-3 28 9 3 6-22M53 19v24l9-4 3-28" fill="#9f805d"/>
      <path d="m-77-103 31-17 124 64-31 18z" fill="#dfc296"/>
      <path d="M-77-103v79L47 41v-79z" fill="#c6a477"/><path d="m47-38 31-18v79L47 41z" fill="#b08f65"/>
      <path d="m-68-87 105 55v57L-68-30zM-16-60v57" fill="none"/>
      <ellipse cx="-26" cy="-28" rx="3" ry="5" fill="#e7cc86"/><ellipse cx="-6" cy="-17" rx="3" ry="5" fill="#e7cc86"/>
    </g>; break;
    case 'books': art = <>
      <path d="m-32-12 22-13 43 22L11 11z" fill="#9caa99"/><path d="m-32-12 1 8L10 18l1-7M11 11 33-3v8L10 18" fill="#e8dfc5"/>
      <path d="m-28-21 21-12L30-13 9-1z" fill="#ccab7f"/><path d="m-28-21 1 8L9 7V-1M9-1l21-12v8L9 7" fill="#eee4c8"/>
      <path d="m-21-30 19-11 32 17-20 11z" fill="#a3b2b0"/><path d="m-21-30 1 6L10-7v-6M10-13l20-11v6L10-7" fill="#ece3cb"/>
    </>; break;
    case 'art': art = <>
      <path d="m-40-100 81 41v73l-81-41z" fill="#c7aa7d"/><path d="m-32-87 65 33V0l-65-33z" fill="#e8e4c8"/>
      <ellipse cx="9" cy="-48" rx="10" ry="13" fill="#dabb7d" stroke="none"/>
      <path d="m-30-36 22-18 18 21 9-5L31-5z" fill="#96a17c" stroke="none"/>
      <path d="m-29-33 18-9L29-7" fill="none" stroke="#b5be98"/>
    </>; break;
    case 'kettle': art = <>
      <ellipse cy="-5" rx="36" ry="17" fill="#e8dec0"/><path d="M-27-30q-4-20 15-24l26 2q20 6 14 27Q3-5-27-30" fill="#b0b79a"/>
      <path d="m-24-37-19-16 1 20 20 9M26-45q25-9 21 13-4 15-20 9" fill="none" strokeWidth="5"/>
      <ellipse cy="-53" rx="18" ry="7" fill="#ced2b4"/><path d="M-4-59v-7h8v7" fill="#a0a984"/>
      <path d="M4-78q-8-8 0-17" fill="none" stroke="#b4b198" strokeWidth="1.5"/>
    </>; break;
    case 'stove': art = <>
      <path d="m-56-109 43-23 76 40-43 25z" fill="#e7e3cf"/><path d="M-56-109v88L20 19v-86z" fill="#aab7ad"/><path d="m20-67 43-25v88L20 19z" fill="#899c90"/>
      <path d="m-45-71 54 28v44l-54-28z" fill="#6e7c6c"/><path d="m-37-58 38 20v26l-38-20z" fill="#c5cbb7"/>
      <ellipse cx="-18" cy="-108" rx="14" ry="7" fill="#939d8b"/><ellipse cx="23" cy="-86" rx="14" ry="7" fill="#939d8b"/><path d="m-47-88 5 3m14 4 5 3m14 4 5 3" strokeWidth="5"/>
    </>; break;
    case 'fridge': art = <>
      <path d="m-47-165 28-16 70 36-29 17z" fill="#c8d0b9"/><path d="M-47-165v153L22 24v-152z" fill="#b2bda1"/><path d="m22-128 29-17V7L22 24z" fill="#94a285"/>
      <path d="m-44-111 63 33M8-95v20M8-60v32" fill="none"/>
      <path d="m-30-102 21 11v25l-21-11z" fill="#eee2b9" strokeWidth="1.5"/><circle cx="-19" cy="-91" r="3" fill="#ce9c77" stroke="none"/>
    </>; break;
    case 'mirror': art = <>
      <path d="m-20-8-10 25M22-7l12 24" fill="none" strokeWidth="5"/>
      <path d="M-32-42v-71q0-42 32-35 32 5 32 43v74Q0-3-32-42" fill="#c6ac83"/>
      <path d="M-24-44v-66q0-33 24-30 24 7 24 37v69Q1-19-24-44" fill="#d7e3dc"/>
      <path d="m-18-66 36-46m-35 67 34-43" stroke="#f1f3e7" strokeWidth="6"/>
    </>; break;
    case 'cat': art = <>
      <ellipse cx="2" cy="1" rx="40" ry="12" fill="#797859" opacity=".1" stroke="none"/>
      <path d="M-33-14q-1-29 30-28 36-2 39 21Q46 3 10 4-19 5-33-14" fill="#d5b583"/>
      <path d="M19-30q22-5 23 8Q49-7 27-4" fill="none" stroke="#aa8f6b" strokeWidth="7"/>
      <path d="m-33-18-4-23 15 6 13-5 3 23Q-19-5-33-18" fill="#e4c799"/>
      <path d="m-30-22 5 2m8-3 5-1m-13 9 6 1M0-33l4 9m5-10 4 9" fill="none" strokeWidth="1.8"/>
    </>; break;
    default: art = custom ? <image href={custom.src} x="-75" y="-140" width="150" height="150" preserveAspectRatio="xMidYMax meet"/> : <path d="M-30-60h60V0h-60z" fill="#c6b38d"/>;
  }
  return <g {...common}>{art}</g>;
}

export function ItemPreview({ type, custom, className = '' }) {
  return <svg className={className} viewBox="-145 -210 290 270" aria-hidden="true"><Furniture type={type} custom={custom}/></svg>;
}

export function Character({ x, y, color = '#9cae80', className = 'character' }) {
  return <g transform={`translate(${x} ${y})`} className={className} style={{ pointerEvents: 'none' }}>
    <circle r="12" fill={color} stroke="#69735b" strokeWidth="1.5"/>
    <text y="-20" textAnchor="middle" fill="#657653" fontSize="11" paintOrder="stroke" stroke="#f7f3df" strokeWidth="3" strokeLinejoin="round">player</text>
  </g>;
}

export function RoomStructure({ home, build }) {
  const floorColor = { oak: '#ddc49a', birch: '#e9dabe', tile: '#d1d4bd', rose: '#dac4b5' }[home.floor];
  const boundary = home.boundary.length > 2 ? home.boundary.map(p=>`${p.x},${p.y}`).join(' ') : '540,285 890,465 540,645 190,465';
  return <>
    <defs>
      <pattern id="floorboards" width="96" height="46" patternUnits="userSpaceOnUse" patternTransform="matrix(1 .514 -1 .514 540 285)"><rect width="96" height="46" fill={floorColor}/><path d="M0 0h96v46H0zM48 0v46" fill="none" stroke="#af946e" strokeOpacity=".3" strokeWidth="1.4"/><path d="M7 15h25m22 17h32M64 11h14M8 35h12" stroke="#b49a74" strokeOpacity=".2" strokeWidth="1.3"/></pattern>
      <pattern id="tilefloor" width="72" height="72" patternUnits="userSpaceOnUse" patternTransform="matrix(1 .514 -1 .514 540 285)"><rect width="72" height="72" fill={floorColor}/><path d="M0 0h72v72H0z" fill="none" stroke="#a4ad91" strokeWidth="2"/><path d="m36 25 11 11-11 11-11-11z" fill="#a7b294" opacity=".6"/></pattern>
      <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1.3" fill="#7b8b66" opacity=".4"/></pattern>
      <clipPath id="floorclip"><polygon points={boundary}/></clipPath>
      <filter id="roomshadow" x="-20%" width="140%" y="-30%" height="180%"><feGaussianBlur stdDeviation="12"/></filter>
    </defs>
    <ellipse cx="550" cy="602" rx="350" ry="52" fill="#5f7250" opacity=".09" filter="url(#roomshadow)"/>
    {!home.boundary.length && <g stroke="#7c7f64" strokeWidth="2.5" strokeLinejoin="round">
      <path d="M190 465V255L540 75l350 180v210L540 645z" fill={home.wallColor}/>
      <path d="M540 75v210L190 465V255z" fill="#d4d8c0" opacity=".65"/>
      <path d="m190 449 350-180 350 180v16L540 645 190 465z" fill="#b3b396" stroke="none"/>
      <path d="M190 255 540 75l350 180-10 6L540 87 200 262z" fill="#f1edda"/>
      <path d="M540 87v197" fill="none" stroke="#b4b79c" strokeWidth="2"/>
      <g transform="matrix(1 -.514 0 1 274 249)">
        <path d="M-7-9h134v139H-7z" fill="#c6b18b"/>
        <path d="M0 0h120v120H0z" fill="#e8f0df"/>
        <path d="M5 88q35-32 60-14 26-27 50-9v49H5z" fill="#b9c7a0" stroke="none"/>
        <path d="M4 103q47-26 110-11v23H4z" fill="#9fb28c" stroke="none"/>
        <path d="M57 2v116M2 59h116" stroke="#c6b18b" strokeWidth="7"/>
        <path d="M-15 124h150v10H-15z" fill="#d3bd94"/>
        <path d="m3 2-5 111 23-1 5-18L21 2M118 2l4 111-23-1-4-18L99 2" fill="#f4eed5"/>
        <path d="m9 9-2 87M112 9l3 87" stroke="#ddd4b6" strokeWidth="1.4"/>
      </g>
      <g transform="matrix(1 .514 0 1 640 173)">
        <path d="M-7-7h78v86H-7z" fill="#c4aa7e"/><path d="M0 0h64v72H0z" fill="#f1e9cb"/>
        <circle cx="42" cy="23" r="11" fill="#d9bc7e" stroke="none"/>
        <path d="m2 65 19-31 17 21 10-14 14 24z" fill="#9aaa83" stroke="none"/>
        <path d="M26-8q6-16 13 0" fill="none" strokeWidth="1.5"/>
      </g>
      <g transform="matrix(1 .514 0 1 785 302)">
        <path d="M-8 0h61v11H-8z" fill="#c5aa7e"/>
        <path d="M2-11v-20h18v20q-9 9-18 0" fill="#d1bb8e"/>
        <path d="M11-28v-29m0 15Q-9-65-9-46q6 12 20 4m0-4q24-22 21-4-6 11-21 9" fill="#8f9f72"/>
        <path d="M33-1v-29h7v29m4 0v-36h6v36" strokeWidth="1.5" fill="#a3b2a1"/>
        <path d="M0 11v8m39-8v8" fill="none"/>
      </g>
      <path d="m440 338 74-38 83 43-75 38z" fill="#f8e9ab" stroke="none" opacity=".18"/>
    </g>}
    <g stroke="#898367" strokeWidth="2" strokeLinejoin="round">
      <polygon points={boundary} transform="translate(0 15)" fill="#b6a17e"/>
      <polygon points={boundary} fill={`url(#${home.floor === 'tile' ? 'tilefloor' : 'floorboards'})`}/>
      {!home.boundary.length && <path d="m190 465 350 180 350-180M540 645v15M198 478l342 176 342-176" fill="none" stroke="#9e8c6c" strokeWidth="1.7"/>}
    </g>
    {!home.boundary.length && <g clipPath="url(#floorclip)" pointerEvents="none"><path d="m276 420 110-57 157 117-112 57z" fill="#fff5c2" opacity=".23"/><path d="m302 408 127 116m-77-142 132 116m-165-50 107-56" stroke="#efe2b6" strokeWidth="4" opacity=".25"/></g>}
    {(home.grid || build) && <polygon points={boundary} fill="url(#grid)" pointerEvents="none"/>}
    {home.boundary.length > 2 && <polyline points={boundary+' '+boundary.split(' ')[0]} fill="none" stroke="#92997b" strokeWidth="12" strokeLinejoin="round"/>}
  </>;
}

export function Cottage({ color = '#bdc6a2', index = 0 }) {
  return <svg viewBox="0 0 300 270" className="cottage-art" aria-hidden="true"><g stroke="#6e775d" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
    <ellipse cx="150" cy="239" rx="136" ry="19" fill="#aabb8d" stroke="none"/>
    <path d="M55 124v107h189V124L148 58z" fill="#eee4c7"/>
    <path d="m36 131 99-99q12-11 26 0l101 99-18 9-96-80-94 80z" fill={color}/>
    <path d="m77 89 9 10m7-27 13 10m77-7-12 11m24 1-11 10M119 47l13 12" fill="none" opacity=".5"/>
    <path d="M125 230v-76q25-13 49 0v76" fill="#b4bf9b"/><path d="M133 165h32v32h-32z" fill="#e7e9ce"/><circle cx="164" cy="210" r="3" fill="#c5a168"/>
    <path d="M69 155h40v43H69zM191 155h38v43h-38z" fill="#d3e0d0"/>
    <path d="M89 155v43m-20-22h40m101-21v43m-19-22h38" fill="none" stroke="#b8ad88"/>
    <path d="M66 201h46m75 0h46" strokeWidth="5"/>
    <path d="m118 231-12 23h80l-11-23" fill="#d7c9a7"/>
    <path d="M53 227q-22-47-38-11-11 19 38 11M239 228q18-47 40-11 13 22-40 11" fill="#94a575"/>
    <path d="m209 77 1-46h24v70" fill="#c7ad87"/><path d="M207 31h30v9h-30z" fill="#dcc39b"/>
    <path d="m20 243 3-15m252 16 2-17" stroke="#8e9f70"/>
    <circle cx="24" cy="224" r="5" fill="#e4cc88"/><circle cx="277" cy="224" r="5" fill="#dfbaa2"/>
  </g></svg>;
}
