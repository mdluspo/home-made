import React from 'react';

// Small painted objects for the game HUD. Editor glyphs remain precise diagrams.
export function GameIcon({ kind, ...props }) {
  return <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {kind === 'home' ? <>
      <path d="M8 19 20 8l12 10-1 16H9Z" fill="#e6d5ad"/>
      <path d="m5 20 15-14 15 13" strokeWidth="2.8"/>
      <path d="m16 34 1-11 7 .5V34" fill="#9cac83"/>
      <path d="M11 19h4v5h-4z" fill="#fff8de"/>
      <path d="M27 12q-1-10 9-9 0 9-9 9Zm0 0 5-5" fill="#a4b680"/>
    </> : kind === 'build' ? <>
      <path d="m9 8 6-3 16 26-6 4Z" fill="#d5b879"/>
      <path d="m16 14-4 2m8 4-4 2m9 4-4 2"/>
      <path d="m6 30 23-23 5 5-23 23-7 2Z" fill="#a4b48f"/>
      <path d="m26 10 5 5M6 30l5 5-7 2Z" fill="#f6e8c5"/>
      <path d="m5 34-1 3 3-1" fill="currentColor"/>
    </> : kind === 'decorate' ? <>
      <path d="m23 5 10 5-9 17-9-5Z" fill="#b5c29b"/>
      <path d="m23 5 4-3 9 5-3 3" fill="#e6cf93"/>
      <path d="m15 22 9 5-5 5-3-1-4 6-4-2 5-7Z" fill="#caa77b"/>
      <path d="m26 8 5 3m-8 1 5 3" stroke="#f7f0d5"/>
      <path d="M5 7v7m-3-3h6M33 26v7m-3-3h6" stroke="#bda15e"/>
    </> : kind === 'explore' ? <>
      <path d="M9 34V7l22-2v29Z" fill="#d4ba92"/>
      <path d="m13 34 1-23 13-2-1 25" fill="#899e7b"/>
      <path d="m14 11 10 4v22l-11-4Z" fill="#ecdbb6"/>
      <path d="M20 24v2M5 35h28"/>
      <path d="m30 14 4-3m-3 9h6" stroke="#b59d62"/>
    </> : kind === 'invite' ? <>
      <path d="m4 12 31-1 1 23-31 1Z" fill="#eee0bc"/>
      <path d="m5 13 15 11 15-12M5 34l11-13m20 12L24 21"/>
      <path d="M24 10c-5-5 1-10 4-5 4-5 9 0 5 4l-5 5Z" fill="#b5bd8b"/>
    </> : kind === 'finishes' ? <>
      <path d="m5 10 21-4 5 27-21 3Z" fill="#c7b392"/>
      <path d="m12 5 22 3-4 27-22-3Z" fill="#ede1be"/>
      <path d="m16 12 11 1-1 8-11-1Z" fill="#a9b994"/>
      <path d="m14 25 11 1m-11 4 7 .5"/>
    </> : kind === 'furnish' ? <>
      <path d="M9 24V13q0-6 7-6h10q6 0 6 6v12" fill="#bdc49c"/>
      <path d="M6 19q5-2 7 3v5h15v-5q2-5 7-3l-1 14H7Z" fill="#a2b38c"/>
      <path d="M10 33v4m21-4v4M15 14l12 1"/>
    </> : kind === 'street' ? <>
      <path d="m3 19 8-8 9 7v13H5Z" fill="#d3bf91"/>
      <path d="m21 14 8-8 9 8-1 17H22Z" fill="#b7c39b"/>
      <path d="M9 31V21h6v10m12-12h5v5h-5M3 35h34"/>
    </> : kind === 'chat' ? <>
      <path d="M6 8 33 7l2 23-16 1-8 6v-7l-6-1Z" fill="#e8d7aa"/>
      <path d="m12 16 15-1m-14 7 11-.5"/>
      <path d="m29 3 1 5" stroke="#a8b58d"/>
    </> : null}
  </svg>;
}
