// Small vector cursors stay crisp and use the same cream paper / sage ink as
// the toolbar. The final keyword is a native fallback for unsupported clients.
const svg=body=>`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="#faf7e9" stroke="#526b41" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
const cursor=(body,x,y,fallback)=>`url("data:image/svg+xml,${encodeURIComponent(svg(body))}") ${x} ${y}, ${fallback}`;
const arrow='<path d="M4 3 12 26l4-9 10-4Z"/><path d="m16 17 5 8" fill="none"/>';
const move='<path d="M16 3 12 8h3v6H9v-3l-6 5 6 4v-3h6v6h-3l4 6 4-6h-3v-6h6v3l6-4-6-5v3h-6V8h3Z"/>';
const resize=angle=>`<g transform="rotate(${angle} 16 16)"><path d="M3 16 10 10v4h12v-4l7 6-7 6v-4H10v4Z"/></g>`;
const cursors={
  default:cursor(arrow,4,3,'default'),
  pointer:cursor('<path d="M12 15V5q0-4 4-2l1 10 3-1 3 2 3 1-1 9-5 5h-8l-6-9q-2-5 2-4l4 4Z"/>',14,3,'pointer'),
  move:cursor(move,16,16,'move'),
  grab:cursor('<path d="m8 15-2-5q0-4 3-2l4 6-2-9q1-4 3-1l3 9 1-8q2-3 3 0v10l3-5q3-2 3 1l-3 12-5 5h-7l-6-7q-4-6-1-6l6 4Z"/>',16,16,'grab'),
  grabbing:cursor('<path d="M8 15v-4q2-3 4 0V9q2-3 4 0 2-3 4 1 3-2 5 2v10l-5 6h-8l-6-8q-2-5 2-5Z"/>',16,16,'grabbing'),
  crosshair:cursor('<circle cx="16" cy="16" r="4"/><path d="M16 3v8m0 10v8M3 16h8m10 0h8" fill="none"/>',16,16,'crosshair'),
  cell:cursor('<path d="m7 21 12-15 9 7-12 15H9Z"/><path d="m12 15 9 7M7 28h20" fill="none"/>',7,21,'cell'),
  'ew-resize':cursor(resize(0),16,16,'ew-resize'),
  'ns-resize':cursor(resize(90),16,16,'ns-resize'),
  'nwse-resize':cursor(resize(45),16,16,'nwse-resize'),
  'nesw-resize':cursor(resize(-45),16,16,'nesw-resize'),
};
export const cursorStyles=Object.fromEntries(Object.entries(cursors).map(([name,value])=>[`--cursor-${name}`,value]));
export const gameCursor=name=>`var(--cursor-${name}, ${name})`;
