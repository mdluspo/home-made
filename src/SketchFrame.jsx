import React from 'react';

// Drawn contours, kept separate from text and the precise floor-plan geometry.
export function SketchFrame({ shape = 'paper' }) {
  const tall = shape === 'tray';
  return <svg className={`sketch-frame sketch-${shape}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path className="sketch-contour" vectorEffect="non-scaling-stroke" d={tall
      ? 'M12 1.2 Q38 .3 86 1.1 Q98 1.3 98.1 5 Q97.5 27 98.4 49 Q97.8 73 98.1 95 Q98 98.6 87 98.5 Q53 99.1 12 98.5 Q1.7 98.1 1.6 95 Q2.5 66 1.6 47 Q2.4 21 1.8 5 Q1.5 1.8 12 1.2 Z'
      : 'M5 2 Q30 .9 52 1.8 Q76 1 95 2 Q98.9 2.4 98.6 8 Q97.9 49 98.7 92 Q98.4 97.8 94 98 Q64 97 48 98.2 Q23 97.2 6 98 Q1.6 97.6 1.8 91 Q2.5 58 1.6 30 L1.9 8 Q1.6 2.7 5 2 Z'}/>
    <path className="sketch-retrace" vectorEffect="non-scaling-stroke" d={tall ? 'M5 12 Q4.3 34 4.9 43 M94 65 Q94.5 82 94 93 M14 97 Q38 96.6 53 97' : 'M8 4.7 Q29 3.7 43 4.4 M96.2 60 Q95.8 82 96.3 90 M57 95.7 Q77 95.2 91 95.8'}/>
  </svg>;
}

export function RulerMarks() {
  return <svg className="ruler-marks" viewBox="0 0 260 12" preserveAspectRatio="none" aria-hidden="true">
    <path d="M2 11 Q90 10.5 135 11 T258 10.8"/>
    {Array.from({ length: 26 }, (_, i) => {
      const x = 5 + i * 10;
      return <path key={i} d={`M${x} 11l${i % 3 === 0 ? '.2' : '-.1'} -${i % 5 === 0 ? 9 : i % 2 === 0 ? 5 : 3}`}/>;
    })}
  </svg>;
}
